// Updates only this notice; never reloads a scoring screen or activates a worker.
export function createAppUpdates({ serviceWorker, t, onChange = () => {} }) {
  let registration, connecting, checking, state = serviceWorker ? 'idle' : 'unsupported';
  const watched = new WeakSet();
  const set = value => { state = value; onChange(); };
  const sync = fallback => set(registration?.waiting ? 'waiting' : registration?.installing ? 'installing' : fallback);
  function watch() {
    const worker = registration.installing;
    if (worker && !watched.has(worker)) {
      watched.add(worker);
      worker.addEventListener('statechange', () => {
        sync(worker.state === 'redundant' ? 'error' : 'idle');
      });
    }
    sync('idle');
  }
  async function connect() {
    if (!serviceWorker || registration) return registration;
    if (!connecting) connecting = (async () => {
      try {
        registration = await serviceWorker.register('./sw.js', { updateViaCache: 'none' });
        registration.addEventListener('updatefound', watch);
        watch();
        return registration;
      } catch { set('error'); return null; }
      finally { connecting = null; }
    })();
    return connecting;
  }
  function check() {
    if (!serviceWorker) return Promise.resolve();
    if (checking) return checking;
    checking = (async () => {
      set('checking');
      try {
        const current = await connect();
        if (current) { set('checking'); await current.update(); sync('current'); }
      } catch { sync('error'); }
      finally { checking = null; onChange(); }
    })();
    return checking;
  }
  function view() {
    if (state === 'unsupported') return '';
    const messages = {
      idle: t('App updates', 'App updates'),
      checking: t('Checking for updates…', 'Updates පරීක්ෂා කරමින්…'),
      installing: t('Preparing app files for offline use…', 'Offline භාවිතයට app files සූදානම් කරමින්…'),
      current: t('No waiting update found.', 'බලා සිටින update එකක් හමු නොවීය.'),
      error: t('Update check or offline setup failed. Reconnect and try again.', 'Update පරීක්ෂාව හෝ offline සැකසුම අසාර්ථකයි. Online වී නැවත උත්සාහ කරන්න.'),
      waiting: t('An app update is ready. Finish and save any open form, then close every Cricavo tab and installed Cricavo window in this browser. Reopen the same address. Your saved matches stay on this browser.', 'App update එකක් සූදානම්. විවෘත forms අවසන් කර save කරන්න. මේ browser එකේ සියලු Cricavo tabs සහ installed Cricavo windows වසා එම ලිපිනයම නැවත විවෘත කරන්න. Save කළ තරග මේ browser එකේ රැඳේ.')
    };
    return `<div class="notice app-update-notice"><span role="status" aria-live="polite">${messages[state]}</span><button type="button" class="btn ghost" data-action="check-updates" ${checking || state === 'checking' ? 'disabled' : ''}>${t('Check for updates', 'Updates පරීක්ෂා කරන්න')}</button></div>`;
  }
  return { start: connect, check, view };
}
