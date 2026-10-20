-- Loyalty data is deliberately outside the exposed API schema. Only narrow RPCs are public.
begin;
create schema blanco_private;
revoke all on schema blanco_private from public;
grant usage on schema blanco_private to anon, authenticated;

create table blanco_private.loyalty_program (
  id boolean primary key default true check(id), revision integer not null default 1,
  enabled boolean not null default true, title text not null default 'Les petites habitudes récompensées.',
  goal integer not null default 8 check(goal between 2 and 30),
  window_days integer not null default 30 check(window_days between 1 and 365),
  reward_kind text not null default 'drink' check(reward_kind in ('drink','percent','fixed')),
  reward_value integer not null default 0 check(reward_value between 0 and 100000),
  reward_label text not null default 'Une boisson offerte',
  max_price_cents integer not null default 0 check(max_price_cents between 0 and 100000),
  reward_days integer not null default 14 check(reward_days between 1 and 365),
  next_day boolean not null default true,
  daily_limit integer not null default 50 check(daily_limit between 1 and 200),
  eligible_text text not null default 'Un tampon par boisson payée. Les suppléments restent à votre charge. Une boisson offerte ne rapporte pas de tampon.',
  updated_at timestamptz not null default now()
);
insert into blanco_private.loyalty_program(id) values(true);
create table blanco_private.loyalty_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true, created_at timestamptz not null default now()
);
create table blanco_private.loyalty_members (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 70),
  phone text not null unique check(phone ~ '^\+[0-9]{8,15}$'), code text not null unique,
  token_hash text not null unique, stamps integer not null default 0 check(stamps>=0),
  cycle_started_at timestamptz, cycle_expires_at timestamptz, cycle_rules jsonb,
  total_stamps integer not null default 0 check(total_stamps>=0),
  consent_version text not null default '2026-10-20-v1', consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index loyalty_members_name on blanco_private.loyalty_members(lower(name));
