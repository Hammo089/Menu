-- Apply once in a dedicated Blanco Supabase project, before seed.sql.
begin;

create table public.menu_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.menu_admins enable row level security;
revoke all on public.menu_admins from anon, authenticated;
grant select on public.menu_admins to authenticated;
create policy "Admin can see own membership" on public.menu_admins
  for select to authenticated using (user_id = (select auth.uid()));

create table public.menu_state (
  id text primary key check (id = 'blanco'),
  content jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint menu_document_shape check ((
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content->'products') = 'array'
    and jsonb_typeof(content->'categories') = 'array'
    and jsonb_typeof(content->'settings') = 'object'
    and jsonb_array_length(content->'products') <= 200
    and jsonb_array_length(content->'categories') between 1 and 12
    and octet_length(content::text) <= 500000
  ) is true)
);
alter table public.menu_state enable row level security;
revoke all on public.menu_state from anon, authenticated;
grant select on public.menu_state to anon, authenticated;
grant update (content, revision) on public.menu_state to authenticated;
create policy "Anyone can read published menu" on public.menu_state
  for select to anon, authenticated using (true);
create policy "Only allowlisted owner can publish" on public.menu_state
  for update to authenticated
  using ((select auth.uid()) in (select user_id from public.menu_admins))
  with check ((select auth.uid()) in (select user_id from public.menu_admins));

create function public.menu_revision_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.revision <> old.revision + 1 then
    raise exception 'Revision must increase by exactly one';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.menu_revision_guard() from public, anon, authenticated;
create trigger menu_revision_before_update before update on public.menu_state
  for each row execute function public.menu_revision_guard();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images','menu-images',true,5242880,array['image/jpeg','image/png','image/webp']);

create policy "Owner can read image metadata" on storage.objects
  for select to authenticated using (bucket_id = 'menu-images' and (select auth.uid()) in (select user_id from public.menu_admins));
create policy "Owner can upload menu images" on storage.objects
  for insert to authenticated with check (bucket_id = 'menu-images' and (select auth.uid()) in (select user_id from public.menu_admins));
create policy "Owner can replace menu images" on storage.objects
  for update to authenticated
  using (bucket_id = 'menu-images' and (select auth.uid()) in (select user_id from public.menu_admins))
  with check (bucket_id = 'menu-images' and (select auth.uid()) in (select user_id from public.menu_admins));
create policy "Owner can delete menu images" on storage.objects
  for delete to authenticated using (bucket_id = 'menu-images' and (select auth.uid()) in (select user_id from public.menu_admins));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='menu_state') then
    alter publication supabase_realtime add table public.menu_state;
  end if;
end $$;
commit;
