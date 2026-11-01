import { validateSnapshot } from './cloud-backups.js';

// Content-derived IDs make retries idempotent without overwriting any snapshot.
export async function snapshotId(userId, match) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([userId, match])));
  const hex = [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export function createAutoBackup({ client, getUser, listMatches, storage, online, onStatus = () => {} }) {
  let busy = false;
  const key = (user, id) => `cricavo-auto-backup:${user}:${id}`;
  const read = (user,id) => { const raw = storage.getItem(key(user,id)); return raw ? JSON.parse(raw) : null; };
  return {
    enabled(id) { const user = getUser(); return !!user && read(user,id) !== null; },
    enable(id) { const user = getUser(); if (!user) throw Error('Sign in first'); storage.setItem(key(user,id), JSON.stringify({ saved: null })); },
    disable(id) { const user = getUser(); if (user) storage.removeItem(key(user,id)); },
    async flush() {
      if (busy) return;
      if (!online()) { onStatus('offline'); return; }
      const user = getUser(); if (!user) return;
      busy = true;
      try {
        let lastError = null, selected = 0;
        for (const match of await listMatches()) {
          if (getUser() !== user || !online()) break;
          try {
          const state = read(user,match.id); if (!state) continue;
          selected++;
          validateSnapshot(match);
          const id = await snapshotId(user,match);
          if (state.saved === id) continue;
          if (getUser() !== user || !read(user,match.id)) break;
          onStatus('saving');
          const result = await client.from('cricavo_match_backups').insert({ id, owner_id: user, match_id: match.id, snapshot: match });
          if (result.error && result.error.code !== '23505') throw result.error;
          if (getUser() === user && read(user,match.id)) storage.setItem(key(user,match.id), JSON.stringify({ saved: id }));
          } catch (error) { lastError = error; }
        }
        if (getUser() !== user) return;
        if (!online()) onStatus('offline');
        else if (lastError) onStatus('pending', lastError);
        else if (selected) onStatus('saved');
      } catch (error) { if (getUser() === user) onStatus('pending', error); }
      finally { busy = false; }
    }
  };
}
