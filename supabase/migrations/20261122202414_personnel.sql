-- Personnel is private. Public callers can only use a scoped session after link + PIN login.
create schema if not exists blanco_private;
create table blanco_private.hr_employees (
 id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null default '',
 profile jsonb not null default '{}', weekly_hours numeric(5,2) not null default 0 check(weekly_hours between 0 and 84),
 active boolean not null default true, version integer not null default 1,
 link_hash text unique, pin_hash text, auth_version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table blanco_private.hr_sessions (
 key_hash text primary key, employee_id uuid not null references blanco_private.hr_employees(id),
 auth_version integer not null, expires_at timestamptz not null default now()+interval '30 days'
);
create index hr_sessions_employee on blanco_private.hr_sessions(employee_id);
create table blanco_private.hr_limits (id text primary key,hits integer not null,expires_at timestamptz not null);
create table blanco_private.hr_days (
 employee_id uuid not null references blanco_private.hr_employees(id), work_date date not null,
 approved jsonb, proposed jsonb, proposal_state text not null default 'none' check(proposal_state in ('none','draft','pending','returned')),
 review_note text not null default '', version integer not null default 0,
 updated_at timestamptz not null default now(), primary key(employee_id,work_date)
);
create table blanco_private.hr_audit (
 id uuid primary key default gen_random_uuid(),employee_id uuid not null references blanco_private.hr_employees(id),
 work_date date, action text not null,actor text not null, before_data jsonb,after_data jsonb,
 note text not null default '',created_at timestamptz not null default now()
);
create index hr_audit_employee on blanco_private.hr_audit(employee_id,created_at desc);
create table blanco_private.hr_reports (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references blanco_private.hr_employees(id),
 month date not null,version integer not null,request_id uuid not null unique,snapshot jsonb not null,
 file_path text,generated_at timestamptz not null default now(),unique(employee_id,month,version)
);
create table blanco_private.hr_documents (
 id uuid primary key default gen_random_uuid(),employee_id uuid not null references blanco_private.hr_employees(id),
 name text not null,path text not null unique,created_at timestamptz not null default now()
);
create index hr_documents_employee on blanco_private.hr_documents(employee_id);
do $$declare t text;begin foreach t in array array['hr_employees','hr_sessions','hr_limits','hr_days','hr_audit','hr_reports','hr_documents'] loop
 execute format('alter table blanco_private.%I enable row level security',t);
 execute format('revoke all on blanco_private.%I from public,anon,authenticated',t);
 execute format('create policy deny_direct on blanco_private.%I for all to anon,authenticated using(false) with check(false)',t);
end loop;end$$;

create function blanco_private.hr_instant(day date,clock text,offset_days integer default 0) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare local_time timestamp; value timestamptz;
begin
 if clock !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Complétez les horaires.';end if;
 local_time:=(day+offset_days)+clock::time;value:=local_time at time zone 'Europe/Paris';
 if value at time zone 'Europe/Paris'<>local_time then raise exception 'Heure inexistante lors du changement d’heure.';end if;
 return value;
end$$;
create function blanco_private.hr_calculate(day date,data jsonb,complete boolean default true) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare h jsonb; s timestamptz; e timestamptz; b timestamptz; c timestamptz; overnight boolean;
begin
 if jsonb_typeof(data)<>'object' or octet_length(data::text)>5000 or coalesce(data->>'kind','') not in ('work','paid_leave','sick','unpaid','rest','other') then raise exception 'Journée invalide.';end if;
 h:=jsonb_build_object('kind',data->>'kind','arrival',left(coalesce(data->>'arrival',''),5),'breakStart',left(coalesce(data->>'breakStart',''),5),'breakEnd',left(coalesce(data->>'breakEnd',''),5),'departure',left(coalesce(data->>'departure',''),5),'overnight',coalesce((data->>'overnight')::boolean,false),'note',left(coalesce(data->>'note',''),1000));
 if not complete then return h;end if;
 if h->>'kind'<>'work' then return h||jsonb_build_object('arrival','','breakStart','','breakEnd','','departure','','overnight',false,'minutes',0,'pauseMinutes',0);end if;
 overnight:=(h->>'overnight')::boolean;
 s:=blanco_private.hr_instant(day,h->>'arrival',0);e:=blanco_private.hr_instant(day,h->>'departure',case when overnight then 1 else 0 end);
 if e<=s or e-s>interval '25 hours' then raise exception 'Vérifiez le départ et l’option lendemain.';end if;
 if (h->>'breakStart'='')<>(h->>'breakEnd'='') then raise exception 'Renseignez les deux horaires de pause.';end if;
 if h->>'breakStart'<>'' then
 b:=blanco_private.hr_instant(day,h->>'breakStart',case when overnight and h->>'breakStart'<h->>'arrival' then 1 else 0 end);
 c:=blanco_private.hr_instant(day,h->>'breakEnd',case when overnight and h->>'breakEnd'<h->>'arrival' then 1 else 0 end);
 if b<s or c<=b or c>e then raise exception 'La pause doit être comprise dans la journée de travail.';end if;
 end if;
 return h||jsonb_build_object('minutes',extract(epoch from (e-s-coalesce(c-b,interval '0 minutes')))/60,'pauseMinutes',coalesce(extract(epoch from(c-b))/60,0),'startUtc',s,'endUtc',e,'breakStartUtc',b,'breakEndUtc',c);
end$$;
create function blanco_private.hr_limit(identity text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare fingerprint text; n integer; p integer; headers jsonb;
begin
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 fingerprint:=encode(sha256(convert_to(left(coalesce(headers->>'cf-connecting-ip',headers->>'x-forwarded-for','unknown'),200),'UTF8')),'hex');
 delete from blanco_private.hr_limits where expires_at<now()-interval '1 day';
 insert into blanco_private.hr_limits values('id:'||identity,1,now()+interval '15 minutes') on conflict(id) do update set hits=case when hr_limits.expires_at<=now() then 1 else hr_limits.hits+1 end,expires_at=case when hr_limits.expires_at<=now() then now()+interval '15 minutes' else hr_limits.expires_at end returning hits into n;
 insert into blanco_private.hr_limits values('ip:'||fingerprint,1,now()+interval '15 minutes') on conflict(id) do update set hits=case when hr_limits.expires_at<=now() then 1 else hr_limits.hits+1 end,expires_at=case when hr_limits.expires_at<=now() then now()+interval '15 minutes' else hr_limits.expires_at end returning hits into p;
 return n<=10 and p<=60;
end$$;
create function blanco_private.hr_api(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
<<hr>>
declare
 employee blanco_private.hr_employees%rowtype; rec blanco_private.hr_days%rowtype; report blanco_private.hr_reports%rowtype;
 admin boolean:=false; employee_id uuid; actor text; month_start date; month_end date; first_day date; last_day date; workday date;
 rows jsonb; result jsonb; data jsonb; before_data jsonb; new_data jsonb; profile jsonb; note text; mode text; pin text; token text; hashed text; next_version integer; key text;
begin
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>25000 then raise exception 'Demande invalide.';end if;
 admin:=exists(select 1 from public.menu_admins where user_id=auth.uid());
 if action='employee_login' then
 token:=coalesce(payload->>'link','');pin:=coalesce(payload->>'pin','');
 hashed:=encode(sha256(convert_to(token,'UTF8')),'hex');
 if not blanco_private.hr_limit(hashed) then return jsonb_build_object('error','Trop de tentatives. Réessayez dans 15 minutes ou contactez la direction.');end if;
 select * into employee from blanco_private.hr_employees where link_hash=hashed and active for update;
 if token !~ '^[a-f0-9]{64}$' or pin !~ '^[0-9]{6}$' or not found or employee.pin_hash is null then return jsonb_build_object('error','Lien ou PIN incorrect. Contactez la direction si nécessaire.');end if;
 if extensions.crypt(pin,employee.pin_hash)<>employee.pin_hash then return jsonb_build_object('error','Lien ou PIN incorrect. Contactez la direction si nécessaire.');end if;
 token:=coalesce(payload->>'session','');if token !~ '^[a-f0-9]{64}$' then raise exception 'Session invalide.';end if;
 delete from blanco_private.hr_sessions where expires_at<now();
 insert into blanco_private.hr_sessions(key_hash,employee_id,auth_version) values(encode(sha256(convert_to(token,'UTF8')),'hex'),employee.id,employee.auth_version);
 return jsonb_build_object('ok',true,'employee',jsonb_build_object('id',employee.id,'first_name',employee.first_name,'last_name',employee.last_name,'weekly_hours',employee.weekly_hours));
 end if;
 if action like 'employee_%' then
 token:=coalesce(payload->>'session','');
 select e.* into employee from blanco_private.hr_employees e join blanco_private.hr_sessions s on s.employee_id=e.id where s.key_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and s.expires_at>now() and s.auth_version=e.auth_version and e.active;
 if token !~ '^[a-f0-9]{64}$' or not found then raise exception 'Votre session a expiré. Reconnectez-vous avec votre lien et votre PIN.';end if;
 employee_id:=employee.id;actor:='employee:'||employee.id;admin:=false;
 if action='employee_logout' then delete from blanco_private.hr_sessions where key_hash=encode(sha256(convert_to(token,'UTF8')),'hex');return jsonb_build_object('ok',true);end if;
 else
 if not admin then raise exception 'Accès réservé à la direction de Blanco.';end if;
 actor:='admin:'||auth.uid();
 if payload ? 'employeeId' then employee_id:=(payload->>'employeeId')::uuid;select * into employee from blanco_private.hr_employees where id=employee_id for update;if not found then raise exception 'Employé introuvable.';end if;end if;
 end if;
 if action='employee_save' then action:='day_save';end if;
 if action='employee_month' then action:='month';end if;
 if action in ('dashboard','month','report_create','reports') then
 if coalesce(payload->>'month','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Mois invalide.';end if;
 month_start:=((payload->>'month')||'-01')::date;month_end:=(month_start+interval '1 month')::date;
 first_day:=month_start-(extract(isodow from month_start)::integer-1)-1;
 last_day:=month_end+(7-extract(isodow from month_end-1)::integer);
 end if;
 if action='dashboard' then
 select coalesce(jsonb_agg(to_jsonb(e)-array['pin_hash','link_hash','auth_version'] order by not active,first_name),'[]') into rows from blanco_private.hr_employees e;
 select coalesce(jsonb_agg(to_jsonb(d)),'[]') into data from blanco_private.hr_days d where work_date>=first_day and work_date<last_day;
 return jsonb_build_object('employees',rows,'days',data);
 elsif action='profile_save' then
 data:=payload->'employee';profile:=coalesce(data->'profile','{}');
 if jsonb_typeof(data)<>'object' or jsonb_typeof(profile)<>'object' or length(trim(coalesce(data->>'first_name','')))=0 or length(data->>'first_name')>100 or length(coalesce(data->>'last_name',''))>100 then raise exception 'Renseignez le prénom (100 caractères maximum).';end if;
 if jsonb_typeof(data->'active')<>'boolean' or (data->>'weekly_hours')::numeric not between 0 and 84 then raise exception 'Vérifiez les heures du contrat.';end if;
 for key in select jsonb_object_keys(profile) loop
 if key not in ('birthDate','address','phone','alternatePhone','email','emergencyName','emergencyRelation','emergencyPhone','contractType','contractStart','contractEnd','notes') or jsonb_typeof(profile->key)<>'string' or length(profile->>key)>2000 then raise exception 'Informations personnelles invalides.';end if;end loop;
 if coalesce(profile->>'birthDate','')<>'' and ((profile->>'birthDate')::date<'1900-01-01'::date or (profile->>'birthDate')::date>current_date) then raise exception 'Date de naissance invalide.';end if;
 if coalesce(profile->>'contractStart','')<>'' and coalesce(profile->>'contractEnd','')<>'' and (profile->>'contractEnd')::date<(profile->>'contractStart')::date then raise exception 'Fin du contrat antérieure au début.';end if;
 before_data:=case when employee_id is null then null else to_jsonb(employee)-array['pin_hash','link_hash','auth_version'] end;
 if employee_id is null then insert into blanco_private.hr_employees(first_name,last_name,profile,weekly_hours,active) values(trim(data->>'first_name'),trim(coalesce(data->>'last_name','')),profile,(data->>'weekly_hours')::numeric,(data->>'active')::boolean) returning id into employee_id;
 else
 if employee.version<>coalesce((data->>'version')::integer,-1) then raise exception 'Fiche modifiée ailleurs. Rechargez avant de modifier.';end if;
 update blanco_private.hr_employees set first_name=trim(data->>'first_name'),last_name=trim(coalesce(data->>'last_name','')),profile=hr.profile,weekly_hours=(data->>'weekly_hours')::numeric,active=(data->>'active')::boolean,version=version+1,updated_at=now() where id=employee_id;
 end if;
 if employee.active and not (data->>'active')::boolean then
 update blanco_private.hr_employees set auth_version=auth_version+1,link_hash=null,pin_hash=null where id=employee_id;
 delete from blanco_private.hr_sessions where hr_sessions.employee_id=hr.employee_id;
 end if;
 select to_jsonb(e)-array['pin_hash','link_hash','auth_version'] into data from blanco_private.hr_employees e where id=employee_id;
 insert into blanco_private.hr_audit(employee_id,action,actor,before_data,after_data) values(employee_id,'profile',actor,before_data,data);
 return jsonb_build_object('employee',data);
 elsif action in ('access_reset','access_revoke') then
 if employee_id is null then raise exception 'Choisissez un employé.';end if;
 if action='access_reset' then
 pin:=coalesce(payload->>'pin','');if pin !~ '^[0-9]{6}$' or pin in ('000000','111111','222222','333333','444444','555555','666666','777777','888888','999999','123456','654321') then raise exception 'Choisissez un PIN personnel de six chiffres non évidents.';end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 update blanco_private.hr_employees set link_hash=encode(sha256(convert_to(token,'UTF8')),'hex'),pin_hash=extensions.crypt(pin,extensions.gen_salt('bf',10)),auth_version=auth_version+1 where id=employee_id;
 else update blanco_private.hr_employees set link_hash=null,pin_hash=null,auth_version=auth_version+1 where id=employee_id;end if;
 delete from blanco_private.hr_sessions where hr_sessions.employee_id=hr.employee_id;
 insert into blanco_private.hr_audit(employee_id,action,actor) values(employee_id,action,actor);
 return jsonb_build_object('ok',true,'link',case when action='access_reset' then token else null end);
 elsif action='month' then
 select coalesce(jsonb_agg(to_jsonb(d) order by work_date),'[]') into rows from blanco_private.hr_days d where d.employee_id=hr.employee_id and work_date>=first_day and work_date<last_day;
 result:=jsonb_build_object('days',rows,'employee',case when admin then to_jsonb(employee)-array['pin_hash','link_hash','auth_version'] else jsonb_build_object('id',employee.id,'first_name',employee.first_name,'last_name',employee.last_name,'weekly_hours',employee.weekly_hours) end);
 if admin then
 select coalesce(jsonb_agg(to_jsonb(a) order by created_at desc),'[]') into rows from (select * from blanco_private.hr_audit a where a.employee_id=hr.employee_id order by created_at desc limit 100)a;
 result:=result||jsonb_build_object('audit',rows);
 select coalesce(jsonb_agg(to_jsonb(r)-'snapshot' order by generated_at desc),'[]') into rows from blanco_private.hr_reports r where r.employee_id=hr.employee_id and month=month_start;
 result:=result||jsonb_build_object('reports',rows);
 select coalesce(jsonb_agg(to_jsonb(d) order by created_at desc),'[]') into rows from blanco_private.hr_documents d where d.employee_id=hr.employee_id;
 result:=result||jsonb_build_object('documents',rows);
 end if;return result;
 elsif action in ('day_save','day_review','day_discard') then
 if employee_id is null then raise exception 'Choisissez un employé.';end if;
 workday:=(payload->>'date')::date;if workday is null or workday<'2000-01-01' or workday>'2099-12-31' then raise exception 'Date invalide.';end if;
 insert into blanco_private.hr_days(employee_id,work_date) values(employee_id,workday) on conflict do nothing;
 select * into rec from blanco_private.hr_days d where d.employee_id=hr.employee_id and work_date=workday for update;
 if rec.version<>coalesce((payload->>'version')::integer,-1) then raise exception 'Journée modifiée ailleurs. Rechargez la journée pour continuer.';end if;
 before_data:=to_jsonb(rec);note:=left(coalesce(payload->>'reviewNote',''),1000);
 if action='day_save' then
 mode:=coalesce(payload->>'mode','draft');if mode not in ('draft','submit','approve') or (not admin and mode='approve') then raise exception 'Validation réservée à la direction.';end if;
 if mode<>'draft' and workday>(now() at time zone 'Europe/Paris')::date then raise exception 'Les heures réelles ne peuvent pas être validées à l’avance.';end if;
 data:=blanco_private.hr_calculate(workday,payload->'hours',mode<>'draft');
 if mode='approve' and rec.approved is not null and length(trim(note))<3 then raise exception 'Précisez le motif de correction des heures validées.';end if;
 elsif action='day_review' then
 if not admin or rec.proposal_state<>'pending' then raise exception 'Aucune demande à valider.';end if;
 if payload->>'decision'='return' then
 if length(trim(note))<3 then raise exception 'Ajoutez un commentaire pour la correction.';end if;
 update blanco_private.hr_days set proposal_state='returned',review_note=note,version=version+1,updated_at=now() where hr_days.employee_id=hr.employee_id and work_date=workday;
 else
 if payload->>'decision'<>'approve' then raise exception 'Décision invalide.';end if;
 mode:='approve';data:=blanco_private.hr_calculate(workday,rec.proposed,true);
 end if;
 end if;
 if mode='approve' then
 if data->>'kind'='work' and exists(select 1 from blanco_private.hr_days d where d.employee_id=hr.employee_id and work_date between workday-1 and workday+1 and work_date<>workday and approved->>'kind'='work' and (approved->>'startUtc')::timestamptz<(data->>'endUtc')::timestamptz and (approved->>'endUtc')::timestamptz>(data->>'startUtc')::timestamptz) then raise exception 'Ces horaires chevauchent une autre journée validée.';end if;
 update blanco_private.hr_days set approved=data,proposed=null,proposal_state='none',review_note=note,version=version+1,updated_at=now() where hr_days.employee_id=hr.employee_id and work_date=workday;
 elsif action='day_save' then
 update blanco_private.hr_days set proposed=data,proposal_state=case when mode='submit' then 'pending' else 'draft' end,review_note='',version=version+1,updated_at=now() where hr_days.employee_id=hr.employee_id and work_date=workday;
 elsif action='day_discard' then
 update blanco_private.hr_days set proposed=null,proposal_state='none',review_note='',version=version+1,updated_at=now() where hr_days.employee_id=hr.employee_id and work_date=workday;
 end if;
 select to_jsonb(d) into new_data from blanco_private.hr_days d where d.employee_id=hr.employee_id and work_date=workday;
 insert into blanco_private.hr_audit(employee_id,work_date,action,actor,before_data,after_data,note) values(employee_id,workday,action||':'||coalesce(mode,payload->>'decision',''),actor,before_data,new_data,note);
 return jsonb_build_object('day',new_data);
 elsif action='report_create' then
 if employee_id is null then raise exception 'Choisissez un employé.';end if;
 select * into report from blanco_private.hr_reports where request_id=(payload->>'requestId')::uuid;
 if found then if report.employee_id<>employee_id or report.month<>month_start then raise exception 'Identifiant de rapport déjà utilisé.';end if;return jsonb_build_object('report',to_jsonb(report));end if;
 if exists(select 1 from blanco_private.hr_days d where d.employee_id=hr.employee_id and work_date>=month_start-1 and work_date<month_end and proposal_state<>'none') then raise exception 'Validez, retournez puis corrigez, ou retirez les demandes en cours avant le relevé définitif.';end if;
 perform pg_advisory_xact_lock(hashtextextended(employee_id::text||month_start::text,0));
 select coalesce(max(version),0)+1 into next_version from blanco_private.hr_reports r where r.employee_id=hr.employee_id and month=month_start;
 select coalesce(jsonb_agg(to_jsonb(d) order by work_date),'[]') into rows from blanco_private.hr_days d where d.employee_id=hr.employee_id and work_date>=first_day and work_date<last_day and approved is not null;
 data:=jsonb_build_object('employee',to_jsonb(employee)-array['pin_hash','link_hash','auth_version'],'month',payload->>'month','days',rows,'generatedAt',now(),'version',next_version);
 insert into blanco_private.hr_reports(employee_id,month,version,request_id,snapshot) values(employee_id,month_start,next_version,(payload->>'requestId')::uuid,data) returning * into report;
 insert into blanco_private.hr_audit(employee_id,action,actor,after_data) values(employee_id,'report',actor,jsonb_build_object('id',report.id,'month',month_start,'version',next_version));
 return jsonb_build_object('report',to_jsonb(report));
 elsif action='report_get' then
 select * into report from blanco_private.hr_reports where id=(payload->>'reportId')::uuid;
 if not found then raise exception 'Relevé introuvable.';end if;return jsonb_build_object('report',to_jsonb(report));
 elsif action='report_file' then
 select * into report from blanco_private.hr_reports where id=(payload->>'reportId')::uuid for update;
 if not found or payload->>'path'<>report.employee_id::text||'/'||report.id::text||'.pdf' then raise exception 'Document de relevé invalide.';end if;
 if report.file_path is not null and report.file_path<>payload->>'path' then raise exception 'Le document original est conservé.';end if;
 update blanco_private.hr_reports set file_path=payload->>'path' where id=report.id;return jsonb_build_object('ok',true);
 elsif action='document_add' then
 if employee_id is null or payload->>'path' !~ ('^'||employee_id::text||'/[a-f0-9-]{36}\.(pdf|png|jpg)$') or length(coalesce(payload->>'name','')) not between 1 and 200 then raise exception 'Document invalide.';end if;
 insert into blanco_private.hr_documents(employee_id,name,path) values(employee_id,payload->>'name',payload->>'path');
 insert into blanco_private.hr_audit(employee_id,action,actor,note) values(employee_id,'document',actor,left(payload->>'name',200));return jsonb_build_object('ok',true);
 elsif action='export_backup' then
 select jsonb_build_object('employees',(select coalesce(jsonb_agg(to_jsonb(e)-array['pin_hash','link_hash','auth_version']),'[]') from blanco_private.hr_employees e),'days',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from blanco_private.hr_days d),'reports',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from blanco_private.hr_reports r),'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from blanco_private.hr_audit a),'documents',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from blanco_private.hr_documents d),'exportedAt',now()) into result;return result;
 end if;
 raise exception 'Action inconnue.';
end$$;
revoke all on function blanco_private.hr_api(text,jsonb) from public;
grant usage on schema blanco_private to anon,authenticated;
grant execute on function blanco_private.hr_api(text,jsonb) to anon,authenticated;
revoke all on function blanco_private.hr_calculate(date,jsonb,boolean),blanco_private.hr_instant(date,text,integer),blanco_private.hr_limit(text) from public,anon,authenticated;
create function public.personnel_api(action text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select blanco_private.hr_api(action,payload)$$;
revoke all on function public.personnel_api(text,jsonb) from public;
grant execute on function public.personnel_api(text,jsonb) to anon,authenticated;
insert into blanco_private.hr_employees(first_name) values('Joudy'),('Ophélie');
-- Private files are only accessible to the same existing owner accounts.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('personnel-documents','personnel-documents',false,5242880,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create policy personnel_files_owner on storage.objects for all to authenticated
 using(bucket_id='personnel-documents' and exists(select 1 from public.menu_admins where user_id=(select auth.uid())))
 with check(bucket_id='personnel-documents' and exists(select 1 from public.menu_admins where user_id=(select auth.uid())));
