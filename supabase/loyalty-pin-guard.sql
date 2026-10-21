-- Keep retrying signup from accepting consumed reset links or serving as a PIN oracle.
begin;
create or replace function blanco_private.loyalty_api(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  m blanco_private.loyalty_members%rowtype; a blanco_private.loyalty_auth%rowtype;
  r blanco_private.loyalty_rewards%rowtype; approval blanco_private.loyalty_reward_approvals%rowtype;
  response jsonb; cfg jsonb; key_hash text; pin_text text; phone_text text; approval_code text;
  invalid_message text:='Téléphone ou PIN incorrect. Si vous avez oublié votre PIN, contactez la direction de Blanco.';
begin
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>16000 then raise exception 'Demande invalide.'; end if;
  select to_jsonb(p) into cfg from blanco_private.loyalty_program p where id=true;
  pin_text:=coalesce(payload->>'pin','');

  if action='login' then
    phone_text:=regexp_replace(coalesce(payload->>'phone',''),'[^0-9+]','','g');
    if phone_text like '00%' then phone_text:='+'||substr(phone_text,3); elsif phone_text like '0%' then phone_text:='+33'||substr(phone_text,2); elsif phone_text !~ '^\+' then phone_text:='+'||phone_text; end if;
    if phone_text !~ '^\+[0-9]{8,15}$' or coalesce(payload->>'key','') !~ '^[a-f0-9]{64}$' or coalesce(payload->>'website','')<>'' then return jsonb_build_object('error',invalid_message); end if;
    if not blanco_private.loyalty_limit('pin',phone_text) then return jsonb_build_object('error','Trop de tentatives. Réessayez dans 15 minutes ou adressez-vous à notre équipe.'); end if;
    if pin_text !~ '^[0-9]{6}$' then return jsonb_build_object('error',invalid_message); end if;
    select * into m from blanco_private.loyalty_members where phone=phone_text for update;
    if not found then perform extensions.crypt(pin_text,extensions.gen_salt('bf',12)); return jsonb_build_object('error',invalid_message); end if;
    select * into a from blanco_private.loyalty_auth where member_id=m.id;
    if a.pin_hash is null then perform extensions.crypt(pin_text,extensions.gen_salt('bf',12)); return jsonb_build_object('error',invalid_message); end if;
    if extensions.crypt(pin_text,a.pin_hash) is distinct from a.pin_hash then return jsonb_build_object('error',invalid_message); end if;
    key_hash:=encode(sha256(convert_to(payload->>'key','UTF8')),'hex');
    if exists(select 1 from blanco_private.loyalty_device_keys where token_hash=key_hash and member_id<>m.id) then return jsonb_build_object('error',invalid_message); end if;
    insert into blanco_private.loyalty_device_keys(token_hash,member_id,auth_version) values(key_hash,m.id,a.version)
      on conflict(token_hash) do update set expires_at=now()+interval '180 days',created_at=clock_timestamp(),auth_version=excluded.auth_version;
    delete from blanco_private.loyalty_device_keys where member_id=m.id and (expires_at<=now() or token_hash in
      (select token_hash from blanco_private.loyalty_device_keys where member_id=m.id order by created_at desc,token_hash limit all offset 10));
    return jsonb_build_object('member',blanco_private.loyalty_view(m.id,false),'program',cfg);
  end if;

  if action in ('card','activate','reward_authorize') then
    if coalesce(payload->>'key','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','Cette carte est introuvable. Connectez-vous avec votre téléphone et votre PIN, ou contactez la direction.'); end if;
    key_hash:=encode(sha256(convert_to(payload->>'key','UTF8')),'hex');
    if action='activate' then
      if pin_text !~ '^[0-9]{6}$' or pin_text ~ '^([0-9])\1{5}$' or pin_text in ('123456','654321') or coalesce(payload->>'deviceKey','') !~ '^[a-f0-9]{64}$' or payload->>'deviceKey'=payload->>'key' then return jsonb_build_object('error','Choisissez un PIN personnel de 6 chiffres, sans suite évidente.'); end if;
      select lm.* into m from blanco_private.loyalty_members lm join blanco_private.loyalty_auth la on la.member_id=lm.id
        where la.recovery_hash=key_hash and (la.recovery_expires_at is null or la.recovery_expires_at>now()) for update of lm,la;
      if not found then return jsonb_build_object('error','Ce lien de réinitialisation a déjà été utilisé ou remplacé. Connectez-vous avec votre PIN ou demandez un nouveau lien à la direction.'); end if;
      update blanco_private.loyalty_auth set pin_hash=extensions.crypt(pin_text,extensions.gen_salt('bf',12)),recovery_hash=null,recovery_expires_at=null where member_id=m.id returning * into a;
      key_hash:=encode(sha256(convert_to(payload->>'deviceKey','UTF8')),'hex');
      insert into blanco_private.loyalty_device_keys(token_hash,member_id,auth_version) values(key_hash,m.id,a.version);
      return jsonb_build_object('member',blanco_private.loyalty_view(m.id,false),'program',cfg);
    end if;
    select lm.* into m from blanco_private.loyalty_members lm join blanco_private.loyalty_device_keys k on k.member_id=lm.id
      join blanco_private.loyalty_auth la on la.member_id=lm.id
      where k.token_hash=key_hash and k.expires_at>now() and k.auth_version=la.version and la.pin_hash is not null;
    if not found then
      if action='card' then
        select lm.* into m from blanco_private.loyalty_members lm join blanco_private.loyalty_auth la on la.member_id=lm.id
          where la.recovery_hash=key_hash and (la.recovery_expires_at is null or la.recovery_expires_at>now());
        if found then return jsonb_build_object('setupRequired',true,'setupName',m.name,'program',cfg); end if;
      end if;
      return jsonb_build_object('error','Cette carte est introuvable. Connectez-vous avec votre téléphone et votre PIN, ou contactez la direction.');
    end if;
    if action='card' then return jsonb_build_object('member',blanco_private.loyalty_view(m.id,false),'program',cfg); end if;
    if not blanco_private.loyalty_limit('pin',m.phone) then return jsonb_build_object('error','Trop de tentatives. Réessayez dans 15 minutes ou adressez-vous à notre équipe.'); end if;
    select * into m from blanco_private.loyalty_members where id=m.id for update;
    select * into a from blanco_private.loyalty_auth where member_id=m.id;
    -- Re-check session version under the member lock, including a concurrent reset.
    if not exists(select 1 from blanco_private.loyalty_device_keys where token_hash=key_hash and member_id=m.id and auth_version=a.version and expires_at>now())
      or pin_text !~ '^[0-9]{6}$' or a.pin_hash is null or extensions.crypt(pin_text,a.pin_hash) is distinct from a.pin_hash then return jsonb_build_object('error',invalid_message); end if;
    select * into r from blanco_private.loyalty_rewards where id=(payload->>'rewardId')::uuid and member_id=m.id;
    if not found or r.void or r.redeemed_at is not null or r.available_at>now() or r.expires_at<=now() then return jsonb_build_object('error','Ce cadeau est indisponible, expiré ou déjà utilisé.'); end if;
    approval_code:=lpad(((get_byte(extensions.gen_random_bytes(1),0)::bigint*65536+get_byte(extensions.gen_random_bytes(1),0)::bigint*256+get_byte(extensions.gen_random_bytes(1),0))%1000000)::text,6,'0');
    insert into blanco_private.loyalty_reward_approvals(reward_id,code_hash,expires_at)
      values(r.id,encode(sha256(convert_to(m.id::text||'/'||r.id::text||'/'||approval_code,'UTF8')),'hex'),now()+interval '5 minutes')
      on conflict(reward_id) do update set code_hash=excluded.code_hash,expires_at=excluded.expires_at,used_at=null;
    return jsonb_build_object('approvalCode',approval_code,'approvalExpiresAt',now()+interval '5 minutes');
  end if;

  if action='register' then
    if pin_text !~ '^[0-9]{6}$' or pin_text ~ '^([0-9])\1{5}$' or pin_text in ('123456','654321') then return jsonb_build_object('error','Choisissez un PIN personnel de 6 chiffres, sans suite évidente.'); end if;
    key_hash:=encode(sha256(convert_to(coalesce(payload->>'key',''),'UTF8')),'hex');
    select * into m from blanco_private.loyalty_members where token_hash=key_hash for update;
    if found then
      -- A consumed reset link must never become a PIN guessing endpoint via registration.
      if not exists(select 1 from blanco_private.loyalty_device_keys k join blanco_private.loyalty_auth la on la.member_id=k.member_id where k.token_hash=key_hash and k.member_id=m.id and k.expires_at>now() and k.auth_version=la.version and la.pin_hash is not null) then return jsonb_build_object('error',invalid_message); end if;
      return jsonb_build_object('member',blanco_private.loyalty_view(m.id,false),'program',cfg);
    end if;
    response:=blanco_private.loyalty_api_base(action,payload);
    select * into m from blanco_private.loyalty_members where token_hash=key_hash for update;
    if exists(select 1 from blanco_private.loyalty_auth where member_id=m.id) then
      -- Registration retries may re-open the original session, but never overwrite a PIN.
      select * into a from blanco_private.loyalty_auth where member_id=m.id;
      if not exists(select 1 from blanco_private.loyalty_device_keys k where k.token_hash=key_hash and k.member_id=m.id and k.expires_at>now() and k.auth_version=a.version) or a.pin_hash is null then return jsonb_build_object('error',invalid_message); end if;
    else
      insert into blanco_private.loyalty_auth(member_id,pin_hash) values(m.id,extensions.crypt(pin_text,extensions.gen_salt('bf',12))) returning * into a;
    end if;
    insert into blanco_private.loyalty_device_keys(token_hash,member_id,auth_version) values(key_hash,m.id,a.version) on conflict(token_hash) do nothing;
    return response;
  end if;

  if action='redeem' then
    perform blanco_private.loyalty_api_base('access','{}');
    select * into m from blanco_private.loyalty_members where code=upper(trim(coalesce(payload->>'code',''))) for update;
    if not found then raise exception 'Carte introuvable. Vérifiez le code ou cherchez le prénom.'; end if;
    if exists(select 1 from blanco_private.loyalty_events where request_id=(payload->>'requestId')::uuid) then return blanco_private.loyalty_api_base(action,payload); end if;
    if not blanco_private.loyalty_limit('redeem',m.phone) then return jsonb_build_object('error','Trop de tentatives. Réessayez dans 15 minutes ou adressez-vous à notre équipe.'); end if;
    select * into approval from blanco_private.loyalty_reward_approvals where reward_id=(payload->>'rewardId')::uuid for update;
    if not found or approval.used_at is not null or approval.expires_at<=now() or coalesce(payload->>'approvalCode','') !~ '^[0-9]{6}$'
      or approval.code_hash is distinct from encode(sha256(convert_to(m.id::text||'/'||(payload->>'rewardId')||'/'||(payload->>'approvalCode'),'UTF8')),'hex') then
      return jsonb_build_object('error','Demandez au client son code cadeau temporaire. Le QR seul ne permet pas d’utiliser un cadeau.');
    end if;
    response:=blanco_private.loyalty_api_base(action,payload);
    update blanco_private.loyalty_reward_approvals set used_at=now() where reward_id=approval.reward_id;
    return response;
  end if;

  response:=blanco_private.loyalty_api_base(action,payload);
  if action='recover' then
    select * into m from blanco_private.loyalty_members where id=(response->'member'->>'id')::uuid;
    insert into blanco_private.loyalty_auth(member_id,version,recovery_hash,recovery_expires_at)
      values(m.id,1,encode(sha256(convert_to(payload->>'key','UTF8')),'hex'),null)
      on conflict(member_id) do update set version=loyalty_auth.version+1,pin_hash=null,recovery_hash=excluded.recovery_hash,recovery_expires_at=excluded.recovery_expires_at;
    delete from blanco_private.loyalty_device_keys where member_id=m.id;
    delete from blanco_private.loyalty_reward_approvals where reward_id in(select id from blanco_private.loyalty_rewards where member_id=m.id);
    return response||jsonb_build_object('recoveryExpiresAt',null);
  end if;
  return response;
end $$;
commit;
