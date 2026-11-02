import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAppUpdates } from '../dist/app-updates.js';

function harness({ waiting = null, fail = false } = {}) {
  const dom = new JSDOM('<section id="notice"></section><form><input value="unsaved scorer name"></form>');
  const handlers = {};
  let registrations = 0, checks = 0;
  const registration = { waiting, installing: null, addEventListener: (event, fn) => handlers[event] = fn,
    update: async () => { checks++; } };
  const serviceWorker = { register: async (url, options) => {
    registrations++;
    assert.equal(url, './sw.js'); assert.equal(options.updateViaCache, 'none');
    if (fail) throw Error('offline');
    return registration;
  } };
  let language = 'en';
  const notice = dom.window.document.querySelector('#notice');
  const updates = createAppUpdates({ serviceWorker, t: (en, si) => language === 'en' ? en : si,
    onChange: () => { notice.innerHTML = updates.view(); } });
  return { dom, notice, updates, registration, handlers, get registrations() { return registrations; },
    get checks() { return checks; }, reconnect() { fail = false; }, sinhala() { language = 'si'; } };
}

test('existing waiting update is visible without disturbing unsaved input or activating worker', async t => {
  const h = harness({ waiting: { postMessage() { assert.fail('must not force activation'); } } });
  t.after(() => h.dom.window.close());
  const input = h.dom.window.document.querySelector('input');
  await h.updates.start();
  assert.match(h.notice.textContent, /update is ready/);
  assert.match(h.notice.textContent, /every Cricavo tab/);
  assert.equal(h.dom.window.document.querySelector('input'), input);
  assert.equal(input.value, 'unsaved scorer name');
  await h.updates.check();
  assert.match(h.notice.textContent, /update is ready/);
  h.sinhala(); assert.match(h.updates.view(), /සූදානම්/);
});

test('new installation becomes a waiting update and failed installation offers retry', async t => {
  const h = harness(); t.after(() => h.dom.window.close()); await h.updates.start();
  let changed;
  const worker = { state: 'installing', addEventListener: (_, fn) => changed = fn };
  h.registration.installing = worker; h.handlers.updatefound();
  assert.match(h.notice.textContent, /Preparing app files/);
  worker.state = 'installed'; h.registration.waiting = worker; h.registration.installing = null; changed();
  assert.match(h.notice.textContent, /update is ready/);
  h.registration.waiting = null; worker.state = 'redundant'; changed();
  assert.match(h.notice.textContent, /failed/);
});

test('offline registration can retry and concurrent checks share one request', async t => {
  const h = harness({ fail: true }); t.after(() => h.dom.window.close());
  await h.updates.start(); assert.match(h.notice.textContent, /failed/);
  h.reconnect();
  let resolve;
  h.registration.update = () => new Promise(done => resolve = done);
  const first = h.updates.check(), second = h.updates.check();
  assert.equal(first, second);
  // Allow register() and connect() continuations to reach update().
  await new Promise(done => setImmediate(done));
  assert.equal(h.notice.querySelector('button').disabled, true);
  resolve(); await first;
  assert.equal(h.registrations, 2);
  assert.match(h.notice.textContent, /No waiting update/);
  assert.equal(h.notice.querySelector('button').disabled, false);
});

test('failed network update keeps a known waiting update actionable', async t => {
  const h = harness({ waiting: {} }); t.after(() => h.dom.window.close());
  await h.updates.start(); h.registration.update = async () => { throw Error('offline'); };
  await h.updates.check(); assert.match(h.notice.textContent, /update is ready/);
  assert.equal(h.notice.querySelector('button').disabled, false);
});

test('unsupported service workers do not block application startup', async () => {
  const updates = createAppUpdates({ serviceWorker: undefined, t: en => en });
  await updates.start(); await updates.check(); assert.equal(updates.view(), '');
});
