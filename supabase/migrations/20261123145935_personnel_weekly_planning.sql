create table blanco_private.hr_weekly_plans (
 employee_id uuid not null references blanco_private.hr_employees(id),week_start date not null,
 days jsonb not null,note text not null default '',version integer not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid not null,
 primary key(employee_id,week_start),check(extract(isodow from week_start)=1),check(jsonb_array_length(days)=7)
);
alter table blanco_private.hr_weekly_plans enable row level security;
revoke all on blanco_private.hr_weekly_plans from public,anon,authenticated;
create policy deny_direct on blanco_private.hr_weekly_plans for all to anon,authenticated using(false) with check(false);
create function blanco_private.hr_planning_api(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
<<planning>>
declare eid uuid; monday date; current_plan blanco_private.hr_weekly_plans%rowtype; normalized jsonb:='[]'; item jsonb; hours jsonb; n integer; d date; before_data jsonb; result jsonb;
begin
 if not exists(select 1 from public.menu_admins where user_id=auth.uid()) then raise exception 'Planning réservé à la direction de Blanco.';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>25000 then raise exception 'Demande invalide.';end if;
 if action='backup' then select jsonb_build_object('weeklyPlans',coalesce(jsonb_agg(to_jsonb(p)),'[]')) into result from blanco_private.hr_weekly_plans p;return result;end if;
 if action not in ('get','save') then raise exception 'Action inconnue.';end if;
 eid:=(payload->>'employeeId')::uuid;monday:=(payload->>'week')::date;
 if eid is null or monday is null or monday<'2000-01-01' or monday>'2099-12-24' or extract(isodow from monday)<>1 then raise exception 'Choisissez une semaine commençant le lundi.';end if;
 perform 1 from blanco_private.hr_employees where id=eid for update;
 if not found then raise exception 'Employé introuvable.';end if;
 select * into current_plan from blanco_private.hr_weekly_plans where employee_id=eid and week_start=monday for update;
 if action='get' then return jsonb_build_object('plan',case when current_plan.employee_id is null then null else to_jsonb(current_plan) end);end if;
 if coalesce(current_plan.version,0)<>coalesce((payload->>'version')::integer,-1) then raise exception 'Planning modifié ailleurs. Rechargez avant de corriger.';end if;
 if jsonb_typeof(payload->'days')<>'array' or jsonb_array_length(payload->'days')<>7 then raise exception 'Le planning doit contenir sept journées.';end if;
 before_data:=case when current_plan.employee_id is null then null else to_jsonb(current_plan) end;
 for n in 0..6 loop
 d:=monday+n;item:=payload->'days'->n;
 if jsonb_typeof(item)<>'object' or not (item ? 'hours') then raise exception 'Journée du planning invalide.';end if;
 if item->'hours'='null'::jsonb then hours:=null;else hours:=blanco_private.hr_calculate(d,item->'hours',true);end if;
 if n>0 and hours->>'kind'='work' and normalized->(n-1)->'hours'->>'kind'='work' and (normalized->(n-1)->'hours'->>'endUtc')::timestamptz>(hours->>'startUtc')::timestamptz then raise exception 'Deux postes du planning se chevauchent.';end if;
 normalized:=normalized||jsonb_build_array(jsonb_build_object('date',d,'hours',hours));
 end loop;
 if exists(select 1 from blanco_private.hr_weekly_plans p where p.employee_id=eid and p.week_start=monday-7 and p.days->6->'hours'->>'kind'='work' and normalized->0->'hours'->>'kind'='work' and (p.days->6->'hours'->>'endUtc')::timestamptz>(normalized->0->'hours'->>'startUtc')::timestamptz) or exists(select 1 from blanco_private.hr_weekly_plans p where p.employee_id=eid and p.week_start=monday+7 and p.days->0->'hours'->>'kind'='work' and normalized->6->'hours'->>'kind'='work' and (normalized->6->'hours'->>'endUtc')::timestamptz>(p.days->0->'hours'->>'startUtc')::timestamptz) then raise exception 'Un poste chevauche le planning de la semaine voisine.';end if;
 insert into blanco_private.hr_weekly_plans(employee_id,week_start,days,note,updated_by) values(eid,monday,normalized,left(coalesce(payload->>'note',''),1500),auth.uid())
 on conflict(employee_id,week_start) do update set days=excluded.days,note=excluded.note,version=hr_weekly_plans.version+1,updated_at=now(),updated_by=auth.uid() returning * into current_plan;
 insert into blanco_private.hr_audit(employee_id,work_date,action,actor,before_data,after_data) values(eid,monday,'weekly_planning','admin:'||auth.uid(),before_data,to_jsonb(current_plan));
 return jsonb_build_object('plan',to_jsonb(current_plan));
end$$;
revoke all on function blanco_private.hr_planning_api(text,jsonb) from public;
grant execute on function blanco_private.hr_planning_api(text,jsonb) to anon,authenticated;
create function public.personnel_planning(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select blanco_private.hr_planning_api(action,payload)$$;
revoke all on function public.personnel_planning(text,jsonb) from public;
grant execute on function public.personnel_planning(text,jsonb) to anon,authenticated;
