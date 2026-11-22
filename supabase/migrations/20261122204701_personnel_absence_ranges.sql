-- Add atomic multi-day absence declarations; preserve existing grants and authorization.
create or replace function blanco_private.hr_api(action text,payload jsonb default '{}') returns jsonb
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
 if action='employee_absence_range' then action:='absence_range';end if;
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
 elsif action='absence_range' then
 if employee_id is null then raise exception 'Choisissez un employé.';end if;
 first_day:=(payload->>'date')::date;last_day:=(payload->>'endDate')::date;
 if first_day is null or last_day is null or last_day<first_day or last_day-first_day>61 then raise exception 'Choisissez une période de 1 à 62 jours.';end if;
 if coalesce(payload->>'kind','') not in ('paid_leave','sick','unpaid','rest','other') then raise exception 'Type d’absence invalide.';end if;
 mode:=case when admin then 'approve' else 'submit' end;
 workday:=first_day;
 while workday<=last_day loop
 insert into blanco_private.hr_days(employee_id,work_date) values(employee_id,workday) on conflict do nothing;
 select * into rec from blanco_private.hr_days d where d.employee_id=hr.employee_id and work_date=workday for update;
 if rec.approved is not null or rec.proposed is not null then raise exception 'Une journée de la période est déjà renseignée. Corrigez-la dans le calendrier.';end if;
 perform blanco_private.hr_api(case when admin then 'day_save' else 'employee_save' end,
 payload||jsonb_build_object('date',workday,'version',rec.version,'mode',mode,'hours',jsonb_build_object('kind',payload->>'kind','note',left(coalesce(payload->>'note',''),1000))));
 workday:=workday+1;
 end loop;
 return jsonb_build_object('ok',true,'days',last_day-first_day+1);
 elsif action in ('day_save','day_review','day_discard') then
 if employee_id is null then raise exception 'Choisissez un employé.';end if;
 workday:=(payload->>'date')::date;if workday is null or workday<'2000-01-01' or workday>'2099-12-31' then raise exception 'Date invalide.';end if;
 insert into blanco_private.hr_days(employee_id,work_date) values(employee_id,workday) on conflict do nothing;
 select * into rec from blanco_private.hr_days d where d.employee_id=hr.employee_id and work_date=workday for update;
 if rec.version<>coalesce((payload->>'version')::integer,-1) then raise exception 'Journée modifiée ailleurs. Rechargez la journée pour continuer.';end if;
 before_data:=to_jsonb(rec);note:=left(coalesce(payload->>'reviewNote',''),1000);
 if action='day_save' then
 mode:=coalesce(payload->>'mode','draft');if mode not in ('draft','submit','approve') or (not admin and mode='approve') then raise exception 'Validation réservée à la direction.';end if;
 if mode<>'draft' and payload->'hours'->>'kind'='work' and workday>(now() at time zone 'Europe/Paris')::date then raise exception 'Les heures réelles ne peuvent pas être validées à l’avance.';end if;
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
