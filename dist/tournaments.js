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

export function knockoutBracket(teams, uuid = () => crypto.randomUUID()) {
  const size = 2 ** Math.ceil(Math.log2(teams.length));
  const seeds = [...teams, ...Array(size - teams.length).fill(null)];
  const fixtures = [];
  let previous = [];
  for (let i=0; i<size/2; i++) {
    const fixture = { id: uuid(), round: 1, teamA: seeds[i], teamB: seeds[size-1-i] };
    fixtures.push(fixture); previous.push(fixture);
  }
  let round = 2;
  while (previous.length > 1) {
    const next = [];
    for (let i=0; i<previous.length; i+=2) {
      const fixture = { id: uuid(), round, fromA: previous[i].id, fromB: previous[i+1].id };
      fixtures.push(fixture); next.push(fixture);
    }
    previous = next; round++;
  }
  return fixtures;
}

export function resolvedFixtures(tournament, matches) {
  if (tournament.format !== 'knockout') return tournament.fixtures.map(f => ({...f, ready:true}));
  const results = new Map(), byId = new Map(matches.map(m => [m.id,m]));
  for (const fixture of tournament.fixtures) {
    const sourceA = fixture.fromA ? results.get(fixture.fromA) : null;
    const sourceB = fixture.fromB ? results.get(fixture.fromB) : null;
    const teamA = fixture.fromA ? sourceA?.winner : fixture.teamA;
    const teamB = fixture.fromB ? sourceB?.winner : fixture.teamB;
    const waiting = (!!fixture.fromA && !sourceA?.winner) || (!!fixture.fromB && !sourceB?.winner);
    const bye = !waiting && (!teamA || !teamB);
    const match = byId.get(fixture.id);
    const conflict = !!match && (waiting || match.settings.teamA !== teamA || match.settings.teamB !== teamB);
    let winner = bye ? (teamA || teamB) : null, tied = false, decision = null;
    if (match && !conflict && !bye) {
      const state = replay(match);
      if (state.finished) {
        tied = state.result.by === 'tie';
        if (!tied) winner = state.result.winner === 'A' ? teamA : teamB;
        else {
          const latest = (tournament.decisions || []).filter(d => d.fixtureId === fixture.id).at(-1);
          if (latest?.winner && latest.signature === decisionSignature(match) && [teamA,teamB].includes(latest.winner)) { decision = latest; winner = latest.winner; }
        }
      }
    }
    results.set(fixture.id, {...fixture,teamA,teamB,waiting,bye,conflict,tied,decision,winner,ready:!waiting&&!bye&&!conflict});
  }
  return [...results.values()];
}

function decisionSignature(match) { return JSON.stringify([match.revision,match.settings,match.events]); }

export function recordAdvancement(tournament, matches, {fixtureId, winner, reason, recordedBy}) {
  if (tournament.format !== 'knockout') throw Error('Advancement decisions require a knockout tournament');
  const fixture = resolvedFixtures(tournament,matches).find(f => f.id === fixtureId);
  const match = matches.find(m => m.id === fixtureId);
  if (!fixture?.tied || fixture.conflict || !match) throw Error('Only a completed, tied match can have an advancement decision');
  if (winner !== null && ![fixture.teamA,fixture.teamB].includes(winner)) throw Error('Choose one of the tied teams');
  reason = String(reason || '').trim(); recordedBy = String(recordedBy || '').trim();
  if (reason.length < 5 || reason.length > 300) throw Error('Enter a reason (5–300 characters)');
  if (!recordedBy || recordedBy.length > 80) throw Error('Enter the decision recorder name (1–80 characters)');
  return {...tournament, revision:(tournament.revision || 0)+1, decisions:[...(tournament.decisions || []), {id:crypto.randomUUID(), fixtureId, winner, reason, recordedBy, at:new Date().toISOString(), signature:decisionSignature(match)}]};
}

export function createTournament({ name, teams, ballType, overs, ballsPerOver, players, format = 'league' }, uuid = () => crypto.randomUUID()) {
  name = String(name || '').trim();
  if (!name || name.length > 80) throw Error('Tournament name must be 1–80 characters');
  teams = teams.map(n => n.trim()).filter(Boolean);
  if (teams.length < 2 || teams.length > 16) throw Error('Enter 2–16 teams, one per line');
  if (teams.some(n => n.length > 80) || new Set(teams.map(n => n.toLowerCase())).size !== teams.length) throw Error('Team names must be unique and at most 80 characters');
  for (const [value, min, max, label] of [[overs,1,50,'Overs'],[ballsPerOver,1,12,'Balls per over'],[players,2,22,'Players']]) {
    if (!Number.isInteger(+value) || +value < min || +value > max) throw Error(`${label}: enter ${min}–${max}`);
  }
  if (!['softball','hardball'].includes(ballType)) throw Error('Choose a ball type');
  if (!['league','knockout'].includes(format)) throw Error('Choose league or knockout');
  return { id: uuid(), schemaVersion: 1, name, teams, format, ballType, overs: +overs, ballsPerOver: +ballsPerOver, players: +players, createdAt: new Date().toISOString(), fixtures: format === 'knockout' ? knockoutBracket(teams,uuid) : roundRobin(teams).map(f => ({ ...f, id: uuid() })) };
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
export async function saveTournament(tournament, expectedRevision = null) {
  const database = await db();
  return new Promise((resolve,reject) => {
    const transaction = database.transaction('tournaments','readwrite');
    const store = transaction.objectStore('tournaments');
    let failure;
    if (expectedRevision === null) store.add(tournament);
    else {
      const request = store.get(tournament.id);
      request.onsuccess = () => {
        if (!request.result || (request.result.revision || 0) !== expectedRevision) {
          failure = Error('Tournament changed in another tab. Refresh before saving.'); transaction.abort(); return;
        }
        store.put(tournament);
      };
    }
    transaction.oncomplete = () => resolve(tournament);
    transaction.onabort = transaction.onerror = () => reject(failure || transaction.error || Error('Tournament saving failed'));
  });
}
