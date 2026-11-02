-- Blanco TV: per-device capabilities, owner-only management, private token/PIN material.
begin;
create schema if not exists blanco_private;
create table blanco_private.tv_devices (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique,
 pair_code text unique, pair_expires_at timestamptz, paired_at timestamptz,
 name text not null default 'Blanco TV', revoked boolean not null default false,
 config jsonb not null default '{"mode":"menu","url":"","items":[],"orientation":"portrait","rotation":0,"override":"auto","schedule":{"enabled":false,"timezone":"Europe/Paris","days":[{"day":1,"enabled":true,"start":"08:00","end":"20:00"},{"day":2,"enabled":true,"start":"08:00","end":"20:00"},{"day":3,"enabled":true,"start":"08:00","end":"20:00"},{"day":4,"enabled":true,"start":"08:00","end":"20:00"},{"day":5,"enabled":true,"start":"08:00","end":"20:00"},{"day":6,"enabled":true,"start":"08:00","end":"20:00"},{"day":7,"enabled":false,"start":"08:00","end":"20:00"}]}}',
 pin_salt text, pin_hash text, pin_iterations integer not null default 210000,
 revision integer not null default 1, status jsonb not null default '{}',
 created_at timestamptz not null default now(), last_seen_at timestamptz
);
create table blanco_private.tv_commands (
 id uuid primary key default gen_random_uuid(), device_id uuid not null references blanco_private.tv_devices on delete cascade,
 request_id uuid not null, kind text not null check(kind in ('reload','restart_app','sleep','wake','reboot')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '2 minutes',
 acknowledged_at timestamptz, result text, message text, unique(device_id,request_id)
);
create index tv_commands_pending on blanco_private.tv_commands(device_id,created_at) where acknowledged_at is null;
create table blanco_private.tv_limits (id text primary key, hits integer not null, expires_at timestamptz not null);
alter table blanco_private.tv_devices enable row level security;
alter table blanco_private.tv_commands enable row level security;
alter table blanco_private.tv_limits enable row level security;
create policy tv_devices_no_direct on blanco_private.tv_devices as restrictive for all to public using(false) with check(false);
create policy tv_commands_no_direct on blanco_private.tv_commands as restrictive for all to public using(false) with check(false);
create policy tv_limits_no_direct on blanco_private.tv_limits as restrictive for all to public using(false) with check(false);
revoke all on blanco_private.tv_devices,blanco_private.tv_commands,blanco_private.tv_limits from public,anon,authenticated;

create function blanco_private.tv_safe_url(u text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(length(u)<=1500 and u ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$',false)
$$;
revoke all on function blanco_private.tv_safe_url(text) from public,anon,authenticated;

create function blanco_private.tv_valid_config(c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; day jsonb; seen integer[]:='{}';
begin
 if jsonb_typeof(c)<>'object' or octet_length(c::text)>24000 or coalesce(c->>'mode','') not in ('menu','url','playlist')
  or coalesce(c->>'orientation','') not in ('portrait','landscape') or coalesce(c->>'rotation','') not in ('0','90','180','270')
  or coalesce(c->>'override','') not in ('auto','open','closed') or jsonb_typeof(c->'items') is distinct from 'array'
  or jsonb_array_length(c->'items')>30 or (coalesce(c->>'url','')<>'' and not blanco_private.tv_safe_url(c->>'url'))
  or (c->>'mode'='url' and coalesce(c->>'url','')='')
  or (c->>'mode'='playlist' and jsonb_array_length(c->'items')=0)
  or jsonb_typeof(c->'schedule') is distinct from 'object' or c->'schedule'->>'timezone' is distinct from 'Europe/Paris'
  or jsonb_typeof(c->'schedule'->'enabled') is distinct from 'boolean' or jsonb_typeof(c->'schedule'->'days') is distinct from 'array'
  or jsonb_array_length(c->'schedule'->'days')>7 then return false; end if;
 for item in select value from jsonb_array_elements(c->'items') loop
  if coalesce(item->>'type','') not in ('image','video','url') or not blanco_private.tv_safe_url(item->>'url')
   or jsonb_typeof(item->'duration') is distinct from 'number' or (item->>'duration')::numeric not between 5 and 3600 then return false; end if;
 end loop;
 for day in select value from jsonb_array_elements(c->'schedule'->'days') loop
  if coalesce(day->>'day','') !~ '^[1-7]$' or (day->>'day')::int=any(seen) or jsonb_typeof(day->'enabled') is distinct from 'boolean'
   or coalesce(day->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(day->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   or day->>'start'=day->>'end' then return false; end if;
  seen:=array_append(seen,(day->>'day')::int);
 end loop;
 if (c->'schedule'->>'enabled')::boolean and cardinality(seen)<>7 then return false; end if;
 return true;
exception when others then return false;
end $$;
revoke all on function blanco_private.tv_valid_config(jsonb) from public,anon,authenticated;

create function blanco_private.tv_api(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare d blanco_private.tv_devices%rowtype; cmd blanco_private.tv_commands%rowtype; token text; h text; ip text; lim text; hits integer; cfg jsonb; rows jsonb; ack jsonb;
begin
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>32000 then raise exception 'Demande invalide.'; end if;
 if action in ('pair','sync') then
  token:=coalesce(payload->>'token','');
  if token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','Appareil non reconnu.'); end if;
  h:=encode(sha256(convert_to(token,'UTF8')),'hex');
  if action='pair' then
   select * into d from blanco_private.tv_devices where token_hash=h for update;
   if found and d.revoked then return jsonb_build_object('revoked',true,'error','Accès révoqué.'); end if;
   if found and d.paired_at is not null then return jsonb_build_object('paired',true); end if;
   if found and d.pair_expires_at>now() then return jsonb_build_object('pairCode',d.pair_code,'expiresAt',d.pair_expires_at); end if;
   ip:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for','unknown');
   lim:=encode(sha256(convert_to(left(ip,200),'UTF8')),'hex');
   insert into blanco_private.tv_limits values(lim,1,now()+interval '1 hour')
    on conflict(id) do update set hits=case when tv_limits.expires_at<=now() then 1 else tv_limits.hits+1 end,
      expires_at=case when tv_limits.expires_at<=now() then now()+interval '1 hour' else tv_limits.expires_at end returning tv_limits.hits into hits;
   if hits>20 then return jsonb_build_object('error','Trop de demandes. Réessayez plus tard.'); end if;
   delete from blanco_private.tv_devices where paired_at is null and created_at<now()-interval '1 day';
   insert into blanco_private.tv_devices(token_hash,pair_code,pair_expires_at)
    values(h,upper(encode(extensions.gen_random_bytes(5),'hex')),now()+interval '15 minutes')
    on conflict(token_hash) do update set pair_code=excluded.pair_code,pair_expires_at=excluded.pair_expires_at returning * into d;
   return jsonb_build_object('pairCode',d.pair_code,'expiresAt',d.pair_expires_at);
  end if;
  select * into d from blanco_private.tv_devices where token_hash=h for update;
  if not found then return jsonb_build_object('error','Appareil non reconnu.'); end if;
  if d.revoked then return jsonb_build_object('revoked',true,'error','Accès révoqué.'); end if;
  if d.paired_at is null then return jsonb_build_object('paired',false); end if;
  if jsonb_typeof(payload->'status')='object' and octet_length((payload->'status')::text)<=2000 then
   update blanco_private.tv_devices set status=payload->'status',last_seen_at=now() where id=d.id;
  else update blanco_private.tv_devices set last_seen_at=now() where id=d.id; end if;
  if jsonb_typeof(payload->'acks')='array' and jsonb_array_length(payload->'acks')<=10 then
   for ack in select value from jsonb_array_elements(payload->'acks') loop
    if coalesce(ack->>'id','') ~ '^[a-f0-9-]{36}$' and ack->>'result' in ('ok','unsupported','failed','requested') then
     update blanco_private.tv_commands set acknowledged_at=now(),result=ack->>'result',message=left(coalesce(ack->>'message',''),200)
      where id=(ack->>'id')::uuid and device_id=d.id and acknowledged_at is null;
    end if;
   end loop;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'kind',c.kind,'expiresAt',c.expires_at) order by c.created_at),'[]') into rows
   from blanco_private.tv_commands c where c.device_id=d.id and c.acknowledged_at is null and c.expires_at>now();
  return jsonb_build_object('paired',true,'id',d.id,'name',d.name,'revision',d.revision,'config',d.config,
   'pinAuth',jsonb_build_object('salt',d.pin_salt,'hash',d.pin_hash,'iterations',d.pin_iterations),'commands',rows,'serverNow',now(),
   'menu',(select content from public.menu_state where id='blanco'));
 end if;
 if not exists(select 1 from public.menu_admins where user_id=auth.uid()) then raise exception 'Accès réservé à la direction de Blanco.'; end if;
 if action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'revoked',t.revoked,'config',t.config,'revision',t.revision,
   'status',t.status,'lastSeenAt',t.last_seen_at,'pairedAt',t.paired_at,'hasPin',t.pin_hash is not null) order by t.created_at desc),'[]') into rows
   from blanco_private.tv_devices t where paired_at is not null;
  return jsonb_build_object('devices',rows);
 end if;
 if action='claim' then
  if coalesce(payload->>'pairCode','') !~ '^[A-Fa-f0-9]{10}$' or length(trim(coalesce(payload->>'name',''))) not between 1 and 80
   or coalesce(payload->>'pinSalt','') !~ '^[a-f0-9]{32}$' or coalesce(payload->>'pinHash','') !~ '^[a-f0-9]{64}$' then raise exception 'Code, nom ou PIN invalide.'; end if;
  select * into d from blanco_private.tv_devices where pair_code=upper(payload->>'pairCode') and pair_expires_at>now() and paired_at is null and not revoked for update;
  if not found then raise exception 'Code expiré ou déjà utilisé. Demandez un nouveau code sur la TV.'; end if;
  update blanco_private.tv_devices set name=trim(payload->>'name'),paired_at=now(),pair_code=null,pair_expires_at=null,
   pin_salt=payload->>'pinSalt',pin_hash=payload->>'pinHash',revision=revision+1 where id=d.id;
  return jsonb_build_object('id',d.id);
 end if;
 select * into d from blanco_private.tv_devices where id=(payload->>'id')::uuid and paired_at is not null for update;
 if not found then raise exception 'Écran introuvable.'; end if;
 if action='save' then
  if d.revoked then raise exception 'Cet écran a été révoqué.'; end if;
  if (payload->>'revision')::int is distinct from d.revision then raise exception 'Configuration modifiée ailleurs. Rechargez avant de publier.'; end if;
  cfg:=payload->'config';
  if not blanco_private.tv_valid_config(cfg) or length(trim(coalesce(payload->>'name',''))) not between 1 and 80 then raise exception 'Vérifiez le contenu, les liens HTTPS et les horaires.'; end if;
  update blanco_private.tv_devices set config=cfg,name=trim(payload->>'name'),revision=revision+1 where id=d.id;
  return jsonb_build_object('saved',true);
 elsif action='pin' then
  if d.revoked or coalesce(payload->>'pinSalt','') !~ '^[a-f0-9]{32}$' or coalesce(payload->>'pinHash','') !~ '^[a-f0-9]{64}$' then raise exception 'PIN invalide.'; end if;
  update blanco_private.tv_devices set pin_salt=payload->>'pinSalt',pin_hash=payload->>'pinHash',revision=revision+1 where id=d.id;
  return jsonb_build_object('saved',true);
 elsif action='revoke' then
  update blanco_private.tv_devices set revoked=true,revision=revision+1 where id=d.id;
  delete from blanco_private.tv_commands where device_id=d.id and acknowledged_at is null;
  return jsonb_build_object('revoked',true);
 elsif action='history' then
  select coalesce(jsonb_agg(x order by x->>'createdAt' desc),'[]') into rows from
   (select jsonb_build_object('id',id,'kind',kind,'createdAt',created_at,'expiresAt',expires_at,'acknowledgedAt',acknowledged_at,'result',result,'message',message) x
    from blanco_private.tv_commands where device_id=d.id order by created_at desc limit 30) q;
  return jsonb_build_object('commands',rows);
 elsif action='command' then
  if d.revoked or coalesce(payload->>'kind','') not in ('reload','restart_app','sleep','wake','reboot') then raise exception 'Commande indisponible.'; end if;
  select * into cmd from blanco_private.tv_commands where device_id=d.id and request_id=(payload->>'requestId')::uuid;
  if found then return jsonb_build_object('commandId',cmd.id); end if;
  select * into cmd from blanco_private.tv_commands where device_id=d.id and kind=payload->>'kind' and acknowledged_at is null and expires_at>now() order by created_at limit 1;
  if found then return jsonb_build_object('commandId',cmd.id); end if;
  if (select count(*) from blanco_private.tv_commands where device_id=d.id and acknowledged_at is null and expires_at>now())>=5 then raise exception 'Plusieurs commandes attendent déjà la TV.'; end if;
  insert into blanco_private.tv_commands(device_id,request_id,kind) values(d.id,(payload->>'requestId')::uuid,payload->>'kind') returning * into cmd;
  return jsonb_build_object('commandId',cmd.id);
 end if;
 raise exception 'Action inconnue.';
end $$;
revoke all on function blanco_private.tv_api(text,jsonb) from public;
grant usage on schema blanco_private to anon,authenticated;
grant execute on function blanco_private.tv_api(text,jsonb) to anon,authenticated;
create function public.tv_api(action text,payload jsonb default '{}') returns jsonb
 language sql security invoker set search_path='' as $$select blanco_private.tv_api(action,payload)$$;
revoke all on function public.tv_api(text,jsonb) from public;
grant execute on function public.tv_api(text,jsonb) to anon,authenticated;
commit;
