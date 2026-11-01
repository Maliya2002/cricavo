import { replay } from './engine.js';

export function roundRobin(teams) {
  const ring = [...teams];
  if (ring.length % 2) ring.push(null);
  const fixtures = [];
  for (let round = 1; round < ring.length; round++) {
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i], b = ring[ring.length - 1 - i];
      if (a !== null && b !== null) fixtures.push({ round, teamA: a, teamB: b });
    }
    ring.splice(1, 0, ring.pop());
  }
  return fixtures;
}

export function createTournament({ name, teams, ballType, overs, ballsPerOver, players }, uuid = () => crypto.randomUUID()) {
  name = String(name || '').trim();
  if (!name || name.length > 80) throw Error('Tournament name must be 1–80 characters');
  teams = teams.map(n => n.trim()).filter(Boolean);
  if (teams.length < 2 || teams.length > 16) throw Error('Enter 2–16 teams, one per line');
  if (teams.some(n => n.length > 80) || new Set(teams.map(n => n.toLowerCase())).size !== teams.length) throw Error('Team names must be unique and at most 80 characters');
  for (const [value, min, max, label] of [[overs,1,50,'Overs'],[ballsPerOver,1,12,'Balls per over'],[players,2,22,'Players']]) {
    if (!Number.isInteger(+value) || +value < min || +value > max) throw Error(`${label}: enter ${min}–${max}`);
  }
  if (!['softball','hardball'].includes(ballType)) throw Error('Choose a ball type');
  return { id: uuid(), schemaVersion: 1, name, teams, format: 'league', ballType, overs: +overs, ballsPerOver: +ballsPerOver, players: +players, createdAt: new Date().toISOString(), fixtures: roundRobin(teams).map(f => ({ ...f, id: uuid() })) };
}

export function standings(tournament, matches) {
  const rows = new Map(tournament.teams.map(name => [name, { name, played: 0, won: 0, lost: 0, tied: 0, points: 0 }]));
  const byId = new Map(matches.map(m => [m.id, m]));
  for (const fixture of tournament.fixtures) {
    const match = byId.get(fixture.id);
    if (!match || match.settings.teamA !== fixture.teamA || match.settings.teamB !== fixture.teamB) continue;
    const state = replay(match);
    if (!state.finished) continue;
    const a = rows.get(fixture.teamA), b = rows.get(fixture.teamB);
    a.played++; b.played++;
    if (state.result.by === 'tie') { a.tied++; b.tied++; a.points++; b.points++; }
    else { const winner = state.result.winner === 'A' ? a : b, loser = winner === a ? b : a; winner.won++; winner.points += 2; loser.lost++; }
  }
  return [...rows.values()].sort((a,b) => b.points - a.points || a.name.localeCompare(b.name));
}

// Separate database avoids blocking the existing match store during upgrades.
let database;
async function db() {
  if (!database) database = new Promise((resolve,reject) => {
    const request = indexedDB.open('cricavo-tournaments',1);
    request.onupgradeneeded = () => request.result.createObjectStore('tournaments',{keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}
export async function listTournaments() {
  const database = await db();
  return new Promise((resolve,reject) => {
    const request = database.transaction('tournaments').objectStore('tournaments').getAll();
    request.onsuccess = () => resolve(request.result.sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    request.onerror = () => reject(request.error);
  });
}
export async function saveTournament(tournament) {
  const database = await db();
  return new Promise((resolve,reject) => {
    const transaction = database.transaction('tournaments','readwrite');
    transaction.objectStore('tournaments').add(tournament);
    transaction.oncomplete = () => resolve(tournament);
    transaction.onabort = transaction.onerror = () => reject(transaction.error || Error('Tournament saving failed'));
  });
}