create index loyalty_members_created on blanco_private.loyalty_members(created_at desc);
create table blanco_private.loyalty_rewards (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references blanco_private.loyalty_members(id) on delete cascade,
  rules jsonb not null, earned_at timestamptz not null default now(), available_at timestamptz not null,
  expires_at timestamptz not null, redeemed_at timestamptz, redeemed_by uuid references auth.users(id) on delete set null,
  void boolean not null default false
);
create index loyalty_rewards_member on blanco_private.loyalty_rewards(member_id,earned_at desc);
create table blanco_private.loyalty_events (
  id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique, request_id uuid unique,
  member_id uuid not null references blanco_private.loyalty_members(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check(kind in ('stamp','redeem','undo','recover')),
  delta integer not null default 0, reward_id uuid references blanco_private.loyalty_rewards(id) on delete set null,
  undo_of uuid unique references blanco_private.loyalty_events(id), metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index loyalty_events_member on blanco_private.loyalty_events(member_id,created_at desc);
create table blanco_private.loyalty_registration_limits (
  fingerprint text not null, bucket timestamptz not null, attempts integer not null,
  primary key(fingerprint,bucket)
);
alter table blanco_private.loyalty_program enable row level security;
alter table blanco_private.loyalty_staff enable row level security;
alter table blanco_private.loyalty_members enable row level security;
alter table blanco_private.loyalty_rewards enable row level security;
alter table blanco_private.loyalty_events enable row level security;
alter table blanco_private.loyalty_registration_limits enable row level security;
revoke all on all tables in schema blanco_private from public,anon,authenticated;

create function blanco_private.loyalty_view(member_key uuid, staff_view boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m blanco_private.loyalty_members%rowtype; cfg jsonb; rules jsonb; expired boolean; rewards jsonb; history jsonb; last_event jsonb;
begin
  select * into strict m from blanco_private.loyalty_members where id=member_key;
  select to_jsonb(p) into cfg from blanco_private.loyalty_program p where id=true;
  expired := m.cycle_expires_at is not null and m.cycle_expires_at<=now();
  rules:=case when expired or m.cycle_rules is null then cfg else m.cycle_rules end;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'label',r.rules->>'reward_label','kind',r.rules->>'reward_kind','value',(r.rules->>'reward_value')::int,'maxPriceCents',(r.rules->>'max_price_cents')::int,'earnedAt',r.earned_at,'availableAt',r.available_at,'expiresAt',r.expires_at,'status',case when r.redeemed_at is not null then 'used' when r.expires_at<=now() then 'expired' when r.available_at>now() then 'soon' else 'ready' end) order by r.earned_at desc),'[]'::jsonb) into rewards from blanco_private.loyalty_rewards r where r.member_id=m.id and not r.void;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'delta',x.delta,'at',x.created_at) order by x.sequence desc),'[]'::jsonb) into history from (select * from blanco_private.loyalty_events where member_id=m.id order by sequence desc limit 15) x;
  if staff_view then
    select jsonb_build_object('id',e.id,'kind',e.kind,'canUndo',e.kind in ('stamp','redeem') and e.created_at>now()-interval '15 minutes' and (e.actor_id=auth.uid() or exists(select 1 from public.menu_admins where user_id=auth.uid())) and not exists(select 1 from blanco_private.loyalty_events u where u.undo_of=e.id)) into last_event from blanco_private.loyalty_events e where member_id=m.id order by sequence desc limit 1;
  end if;
  return jsonb_build_object('code',m.code,'name',m.name,'stamps',case when expired then 0 else m.stamps end,'goal',(rules->>'goal')::int,'cycleExpiresAt',case when expired then null else m.cycle_expires_at end,'cycleExpired',expired,'totalStamps',m.total_stamps,'rules',rules,'rewards',rewards,'history',history,'createdAt',m.created_at) || case when staff_view then jsonb_build_object('id',m.id,'phone',m.phone,'lastEvent',last_event) else '{}'::jsonb end;
end $$;

