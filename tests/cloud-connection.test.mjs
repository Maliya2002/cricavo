import {test} from 'node:test';
import assert from 'node:assert/strict';
import {retryableConnection} from '../dist/cloud-connection.js';

test('offline startup retries online and concurrent reconnects share one client', async () => {
  let attempts=0;
  const client={session:{}};
  const connect=retryableConnection(async()=>{ if (++attempts===1) throw Error('Offline'); return client; });
  await assert.rejects(connect(),/Offline/);
  const results=await Promise.all([connect(),connect(),connect()]);
  assert.equal(attempts,2);
  assert(results.every(result=>result===client));
  assert.equal(await connect(),client);
  assert.equal(attempts,2);
});

test('missing configuration can recover after setup without reload', async () => {
  let configured=false;
  const connect=retryableConnection(async()=>configured?{ready:true}:null);
  assert.equal(await connect(),null);
  configured=true;
  assert.deepEqual(await connect(),{ready:true});
});
