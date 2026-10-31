import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('organization migration enforces tenant isolation and atomic ownership', async () => {
  const db = new PGlite();
  try {
    // Minimal Supabase auth contract for actual PostgreSQL policy execution.
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');`);
    await db.exec(await readFile(new URL('../supabase/migrations/202611010001_organizations.sql', import.meta.url), 'utf8'));
    const asUser = async user => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
    const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
    await asUser(a);
    const result = await db.query("select public.cricavo_create_organization('Kings Club') as id");
    const id = result.rows[0].id;
    assert.equal((await db.query('select * from public.cricavo_organizations')).rows.length, 1);
    const membership = (await db.query('select * from public.cricavo_memberships')).rows[0];
    assert.equal(membership.user_id, a); assert.equal(membership.role, 'owner');
    await assert.rejects(db.query("insert into public.cricavo_memberships values ($1,$2,'owner',now())", [id,b]), /permission denied/);
    await asUser(b);
    assert.equal((await db.query('select * from public.cricavo_organizations')).rows.length, 0);
    assert.equal((await db.query('select * from public.cricavo_memberships')).rows.length, 0);
    await assert.rejects(db.query("update public.cricavo_organizations set name='Stolen' where id=$1", [id]), /permission denied/);
    await assert.rejects(db.query("select public.cricavo_create_organization(' ')") , /2–80/);
    await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(db.query("select public.cricavo_create_organization('Anonymous Club')"), /permission denied/);
    await assert.rejects(db.query('select * from public.cricavo_organizations'), /permission denied/);
    await asUser('');
    await assert.rejects(db.query("select public.cricavo_create_organization('No identity')"), /Sign in/);
    await asUser(a);
    for (let n=0; n<9; n++) await db.query('select public.cricavo_create_organization($1)', ['Club '+n]);
    await assert.rejects(db.query("select public.cricavo_create_organization('Overflow')"), /limit reached/);
    assert.equal((await db.query('select * from public.cricavo_organizations')).rows.length, 10);
  } finally { await db.close(); }
});
