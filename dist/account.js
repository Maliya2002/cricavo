import { initializeCloud } from './auth.js';
import { backupService } from './cloud-backups.js';
import { listMatches, saveMatch } from './storage.js';
import { createAutoBackup } from './auto-backup.js';

export function createAccountUI({ modal, t, escape: esc, toast }) {
  let cloud = null, ready = false, failure = '', requestVersion = 0, visible = false, method = 'email';
  let autoBackup = null;
  const initialization = initializeCloud().then(result => {
    cloud = result;
    if (cloud) {
      autoBackup = createAutoBackup({ client: cloud.client, getUser: () => cloud.session?.user.id,
        listMatches, storage: localStorage, online: () => navigator.onLine,
        onStatus: (state) => { const target = modal.querySelector('#auto-status'); if (target) target.textContent = state === 'saved' ? t('Saved to cloud', 'Cloud වෙත සුරැකුණා') : state === 'saving' ? t('Saving…', 'සුරකිමින්…') : t('Upload pending. Will retry online.', 'Upload ඉතිරියි. Online විට නැවත උත්සාහ කරයි.'); }
      });
      setInterval(() => autoBackup.flush(), 15000);
      window.addEventListener('online', () => autoBackup.flush());
      autoBackup.flush();
    }
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
      list.insertAdjacentHTML('afterend', btn(t('Cloud match backups', 'Cloud තරග පිටපත්'), 'backups'));
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
  async function showBackups() {
    const version = ++requestVersion;
    paint(`<h3>${t('Cloud match backups', 'Cloud තරග පිටපත්')}</h3><p>${t('Loading…', 'පූරණය වෙමින්…')}</p>`);
    try {
      const [local, saved] = await Promise.all([listMatches(), backupService(cloud.client).list()]);
      if (!visible || version !== requestVersion) return;
      paint(`<h3>${t('Cloud match backups', 'Cloud තරග පිටපත්')}</h3><p class="muted">${t('Private to your account. Upload saves a snapshot; restore creates a new local match. This is not live sync. Latest 50 backups shown.', 'ඔබේ ගිණුමට පමණයි. Upload මඟින් මේ මොහොතේ පිටපතක් සුරකී. Restore නව local තරගයක් සාදයි. මෙය live sync නොවේ. අලුත්ම පිටපත් 50 පෙන්වයි.')}</p><p id="auto-status" role="status">${t('Auto backup runs every 15 seconds while open and signed in. Offline changes retry online. Restored copies need separate opt-in. Devices are not merged.', 'App එක විවෘතව login වී ඇති විට තත්පර 15කට වරක් auto backup වේ. Offline වෙනස්කම් online වූ විට යැවේ. Restore කළ පිටපතට වෙනම සක්‍රිය කරන්න. Devices අතර merge නොවේ.')}</p><h3>${t('On this device', 'මෙම උපාංගයේ')}</h3>${local.map(m => `<div class="notice">${esc(m.settings.teamA)} / ${esc(m.settings.teamB)} ${btn(t('Upload snapshot', 'පිටපත upload කරන්න'), 'upload:' + m.id)} ${btn(autoBackup.enabled(m.id) ? t('Stop auto backup', 'Auto backup නවත්වන්න') : t('Enable auto backup', 'Auto backup සක්‍රිය කරන්න'), 'auto:' + m.id)}</div>`).join('') || '<p>—</p>'}<h3>${t('Saved in cloud', 'Cloud හි සුරැකි')}</h3>${saved.map(b => `<div class="notice">${esc(new Date(b.created_at).toLocaleString())}<br><small>${esc(b.match_id)}</small>${btn(t('Restore as new match', 'නව තරගයක් ලෙස ලබාගන්න'), 'restore:' + b.id)}</div>`).join('') || '<p>—</p>'}<p id="account-error" class="form-error" role="alert"></p>${btn(t('Back to account', 'ගිණුම වෙත'), 'refresh')}`);
    } catch (error) {
      if (visible && version === requestVersion) paint(`<p class="form-error" role="alert">${esc(error.message)}</p>${btn(t('Retry backups', 'නැවත උත්සාහ කරන්න'), 'backups')}${btn(t('Back', 'ආපසු'), 'refresh')}`);
    }
  }
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
      if (action === 'backups') await showBackups();
      if (action.startsWith('auto:')) {
        const id = action.slice(5);
        if (autoBackup.enabled(id)) autoBackup.disable(id); else autoBackup.enable(id);
        await showBackups();
        await autoBackup.flush();
      }
      if (action.startsWith('upload:')) {
        const match = (await listMatches()).find(m => m.id === action.slice(7));
        if (!match) throw Error('Local match not found');
        await backupService(cloud.client).upload(match);
        toast(t('Cloud snapshot saved', 'Cloud පිටපත සුරැකුණා'));
        if (visible) await showBackups();
      }
      if (action.startsWith('restore:')) {
        const match = await backupService(cloud.client).download(action.slice(8));
        await saveMatch(match, null);
        location.href = '#score/' + match.id;
        location.reload();
      }
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
