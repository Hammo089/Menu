import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('database policies allow public reading and owner publishing, and reject unauthorized changes',async()=>{
  const db=new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
  const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users values ($1),($2)',[owner,other]);await db.query('insert into public.menu_admins values($1)',[owner]);
  await db.exec('set role anon');
  assert.equal((await db.query("select jsonb_array_length(content->'products') as count from public.menu_state")).rows[0].count,52);
  await assert.rejects(db.exec("update public.menu_state set revision=revision+1"),/permission denied/);
  await assert.rejects(db.exec('select * from public.menu_admins'),/permission denied/);
  await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('menu-images','bad.jpg')"),/row-level security/);
  await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
  assert.equal((await db.query('select * from public.menu_admins')).rows.length,0);
  assert.equal((await db.query("update public.menu_state set revision=revision+1 returning id")).rows.length,0);
  await assert.rejects(db.query('insert into public.menu_admins values($1)',[other]),/permission denied/);
  await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('menu-images','bad.jpg')"),/row-level security/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  assert.equal((await db.query('select * from public.menu_admins')).rows.length,1);
  const result=await db.query("update public.menu_state set content=jsonb_set(content,'{products,0,priceCents}','220'),revision=revision+1 where revision=1 returning revision,content");
  assert.equal(result.rows[0].revision,2);assert.equal(result.rows[0].content.products[0].priceCents,220);
  assert.equal((await db.query("update public.menu_state set revision=revision+1 where revision=1 returning id")).rows.length,0,'stale publication must not overwrite current revision');
  await assert.rejects(db.exec('update public.menu_state set revision=revision+2'),/Revision must increase/);
  await db.exec("insert into storage.objects(bucket_id,name) values('menu-images','owner.jpg')");
  await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('another-bucket','owner.jpg')"),/row-level security/);
  await db.close();
});

test('bundled products, SVG bindings, and database seed remain consistent',()=>{
  const menu=JSON.parse(readFileSync(new URL('../src/data/menu.json',import.meta.url),'utf8'));
  const svg=readFileSync(new URL('../src/data/original-menu.svg',import.meta.url),'utf8');
  const seed=readFileSync(new URL('../supabase/seed.sql',import.meta.url),'utf8');
  assert.equal(menu.products.length,52);assert.equal(new Set(menu.products.map(p=>p.id)).size,52);
  for(const p of menu.products){assert.ok(Number.isInteger(p.priceCents)&&p.priceCents>=0);assert.equal(svg.split(`data-product="${p.id}"`).length-1,2);}
  assert.ok(seed.includes(JSON.stringify(menu).replaceAll("'","''")));
  assert.equal(menu.settings.tvOrientation,'portrait');assert.equal(menu.settings.adDurationSeconds,5);assert.equal(menu.settings.adIntervalSeconds,60);
});
