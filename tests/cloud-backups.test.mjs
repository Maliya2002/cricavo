import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('private backups reject forged ownership and prevent overwrite across devices', async () => {
  const db = new PGlite();
  const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key); insert into auth.users values ('${a}'), ('${b}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202611010002_match_backups.sql', import.meta.url), 'utf8'));
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
    const snapshot = JSON.stringify({ id: a, schemaVersion: 1, settings: {}, events: [] });
    await db.query('insert into public.cricavo_match_backups(match_id,snapshot) values ($1,$2)', [a,snapshot]);
    assert.equal((await db.query('select * from public.cricavo_match_backups')).rows.length,1);
    await assert.rejects(db.query('insert into public.cricavo_match_backups(owner_id,match_id,snapshot) values ($1,$2,$3)',[b,a,snapshot]));
    await assert.rejects(db.exec('update public.cricavo_match_backups set snapshot = snapshot'));
    await assert.rejects(db.exec('delete from public.cricavo_match_backups'));
    await assert.rejects(db.query('insert into public.cricavo_match_backups(match_id,snapshot) values ($1,$2)',[a,'{}']));
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal((await db.query('select * from public.cricavo_match_backups')).rows.length,0);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.exec('select * from public.cricavo_match_backups'));
  } finally { await db.close(); }
});
