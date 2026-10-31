import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, validateConfig, normalizeIdentity } from '../dist/auth.js';

const config = { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'sb_publishable_test', providers: { google: true, email: true, phone: true } };
function mock(overrides = {}) {
  const calls = [];
  const client = { auth: Object.fromEntries(['signInWithOtp','verifyOtp','signInWithOAuth','signOut','getSession'].map(name => [name, async payload => { calls.push({ name, payload }); return { data: { session: { user: { id: 'user-a' } } }, error: null }; }])) };
  Object.assign(client.auth, overrides);
  let clock = 100000;
  return { auth: createAuth(client, config.providers, 'https://cricavo.example/#account', () => clock), calls, tick: () => clock += 60000 };
}
test('configuration rejects server secrets and credential-bearing destinations', () => {
  assert.equal(validateConfig({}), null);
  assert.equal(validateConfig(config).url, config.supabaseUrl);
  for (const key of ['sb_secret_x', 'eyJhbGciOiJIUzI1NiJ9.e30.signature', '', undefined]) assert.throws(() => validateConfig({ ...config, supabasePublishableKey: key }));
  for (const url of ['http://example.supabase.co', 'https://example.supabase.co.evil.test', 'https://user:pass@example.supabase.co', 'https://example.supabase.co/path', 'https://example.supabase.co?key=x']) assert.throws(() => validateConfig({ ...config, supabaseUrl: url }));
});
test('email and phone identities validated before any network request', () => {
  assert.equal(normalizeIdentity('phone', '+94771234567'), '+94771234567');
  assert.equal(normalizeIdentity('email', ' test@example.com '), 'test@example.com');
  for (const n of ['0771234567','+01234567','+94 hello','']) assert.throws(() => normalizeIdentity('phone', n));
  assert.throws(() => normalizeIdentity('email', 'invalid'));
});
test('email OTP verifies only the originally requested identity', async () => {
  const { auth, calls } = mock();
  await auth.sendCode('email', 'test@example.com');
  const copy = auth.pending; copy.identity = 'attacker@example.com';
  await auth.verify('123456');
  assert.deepEqual(calls[1].payload, { email: 'test@example.com', token: '123456', type: 'email' });
  assert.equal(auth.pending, null);
});
test('phone verification uses sms type, never email', async () => {
  const { auth, calls } = mock(); await auth.sendCode('phone', '+94771234567'); await auth.verify('123456');
  assert.deepEqual(calls[1].payload, { phone: '+94771234567', token: '123456', type: 'sms' });
});
test('resend cooldown applies across identity changes and survives failed sends', async () => {
  const { auth, tick, calls } = mock(); await auth.sendCode('email', 'one@example.com'); auth.clearPending();
  await assert.rejects(auth.sendCode('email', 'two@example.com'), /wait/); assert.equal(calls.length, 1);
  tick(); await auth.sendCode('email', 'two@example.com'); assert.equal(calls.length, 2);
  const failed = mock({ signInWithOtp: async () => ({ error: Error('Rate limited') }) });
  await assert.rejects(failed.auth.sendCode('email', 'one@example.com'), /Rate limited/);
  assert.equal(failed.auth.pending, null); assert.equal(failed.auth.resendSeconds, 60);
});
test('bad OTP retains challenge for retry', async () => {
  const { auth } = mock({ verifyOtp: async () => ({ error: Error('Invalid code') }) }); await auth.sendCode('email', 'one@example.com');
  await assert.rejects(auth.verify('123456'), /Invalid code/); assert.equal(auth.pending.identity, 'one@example.com');
});
test('disabled providers never issue auth requests', () => {
  const auth = createAuth({}, {}, 'https://example.com'); assert.throws(() => auth.google(), /not enabled/); assert.throws(() => auth.sendCode('phone', '+94771234567'), /not enabled/);
});
test('Google delegates PKCE authorization and logout is device-local', async () => {
  const { auth, calls } = mock(); await auth.google(); await auth.signOut();
  assert.equal(calls[0].payload.provider, 'google'); assert.equal(calls[0].payload.options.redirectTo, 'https://cricavo.example/#account');
  assert.deepEqual(calls[1].payload, { scope: 'local' });
});
