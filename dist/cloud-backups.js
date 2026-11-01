import { replay, validateSettings } from './engine.js';

export function validateSnapshot(raw) {
  if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.events) || raw.events.length > 10000 || JSON.stringify(raw).length > 2000000) throw Error('Unsupported match backup');
  validateSettings(raw.settings);
  replay(raw);
  return raw;
}

export function restoredSnapshot(raw) {
  validateSnapshot(raw);
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), schemaVersion: 1, settings: validateSettings(raw.settings), events: raw.events, audit: Array.isArray(raw.audit) ? raw.audit : [], revision: 1, createdAt: now, updatedAt: now, restored: true };
}

export function backupService(client) {
  const check = result => { if (result.error) throw Error(result.error.code === 'PGRST205' ? 'Cloud backup database setup is pending.' : result.error.message); return result.data; };
  return {
    async list() { return check(await client.from('cricavo_match_backups').select('id,match_id,created_at').order('created_at', { ascending: false }).limit(50)); },
    async upload(match) { validateSnapshot(match); check(await client.from('cricavo_match_backups').insert({ match_id: match.id, snapshot: match })); },
    async download(id) { const row = check(await client.from('cricavo_match_backups').select('snapshot').eq('id', id).single()); return restoredSnapshot(row.snapshot); }
  };
}
