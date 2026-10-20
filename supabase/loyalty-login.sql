begin;
-- A customer can re-open a read-only card with their registered name and phone.
-- These are deliberately not treated as proof of phone ownership or staff credentials.
create table blanco_private.loyalty_device_keys (
  token_hash text primary key,
  member_id uuid not null references blanco_private.loyalty_members(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default now()+interval '180 days'
);
create index loyalty_device_keys_member on blanco_private.loyalty_device_keys(member_id,created_at desc);
alter table blanco_private.loyalty_device_keys enable row level security;
revoke all on blanco_private.loyalty_device_keys from public,anon,authenticated;
create policy loyalty_no_direct_access on blanco_private.loyalty_device_keys for all to anon,authenticated using(false) with check(false);

alter function blanco_private.loyalty_api(text,jsonb) rename to loyalty_api_base;
revoke all on function blanco_private.loyalty_api_base(text,jsonb) from public,anon,authenticated;
create function blanco_private.loyalty_api(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare member_key uuid; response jsonb; cfg jsonb;
begin
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>16000 then raise exception 'Demande invalide.'; end if;
  if action='card' and coalesce(payload->>'key','') ~ '^[a-f0-9]{64}$' then
    select k.member_id into member_key from blanco_private.loyalty_device_keys k
      where k.token_hash=encode(sha256(convert_to(payload->>'key','UTF8')),'hex') and k.expires_at>now();
    if found then
      select to_jsonb(p) into cfg from blanco_private.loyalty_program p where id=true;
      return jsonb_build_object('member',blanco_private.loyalty_view(member_key,false),'program',cfg);
    end if;
  end if;
  response:=blanco_private.loyalty_api_base(action,payload);
  if action='recover' then
    delete from blanco_private.loyalty_device_keys where member_id=(response->'member'->>'id')::uuid;
  end if;
  return response;
end $$;
revoke all on function blanco_private.loyalty_api(text,jsonb) from public,anon,authenticated;
grant execute on function blanco_private.loyalty_api(text,jsonb) to anon,authenticated;
create or replace function public.loyalty_api(action text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select blanco_private.loyalty_api(action,payload); $$;

create function blanco_private.loyalty_login(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  m blanco_private.loyalty_members%rowtype; name_text text; phone_text text; key_text text; key_hash text;
  ip_hash text; phone_hash text; headers jsonb; window_start timestamptz; ip_hits int; phone_hits int; cfg jsonb;
  invalid_message text:='Nom ou téléphone incorrect. Utilisez exactement le nom enregistré, ou demandez de l’aide au comptoir.';
begin
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>2000 then return jsonb_build_object('error',invalid_message); end if;
  key_text:=payload->>'key';
  if key_text is null or key_text !~ '^[a-f0-9]{64}$' or coalesce(payload->>'website','')<>'' then return jsonb_build_object('error',invalid_message); end if;
  name_text:=lower(trim(regexp_replace(coalesce(payload->>'name',''),'\s+',' ','g')));
  phone_text:=regexp_replace(coalesce(payload->>'phone',''),'[^0-9+]','','g');
  if phone_text like '00%' then phone_text:='+'||substr(phone_text,3); elsif phone_text like '0%' then phone_text:='+33'||substr(phone_text,2); elsif phone_text !~ '^\+' then phone_text:='+'||phone_text; end if;
  if length(name_text) not between 2 and 70 or phone_text !~ '^\+[0-9]{8,15}$' then return jsonb_build_object('error',invalid_message); end if;
  headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  ip_hash:='login-ip:'||encode(sha256(convert_to(split_part(coalesce(headers->>'cf-connecting-ip',headers->>'x-forwarded-for','shared'),',',1),'UTF8')),'hex');
  phone_hash:='login-phone:'||encode(sha256(convert_to(phone_text,'UTF8')),'hex');
  window_start:=date_bin(interval '15 minutes',now(),'2000-01-01'::timestamptz);
  delete from blanco_private.loyalty_registration_limits where bucket<now()-interval '2 days';
  insert into blanco_private.loyalty_registration_limits values(ip_hash,window_start,1) on conflict(fingerprint,bucket) do update set attempts=loyalty_registration_limits.attempts+1 returning attempts into ip_hits;
  insert into blanco_private.loyalty_registration_limits values(phone_hash,window_start,1) on conflict(fingerprint,bucket) do update set attempts=loyalty_registration_limits.attempts+1 returning attempts into phone_hits;
  -- Return an error value, rather than raising, so failed-attempt counters are committed.
  if ip_hits>40 or phone_hits>10 then return jsonb_build_object('error','Trop de tentatives. Réessayez dans 15 minutes ou adressez-vous à notre équipe.'); end if;
  select * into m from blanco_private.loyalty_members where phone=phone_text and lower(name)=name_text for update;
  if not found then return jsonb_build_object('error',invalid_message); end if;
  key_hash:=encode(sha256(convert_to(key_text,'UTF8')),'hex');
  if exists(select 1 from blanco_private.loyalty_device_keys where token_hash=key_hash and member_id<>m.id)
    or exists(select 1 from blanco_private.loyalty_members where token_hash=key_hash and id<>m.id) then return jsonb_build_object('error',invalid_message); end if;
  insert into blanco_private.loyalty_device_keys(token_hash,member_id) values(key_hash,m.id)
    on conflict(token_hash) do update set expires_at=now()+interval '180 days',created_at=clock_timestamp();
  delete from blanco_private.loyalty_device_keys where member_id=m.id and (expires_at<=now() or token_hash in
    (select token_hash from blanco_private.loyalty_device_keys where member_id=m.id order by created_at desc,token_hash limit all offset 10));
  select to_jsonb(p) into cfg from blanco_private.loyalty_program p where id=true;
  return jsonb_build_object('member',blanco_private.loyalty_view(m.id,false),'program',cfg);
end $$;
revoke all on function blanco_private.loyalty_login(jsonb) from public,anon,authenticated;
grant execute on function blanco_private.loyalty_login(jsonb) to anon,authenticated;
create function public.loyalty_login(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select blanco_private.loyalty_login(payload); $$;
revoke all on function public.loyalty_login(jsonb) from public,anon,authenticated;
grant execute on function public.loyalty_login(jsonb) to anon,authenticated;
commit;