-- Intentional capability-based operations: registration and card reading do not use Auth.
-- All staff actions below require auth.uid() AND a live staff/owner membership check.
create function blanco_private.loyalty_api(action text, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  cfg blanco_private.loyalty_program%rowtype; m blanco_private.loyalty_members%rowtype;
  r blanco_private.loyalty_rewards%rowtype; e blanco_private.loyalty_events%rowtype;
  uid uuid:=auth.uid(); owner boolean; staff boolean; key_text text; key_hash text; phone_text text; name_text text;
  code_text text; ip_fingerprint text; headers jsonb; hits integer; request_key uuid; amount integer; remaining integer; take_count integer;
  before_state jsonb; reward_keys jsonb:='[]'; rules jsonb; reward_key uuid; list jsonb; stats jsonb; needle text; offs integer;
  last_id uuid; cfg_value jsonb; requested_revision integer;
begin
  if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>16000 then raise exception 'Demande invalide.'; end if;
  select * into strict cfg from blanco_private.loyalty_program where id=true;
  if action='program' then return jsonb_build_object('program',to_jsonb(cfg)); end if;
  owner:=uid is not null and exists(select 1 from public.menu_admins where user_id=uid);
  staff:=owner or (uid is not null and exists(select 1 from blanco_private.loyalty_staff where user_id=uid and active));

  if action in ('register','card') then
    key_text:=payload->>'key';
    if key_text is null or key_text !~ '^[a-f0-9]{64}$' then raise exception 'Cette carte est introuvable. Adressez-vous à notre équipe.'; end if;
    key_hash:=encode(sha256(convert_to(key_text,'UTF8')),'hex');
    if action='card' then
      select * into m from blanco_private.loyalty_members where token_hash=key_hash;
      if not found then raise exception 'Cette carte est introuvable. Adressez-vous à notre équipe.'; end if;
      return jsonb_build_object('member',blanco_private.loyalty_view(m.id,false),'program',to_jsonb(cfg));
    end if;
    if not cfg.enabled then raise exception 'Les inscriptions sont momentanément fermées.'; end if;
    if coalesce(payload->>'website','')<>'' or coalesce((payload->>'consent')::boolean,false)=false then raise exception 'Veuillez accepter les conditions du programme.'; end if;
    name_text:=trim(regexp_replace(coalesce(payload->>'name',''),'\s+',' ','g'));
    phone_text:=regexp_replace(coalesce(payload->>'phone',''),'[^0-9+]','','g');
    if phone_text like '00%' then phone_text:='+'||substr(phone_text,3); elsif phone_text like '0%' then phone_text:='+33'||substr(phone_text,2); elsif phone_text !~ '^\+' then phone_text:='+'||phone_text; end if;
    if length(name_text) not between 2 and 70 or phone_text !~ '^\+[0-9]{8,15}$' then raise exception 'Vérifiez votre prénom et votre téléphone (ex. 06… ou +33…).'; end if;
    select * into m from blanco_private.loyalty_members where token_hash=key_hash;
    if found then
      if m.phone<>phone_text then raise exception 'Impossible de créer cette carte. Adressez-vous à notre équipe.'; end if;
      return jsonb_build_object('member',blanco_private.loyalty_view(m.id,false),'program',to_jsonb(cfg));
    end if;
    headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
    ip_fingerprint:=encode(sha256(convert_to(coalesce(headers->>'cf-connecting-ip',headers->>'x-forwarded-for','shared')||current_date::text,'UTF8')),'hex');
    delete from blanco_private.loyalty_registration_limits where bucket<now()-interval '2 days';
    insert into blanco_private.loyalty_registration_limits values(ip_fingerprint,date_trunc('hour',now()),1) on conflict(fingerprint,bucket) do update set attempts=loyalty_registration_limits.attempts+1 returning attempts into hits;
    if hits>60 then raise exception 'Trop de demandes. Réessayez plus tard ou adressez-vous à notre équipe.'; end if;
    if exists(select 1 from blanco_private.loyalty_members where phone=phone_text) then raise exception 'Impossible de créer cette carte. Adressez-vous à notre équipe pour la retrouver.'; end if;
    code_text:='BL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5))||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
    begin
      insert into blanco_private.loyalty_members(name,phone,code,token_hash) values(name_text,phone_text,code_text,key_hash) returning * into m;
    exception when unique_violation then raise exception 'Impossible de créer cette carte. Adressez-vous à notre équipe pour la retrouver.'; end;
    return jsonb_build_object('member',blanco_private.loyalty_view(m.id,false),'program',to_jsonb(cfg));
  end if;

  if uid is null or not staff then raise exception 'Accès réservé à l’équipe Blanco.'; end if;
  if action='access' then return jsonb_build_object('owner',owner,'program',to_jsonb(cfg)); end if;
  if action='search' then
    needle:=lower(trim(coalesce(payload->>'query',''))); offs:=greatest(0,least(coalesce((payload->>'offset')::int,0),100000));
    select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'code',x.code,'name',x.name,'phone',x.phone,'stamps',case when x.cycle_expires_at<=now() then 0 else x.stamps end,'goal',coalesce((x.cycle_rules->>'goal')::int,cfg.goal),'rewards',(select count(*) from blanco_private.loyalty_rewards rw where rw.member_id=x.id and not rw.void and rw.redeemed_at is null and rw.expires_at>now())) order by x.created_at desc),'[]') into list from (select * from blanco_private.loyalty_members where needle='' or strpos(lower(name),needle)>0 or strpos(lower(code),needle)>0 or (length(regexp_replace(needle,'\D','','g'))>=4 and strpos(phone,regexp_replace(needle,'\D','','g'))>0) order by created_at desc limit 20 offset offs) x;
    select jsonb_build_object('members',(select count(*) from blanco_private.loyalty_members),'stamps',(select coalesce(sum(delta),0) from blanco_private.loyalty_events where kind in ('stamp','undo')),'ready',(select count(*) from blanco_private.loyalty_rewards where not void and redeemed_at is null and expires_at>now()),'redeemed',(select count(*) from blanco_private.loyalty_rewards where not void and redeemed_at is not null)) into stats;
    return jsonb_build_object('members',list,'stats',stats,'owner',owner,'program',to_jsonb(cfg));
  end if;
  if action='save_program' then
    if not owner then raise exception 'Seul le responsable peut modifier le programme.'; end if;
    cfg_value:=payload->'program';requested_revision:=(cfg_value->>'revision')::int;
    if cfg_value is null or not (cfg_value ?& array['revision','enabled','title','goal','window_days','reward_kind','reward_value','reward_label','max_price_cents','reward_days','next_day','daily_limit','eligible_text']) or exists(select 1 from jsonb_each(cfg_value) where value='null'::jsonb) or jsonb_typeof(cfg_value)<>'object' or length(trim(cfg_value->>'title')) not between 1 and 100 or (cfg_value->>'goal')::int not between 2 and 30 or (cfg_value->>'window_days')::int not between 1 and 365 or cfg_value->>'reward_kind' not in ('drink','percent','fixed') or (cfg_value->>'reward_value')::int not between 0 and 100000 or (cfg_value->>'max_price_cents')::int not between 0 and 100000 or (cfg_value->>'reward_days')::int not between 1 and 365 or (cfg_value->>'daily_limit')::int not between 1 and 200 or length(trim(cfg_value->>'reward_label')) not between 1 and 120 or length(trim(cfg_value->>'eligible_text')) not between 1 and 500 then raise exception 'Vérifiez les règles du programme.'; end if;
    if (cfg_value->>'reward_kind'='percent' and (cfg_value->>'reward_value')::int not between 1 and 100) or (cfg_value->>'reward_kind'='fixed' and (cfg_value->>'reward_value')::int<1) then raise exception 'Vérifiez la valeur du cadeau.'; end if;
    update blanco_private.loyalty_program set enabled=(cfg_value->>'enabled')::boolean,title=trim(cfg_value->>'title'),goal=(cfg_value->>'goal')::int,window_days=(cfg_value->>'window_days')::int,reward_kind=cfg_value->>'reward_kind',reward_value=(cfg_value->>'reward_value')::int,max_price_cents=(cfg_value->>'max_price_cents')::int,reward_label=trim(cfg_value->>'reward_label'),reward_days=(cfg_value->>'reward_days')::int,next_day=(cfg_value->>'next_day')::boolean,daily_limit=(cfg_value->>'daily_limit')::int,eligible_text=trim(cfg_value->>'eligible_text'),revision=revision+1,updated_at=now() where id=true and revision=requested_revision returning * into cfg;
    if not found then raise exception 'Le programme a changé. Rechargez avant de réessayer.'; end if;
    return jsonb_build_object('program',to_jsonb(cfg));
  end if;
  if action='staff' then
    if not owner then raise exception 'Accès responsable requis.'; end if;
    if payload ? 'email' then
      select id into reward_key from auth.users where lower(email)=lower(trim(payload->>'email')) and email_confirmed_at is not null;
      if reward_key is null then raise exception 'Créez et confirmez ce compte dans Supabase Authentication avant de lui donner accès.'; end if;
      insert into blanco_private.loyalty_staff(user_id,active) values(reward_key,coalesce((payload->>'active')::boolean,true)) on conflict(user_id) do update set active=excluded.active;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('email',u.email,'active',s.active)),'[]') into list from blanco_private.loyalty_staff s join auth.users u on u.id=s.user_id;
    return jsonb_build_object('staff',list);
  end if;

  code_text:=upper(trim(coalesce(payload->>'code','')));
  select * into m from blanco_private.loyalty_members where code=code_text for update;
  if not found then raise exception 'Carte introuvable. Vérifiez le code ou cherchez le prénom.'; end if;
  if action='member' then return jsonb_build_object('member',blanco_private.loyalty_view(m.id,true),'owner',owner,'program',to_jsonb(cfg)); end if;
  if action='recover' then
    if not owner then raise exception 'La récupération est réservée au responsable.'; end if;
    if coalesce((payload->>'verified')::boolean,false)=false or (payload->>'last4') is distinct from right(m.phone,4) then raise exception 'Vérifiez avec le client les quatre derniers chiffres de son téléphone.'; end if;
    key_text:=payload->>'key';if key_text is null or key_text !~ '^[a-f0-9]{64}$' then raise exception 'Lien invalide.'; end if;
    update blanco_private.loyalty_members set token_hash=encode(sha256(convert_to(key_text,'UTF8')),'hex'),updated_at=now() where id=m.id;
    insert into blanco_private.loyalty_events(member_id,actor_id,kind) values(m.id,uid,'recover');
    return jsonb_build_object('member',blanco_private.loyalty_view(m.id,true));
  end if;
  if action='erase' then
    if not owner or (payload->>'confirm') is distinct from m.code then raise exception 'Confirmation du responsable requise.'; end if;
    delete from blanco_private.loyalty_members where id=m.id;
    return jsonb_build_object('erased',true);
  end if;
  if action not in ('stamp','redeem','undo') then raise exception 'Action inconnue.'; end if;
  request_key:=(payload->>'requestId')::uuid;
  if request_key is null then raise exception 'Identifiant de transaction manquant.'; end if;
  select * into e from blanco_private.loyalty_events where request_id=request_key;
  if found then
    if e.member_id<>m.id or e.actor_id<>uid or e.kind<>action or (action='stamp' and e.delta is distinct from (payload->>'amount')::int) or (action='redeem' and e.reward_id is distinct from (payload->>'rewardId')::uuid) then raise exception 'Identifiant de transaction déjà utilisé.'; end if;
    return jsonb_build_object('member',blanco_private.loyalty_view(m.id,true),'replayed',true);
  end if;
  before_state:=jsonb_build_object('stamps',m.stamps,'cycle_started_at',m.cycle_started_at,'cycle_expires_at',m.cycle_expires_at,'cycle_rules',m.cycle_rules,'total_stamps',m.total_stamps);
  if action='stamp' then
    if not cfg.enabled then raise exception 'Le programme est en pause.'; end if;
    amount:=(payload->>'amount')::int;
    if amount is null or amount not between 1 and 50 or coalesce((payload->>'paid')::boolean,false)=false then raise exception 'Confirmez le nombre de boissons payées (1 à 50).'; end if;
    select coalesce(sum(delta),0) into hits from blanco_private.loyalty_events where member_id=m.id and kind in ('stamp','undo') and (created_at at time zone 'Europe/Paris')::date=(now() at time zone 'Europe/Paris')::date;
    if hits+amount>cfg.daily_limit then raise exception 'Limite quotidienne atteinte pour cette carte.'; end if;
    if m.cycle_expires_at<=now() then m.stamps:=0;m.cycle_started_at:=null;m.cycle_expires_at:=null;m.cycle_rules:=null; end if;
    remaining:=amount;
    while remaining>0 loop
      if m.cycle_rules is null then m.cycle_rules:=to_jsonb(cfg);m.cycle_started_at:=now();m.cycle_expires_at:=now()+make_interval(days=>cfg.window_days); end if;
      take_count:=least(remaining,(m.cycle_rules->>'goal')::int-m.stamps);m.stamps:=m.stamps+take_count;remaining:=remaining-take_count;
      if m.stamps=(m.cycle_rules->>'goal')::int then
        rules:=m.cycle_rules;
        insert into blanco_private.loyalty_rewards(member_id,rules,available_at,expires_at) values(m.id,rules,case when (rules->>'next_day')::boolean then (((now() at time zone 'Europe/Paris')::date+1)::timestamp at time zone 'Europe/Paris') else now() end,now()+make_interval(days=>(rules->>'reward_days')::int)) returning id into reward_key;
        reward_keys:=reward_keys||jsonb_build_array(reward_key);m.stamps:=0;m.cycle_started_at:=null;m.cycle_expires_at:=null;m.cycle_rules:=null;
      end if;
    end loop;
    update blanco_private.loyalty_members set stamps=m.stamps,cycle_started_at=m.cycle_started_at,cycle_expires_at=m.cycle_expires_at,cycle_rules=m.cycle_rules,total_stamps=total_stamps+amount,updated_at=now() where id=m.id;
    insert into blanco_private.loyalty_events(request_id,member_id,actor_id,kind,delta,metadata) values(request_key,m.id,uid,'stamp',amount,jsonb_build_object('before',before_state,'rewards',reward_keys));
  elsif action='redeem' then
    select * into r from blanco_private.loyalty_rewards where id=(payload->>'rewardId')::uuid and member_id=m.id for update;
    if not found or r.void or r.redeemed_at is not null or r.expires_at<=now() or r.available_at>now() then raise exception 'Ce cadeau est indisponible, expiré ou déjà utilisé.'; end if;
    update blanco_private.loyalty_rewards set redeemed_at=now(),redeemed_by=uid where id=r.id;
    insert into blanco_private.loyalty_events(request_id,member_id,actor_id,kind,reward_id) values(request_key,m.id,uid,'redeem',r.id);
  elsif action='undo' then
    select * into e from blanco_private.loyalty_events where member_id=m.id order by sequence desc limit 1;
    if e.id is null or e.id is distinct from (payload->>'eventId')::uuid or e.kind not in ('stamp','redeem') or e.created_at<=now()-interval '15 minutes' or (not owner and e.actor_id<>uid) or exists(select 1 from blanco_private.loyalty_events where undo_of=e.id) then raise exception 'Cette opération ne peut plus être annulée.'; end if;
    if e.kind='stamp' then
      if exists(select 1 from blanco_private.loyalty_rewards where id in(select value::uuid from jsonb_array_elements_text(e.metadata->'rewards')) and redeemed_at is not null) then raise exception 'Un cadeau issu de cette opération a déjà été utilisé.'; end if;
      update blanco_private.loyalty_rewards set void=true where id in(select value::uuid from jsonb_array_elements_text(e.metadata->'rewards'));
      before_state:=e.metadata->'before';
      update blanco_private.loyalty_members set stamps=(before_state->>'stamps')::int,cycle_started_at=(before_state->>'cycle_started_at')::timestamptz,cycle_expires_at=(before_state->>'cycle_expires_at')::timestamptz,cycle_rules=nullif(before_state->'cycle_rules','null'::jsonb),total_stamps=(before_state->>'total_stamps')::int,updated_at=now() where id=m.id;
    else update blanco_private.loyalty_rewards set redeemed_at=null,redeemed_by=null where id=e.reward_id; end if;
    insert into blanco_private.loyalty_events(request_id,member_id,actor_id,kind,delta,undo_of) values(request_key,m.id,uid,'undo',-e.delta,e.id);
  end if;
  return jsonb_build_object('member',blanco_private.loyalty_view(m.id,true),'replayed',false);
end $$;

revoke all on all functions in schema blanco_private from public,anon,authenticated;
grant execute on function blanco_private.loyalty_api(text,jsonb) to anon,authenticated;
create function public.loyalty_api(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select blanco_private.loyalty_api(action,payload); $$;
revoke all on function public.loyalty_api(text,jsonb) from public;
grant execute on function public.loyalty_api(text,jsonb) to anon,authenticated;
commit;
