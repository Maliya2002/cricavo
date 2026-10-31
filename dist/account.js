import { initializeCloud } from './auth.js';

export function createAccountUI({ modal, t, escape: esc, toast }) {
  let cloud = null, ready = false, failure = '', requestVersion = 0, visible = false, method = 'email';
  const initialization = initializeCloud().then(result => {
    cloud = result;
    if (cloud) cloud.auth.onChange((_event, session) => {
      cloud.session = session;
      // Avoid awaiting Supabase methods inside its synchronous auth callback.
      if (visible) setTimeout(() => show(), 0);
    });
  }).catch(error => { failure = error.message; }).finally(() => { ready = true; if (visible) show(); });
  modal.addEventListener('close', () => { visible = false; requestVersion++; });
  const btn = (text, id, disabled = false) => `<button type="button" class="btn" data-account="${id}" ${disabled ? 'disabled' : ''}>${text}</button>`;
  const frame = body => `<div class="dialog-head"><h2>${t('Your account', 'ඔබේ ගිණුම')}</h2>${btn('×', 'close')}</div><div class="stack">${body}</div>`;
  function paint(body) { modal.innerHTML = frame(body); if (!modal.open) modal.showModal(); }

  async function show() {
    visible = true; const version = ++requestVersion;
    if (!ready) { paint(`<p>${t('Connecting…', 'සම්බන්ධ වෙමින්…')}</p>`); return; }
    if (!cloud) {
      paint(`<span class="badge neutral">${t('Cloud setup pending', 'Cloud සැකසුම ඉතිරියි')}</span><p>${esc(failure || t('Your Supabase project is not connected yet. Google, email and phone sign-in will appear here once enabled.', 'Supabase project එක තවම සම්බන්ධ නැහැ. සක්‍රිය කළ පසු Google, email සහ phone login මෙහි පෙනේ.'))}</p><p class="muted small">${t('Device scoring and saved matches remain available.', 'Device scoring සහ සුරැකි තරග තවම භාවිත කළ හැක.')}</p>${btn(t('Continue scoring', 'Scoring වෙත'), 'close')}`);
      return;
    }
    if (cloud.session) {
      const user = cloud.session.user;
      paint(`<span class="badge">${t('Signed in', 'Login වී ඇත')}</span><p>${esc(user.email || user.phone || t('Cricavo player', 'Cricavo ක්‍රීඩකයා'))}</p><h3>${t('Your organizations', 'ඔබේ සංවිධාන')}</h3><div id="org-list" class="stack"><p class="muted">${t('Loading…', 'පූරණය වෙමින්…')}</p></div><form id="org-form" class="stack"><label class="field">${t('Organization / club name', 'සංවිධානයේ / සමාජයේ නම')}<input name="name" required minlength="2" maxlength="80" autocomplete="organization"></label><button class="btn primary">${t('Create organization', 'සංවිධානයක් සාදන්න')}</button></form><p class="small muted">${t('Local matches are not uploaded automatically. Cloud scoring sync is the next milestone.', 'Local තරග ස්වයංක්‍රීයව upload නොවේ. Cloud scoring sync මීළඟ අදියරයි.')}</p><p id="account-error" class="form-error" role="alert"></p>${btn(t('Sign out on this device', 'මෙම උපාංගයෙන් sign out'), 'signout')}`);
      const result = await cloud.client.from('cricavo_organizations').select('id,name,created_at').order('created_at', { ascending: false });
      if (!visible || version !== requestVersion) return;
      const list = modal.querySelector('#org-list');
      if (result.error) { list.innerHTML = `<p class="form-error">${t('Organization database is not ready or unavailable. Apply the project migration and retry.', 'Organization database එක සූදානම් නැහැ හෝ ලබාගත නොහැක. Migration එක යොදා නැවත උත්සාහ කරන්න.')}</p>${btn(t('Retry', 'නැවත උත්සාහ කරන්න'), 'refresh')}`; }
      else list.innerHTML = result.data.length ? result.data.map(org => `<div class="notice">${esc(org.name)}</div>`).join('') : `<p class="muted">${t('Create your first club or tournament organization.', 'ඔබේ පළමු සමාජය හෝ තරග සංවිධානය සාදන්න.')}</p>`;
      return;
    }
    const pending = cloud.auth.pending;
    if (pending) {
      paint(`<h3>${t('Check your messages', 'ඔබේ පණිවිඩ බලන්න')}</h3><p>${t('Enter the code sent to', 'Code එක යැවූ ලිපිනය / අංකය')}: ${esc(pending.identity)}</p><form id="verify-form" class="stack"><label class="field">${t('Verification code', 'තහවුරු කිරීමේ code එක')}<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required></label><button class="btn primary">${t('Verify and sign in', 'තහවුරු කර login වන්න')}</button></form><div class="row">${btn(t('Resend code', 'Code එක නැවත යවන්න'), 'resend')}${btn(t('Change email / number', 'Email / අංකය වෙනස් කරන්න'), 'change')}</div><p id="account-error" class="form-error" role="alert"></p>`);
      return;
    }
    const available = ['email', 'phone'].filter(key => cloud.providers[key]);
    if (!available.includes(method)) method = available[0] || 'email';
    paint(`${cloud.providers.google ? btn(t('Continue with Google', 'Google සමඟ ඉදිරියට'), 'google') : ''}<div class="segment">${available.map(key => `<button type="button" class="btn" aria-pressed="${key === method}" data-account="method-${key}">${key === 'email' ? 'Email' : t('Phone number', 'දුරකථන අංකය')}</button>`).join('')}</div>${available.length ? `<form id="identity-form" class="stack"><label class="field">${method === 'email' ? 'Email' : t('Phone number with country code', 'රටේ code එක සහිත දුරකථන අංකය')}<input name="identity" type="${method === 'email' ? 'email' : 'tel'}" autocomplete="${method === 'email' ? 'email' : 'tel'}" placeholder="${method === 'email' ? 'you@example.com' : '+94771234567'}" required maxlength="254"></label><button class="btn primary">${t('Send verification code', 'තහවුරු කිරීමේ code එක යවන්න')}</button></form>` : `<p class="muted">${t('Email and phone sign-in are not enabled yet.', 'Email සහ phone login තවම සක්‍රිය නැහැ.')}</p>`}<p class="small muted">${t('Your first verified sign-in creates your account. No password needed.', 'පළමු තහවුරු කළ login එකේදී ඔබේ ගිණුම සෑදේ. Password අවශ්‍ය නැහැ.')}</p><p id="account-error" class="form-error" role="alert"></p>`);
  }

  let submitting = false;
  async function run(operation) {
    if (submitting) return;
    submitting = true;
    const version = requestVersion;
    modal.querySelectorAll('button').forEach(b => { if (b.dataset.account !== 'close') b.disabled = true; });
    try { await operation(); }
    catch (error) { if (visible && version === requestVersion) { const target = modal.querySelector('#account-error'); if (target) target.textContent = error.message; else toast(error.message); } }
    finally { submitting = false; if (visible) modal.querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  modal.addEventListener('click', event => {
    const action = event.target.closest('[data-account]')?.dataset.account;
    if (!action) return;
    if (action === 'close') { modal.close(); return; }
    if (submitting) return;
    if (action.startsWith('method-')) { method = action.slice(7); show(); return; }
    if (action === 'refresh') { show(); return; }
    if (action === 'change') { cloud.auth.clearPending(); show(); return; }
    run(async () => {
      if (action === 'google') await cloud.auth.google();
      if (action === 'signout') { await cloud.auth.signOut(); cloud.session = null; await show(); }
      if (action === 'resend') { const p = cloud.auth.pending; await cloud.auth.sendCode(p.method, p.identity); toast(t('Code sent', 'Code එක යැවුණා')); }
    });
  });
  modal.addEventListener('submit', event => {
    if (!['identity-form', 'verify-form', 'org-form'].includes(event.target.id)) return;
    event.preventDefault(); const id = event.target.id, fields = Object.fromEntries(new FormData(event.target));
    run(async () => {
      if (id === 'identity-form') { await cloud.auth.sendCode(method, fields.identity); if (visible) await show(); }
      if (id === 'verify-form') { cloud.session = await cloud.auth.verify(fields.code); if (visible) await show(); }
      if (id === 'org-form') { const { error } = await cloud.client.rpc('cricavo_create_organization', { organization_name: fields.name.trim() }); if (error) throw error; if (visible) await show(); }
    });
  });
  return { show, initialization };
}
