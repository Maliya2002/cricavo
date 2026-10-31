// Provider adapter: no admin credentials, handwritten tokens, or authorization decisions.
export function validateConfig(config) {
  if (!config?.supabaseUrl && !config?.supabasePublishableKey) return null;
  const url = new URL(config.supabaseUrl);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw Error('Use the HTTPS project URL from Supabase settings.');
  }
  const key = config.supabasePublishableKey;
  // Require current public keys; never embed legacy JWT service-role credentials.
  if (typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw Error('Use a Supabase publishable key, never a secret or service-role key.');
  return { url: url.origin, key, providers: { google: config.providers?.google === true, email: config.providers?.email === true, phone: config.providers?.phone === true } };
}

export function normalizeIdentity(method, value) {
  const identity = String(value || '').trim();
  if (method === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity) && identity.length <= 254) return identity;
  if (method === 'phone' && /^\+[1-9]\d{7,14}$/.test(identity)) return identity;
  throw Error(method === 'phone' ? 'Use an international phone number, for example +94771234567.' : 'Enter a valid email address.');
}

export function createAuth(client, providers, redirectTo, now = Date.now) {
  let pending = null, busy = false, nextSendAt = 0;
  const allowed = method => { if (!providers[method]) throw Error('This sign-in method is not enabled yet.'); };
  const run = async fn => { if (busy) throw Error('Please wait for the current request.'); busy = true; try { return await fn(); } finally { busy = false; } };
  const check = response => { if (response.error) throw response.error; return response.data; };
  return {
    get pending() { return pending && { ...pending }; },
    get resendSeconds() { return Math.max(0, Math.ceil((nextSendAt - now()) / 1000)); },
    clearPending() { pending = null; },
    async session() { return check(await client.auth.getSession()).session; },
    onChange(callback) { const { data } = client.auth.onAuthStateChange((event, session) => callback(event, session)); return () => data.subscription.unsubscribe(); },
    google() { allowed('google'); return run(async () => check(await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } }))); },
    sendCode(method, value) {
      allowed(method); const identity = normalizeIdentity(method, value);
      return run(async () => {
        if (now() < nextSendAt) throw Error('Please wait before requesting another code.');
        // Reserve the cooldown before the request to limit retries after network uncertainty.
        nextSendAt = now() + 60000;
        check(await client.auth.signInWithOtp({ [method]: identity, options: { shouldCreateUser: true } }));
        pending = { method, identity, sentAt: now() };
      });
    },
    verify(code) {
      const request = pending && { ...pending };
      if (!request) throw Error('Request a code first.');
      const token = String(code).trim();
      if (!/^\d{6,10}$/.test(token)) throw Error('Enter the verification code from your message.');
      return run(async () => {
        const data = check(await client.auth.verifyOtp({ [request.method]: request.identity, token, type: request.method === 'phone' ? 'sms' : 'email' }));
        pending = null;
        return data.session;
      });
    },
    signOut() { return run(async () => { check(await client.auth.signOut({ scope: 'local' })); pending = null; }); }
  };
}

export async function initializeCloud() {
  const response = await fetch('./config.json', { cache: 'no-store' });
  if (!response.ok) throw Error('Cloud configuration could not be loaded. Device scoring is still available.');
  const config = validateConfig(await response.json());
  if (!config) return null;
  const { createClient } = await import('./vendor/supabase.js');
  const client = createClient(config.url, config.key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
  const redirect = new URL('./', location.href); redirect.hash = 'account';
  const auth = createAuth(client, config.providers, redirect.href);
  const session = await auth.session();
  // Supabase has processed the PKCE callback. Remove one-use code/error data from the address bar.
  const cleanUrl = new URL(location.href);
  for (const key of ['code', 'error', 'error_code', 'error_description']) cleanUrl.searchParams.delete(key);
  history.replaceState(null, '', cleanUrl);
  return { client, auth, session, providers: config.providers };
}
