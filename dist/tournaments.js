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
  const results = new Map(), byId = new Map(matches.map(m => [m.id,m]));
  const rankTeam = source => {
    const group = (tournament.groups || []).find(g=>g.id===source.group);
    if (!group) return null;
    const groupFixtures=tournament.fixtures.filter(f=>f.group===group.id && f.stage==='league');
    if (group.teams.length===1 && source.rank===1) return group.teams[0];
    if (!groupFixtures.length || groupFixtures.some(f=>{const m=byId.get(f.id);return !m||m.settings.teamA!==f.teamA||m.settings.teamB!==f.teamB||!replay(m).finished;})) return null;
    const rows=standings({...tournament,teams:group.teams,fixtures:groupFixtures},matches);
    const row=rows[source.rank-1];
    if(!row)return null;
    // Alphabetical order is display-only: it must never decide qualification.
    if(rows.some((r,i)=>i!==source.rank-1&&r.points===row.points&&((r.nrr===null&&row.nrr===null)||(r.nrr!==null&&row.nrr!==null&&Math.abs(r.nrr-row.nrr)<1e-9))))return null;
    return row.name;
  };
  const resolveSource = source => {
    if(source.type==='team')return source.team;
    if(source.type==='rank')return rankTeam(source);
    const previous=results.get(source.fixture);
    return source.type==='loser'?previous?.loser:previous?.winner;
  };
  for (const fixture of tournament.fixtures) {
    const sourceA = fixture.fromA ? results.get(fixture.fromA) : null;
    const sourceB = fixture.fromB ? results.get(fixture.fromB) : null;
    const teamA = fixture.sourceA ? resolveSource(fixture.sourceA) : fixture.fromA ? sourceA?.winner : fixture.teamA;
    const teamB = fixture.sourceB ? resolveSource(fixture.sourceB) : fixture.fromB ? sourceB?.winner : fixture.teamB;
    const waiting = (!!fixture.sourceA&&!teamA)|| (!!fixture.sourceB&&!teamB)|| (!!fixture.fromA && !sourceA?.winner) || (!!fixture.fromB && !sourceB?.winner);
    const bye = !waiting && (!teamA || !teamB);
    const match = byId.get(fixture.id);
    const conflict = (!!teamA && teamA===teamB) || (!!match && (waiting || match.settings.teamA !== teamA || match.settings.teamB !== teamB));
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
    const loser=winner&&!bye?(winner===teamA?teamB:teamA):null;
    results.set(fixture.id, {...fixture,teamA,teamB,waiting,bye,conflict,tied,decision,winner,loser,ready:!waiting&&!bye&&!conflict});
  }
  return [...results.values()];
}

function decisionSignature(match) { return JSON.stringify([match.revision,match.settings,match.events]); }

export function recordAdvancement(tournament, matches, {fixtureId, winner, reason, recordedBy}) {
  const fixture = resolvedFixtures(tournament,matches).find(f => f.id === fixtureId);
  if (tournament.format !== 'knockout' && fixture?.stage !== 'playoff') throw Error('Advancement decisions require a knockout or playoff match');
  const match = matches.find(m => m.id === fixtureId);
  if (!fixture?.tied || fixture.conflict || !match) throw Error('Only a completed, tied match can have an advancement decision');
  if (winner !== null && ![fixture.teamA,fixture.teamB].includes(winner)) throw Error('Choose one of the tied teams');
  reason = String(reason || '').trim(); recordedBy = String(recordedBy || '').trim();
  if (reason.length < 5 || reason.length > 300) throw Error('Enter a reason (5–300 characters)');
  if (!recordedBy || recordedBy.length > 80) throw Error('Enter the decision recorder name (1–80 characters)');
  return {...tournament, revision:(tournament.revision || 0)+1, decisions:[...(tournament.decisions || []), {id:crypto.randomUUID(), fixtureId, winner, reason, recordedBy, at:new Date().toISOString(), signature:decisionSignature(match)}]};
}

export function pointsRules(raw = {}) {
  const rules = {win:Number(raw.win ?? 2),tie:Number(raw.tie ?? 1),loss:Number(raw.loss ?? 0)};
  if (Object.values(rules).some(v => !Number.isInteger(v) || v < 0 || v > 20)) throw Error('Points must be whole numbers from 0 to 20');
  if (rules.win < rules.tie || rules.tie < rules.loss || rules.win === rules.loss) throw Error('Win points must exceed loss points; tie points must be between them');
  return rules;
}

export function createTournament({ name, teams, ballType, overs, ballsPerOver, players, format = 'league', points, groups=[], cycles=1, playoffs='none' }, uuid = () => crypto.randomUUID()) {
  name = String(name || '').trim();
  if (!name || name.length > 80) throw Error('Tournament name must be 1–80 characters');
  teams = teams.map(n => n.trim()).filter(Boolean);
  if (teams.length < 2) throw Error('Enter at least 2 teams, one per line');
  if (teams.some(n => n.length > 80) || new Set(teams.map(n => n.toLowerCase())).size !== teams.length) throw Error('Team names must be unique and at most 80 characters');
  for (const [value, min, max, label] of [[overs,1,50,'Overs'],[ballsPerOver,1,12,'Balls per over'],[players,2,22,'Players']]) {
    if (!Number.isInteger(+value) || +value < min || +value > max) throw Error(`${label}: enter ${min}–${max}`);
  }
  if (!['softball','hardball'].includes(ballType)) throw Error('Choose a ball type');
  if (!['league','knockout','groups','manual'].includes(format)) throw Error('Choose a tournament format');
  cycles=Number(cycles);
  if(!Number.isSafeInteger(cycles)||cycles<1)throw Error('Choose a positive whole number of league meetings per pair');
  const rules = pointsRules(points);
  const tournament={ id: uuid(), schemaVersion: 1, name, teams, format, points:rules, ballType, overs: +overs, ballsPerOver: +ballsPerOver, players: +players, createdAt: new Date().toISOString(), fixtures:[],groups:[],cycles,playoffs };
  if(format==='knockout'){tournament.fixtures=knockoutBracket(teams,uuid);return tournament;}
  if(format==='manual')return tournament;
  if(format==='groups') {
    if(groups.length<1||groups.length>teams.length)throw Error('Choose between 1 group and the number of teams');
    const assigned=groups.flatMap(g=>g.teams);
    if(groups.some(g=>g.teams.length<1)||assigned.length!==teams.length||new Set(assigned).size!==teams.length||assigned.some(n=>!teams.includes(n)))throw Error('Each team must be in exactly one group; groups cannot be empty');
    tournament.groups=groups.map((g,i)=>({id:'g'+i,name:String(g.name||'Group '+(i+1)).trim().slice(0,80),teams:[...g.teams]}));
  } else tournament.groups=[{id:'g0',name:'League',teams:[...teams]}];
  const fixtureCount=tournament.groups.reduce((n,g)=>n+g.teams.length*(g.teams.length-1)/2*cycles,0);
  if(fixtureCount>10000)throw Error('This automatic draw exceeds 10,000 matches. Use more groups, fewer meetings, or a manual draw.');
  for(const group of tournament.groups) {
    if(group.teams.length<2)continue;
    const schedule=roundRobin(group.teams), rounds=schedule.reduce((max,f)=>Math.max(max,f.round),0);
    for(let cycle=0;cycle<cycles;cycle++)tournament.fixtures.push(...schedule.map(f=>({...f,id:uuid(),round:f.round+cycle*rounds,cycle:cycle+1,group:group.id,stage:'league',...(cycle%2?{teamA:f.teamB,teamB:f.teamA}:{})})));
  }
  if(!['none','semis','qualifier'].includes(playoffs))throw Error('Choose a playoff template');
  if(playoffs!=='none') {
    if(tournament.groups.length!==2||tournament.groups.some(g=>g.teams.length<2))throw Error('Automatic playoff templates require exactly two groups with at least two teams each');
    const rank=(group,rank)=>({type:'rank',group,rank});
    const winner=fixture=>({type:'winner',fixture}), loser=fixture=>({type:'loser',fixture});
    const add=(label,a,b,round)=>{const f={id:uuid(),label,stage:'playoff',sourceA:a,sourceB:b,round};tournament.fixtures.push(f);return f.id;};
    if(playoffs==='semis') {
      const one=add('Semi-final 1',rank('g0',1),rank('g1',2),1),two=add('Semi-final 2',rank('g1',1),rank('g0',2),1);
      add('Final',winner(one),winner(two),2);
    }else {
      const q1=add('Qualifier 1',rank('g0',1),rank('g1',1),1),e=add('Eliminator',rank('g0',2),rank('g1',2),1);
      const q2=add('Qualifier 2',loser(q1),winner(e),2);add('Final',winner(q1),winner(q2),3);
    }
  }
  return tournament;
}

export function fixtureSchedule(input={}) {
  const scheduledStart=String(input.scheduledStart||'').trim(),timeZone=String(input.timeZone||'Asia/Colombo').trim(),venue=String(input.venue||'').trim();
  if(venue.length>160)throw Error('Venue must be at most 160 characters');
  if(scheduledStart){
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledStart))throw Error('Enter a valid date and time');
    const date=new Date(scheduledStart+':00Z');
    if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,16)!==scheduledStart)throw Error('Enter a valid calendar date and time');
  }
  try{new Intl.DateTimeFormat('en',{timeZone}).format(0);}catch{throw Error('Enter a valid time zone, for example Asia/Colombo');}
  return {scheduledStart,timeZone,venue};
}

export function updateFixtureSchedule(tournament,fixtureId,input) {
  if(!tournament.fixtures.some(f=>f.id===fixtureId))throw Error('Fixture not found');
  const schedule=fixtureSchedule(input);
  return {...tournament,revision:(tournament.revision||0)+1,fixtures:tournament.fixtures.map(f=>f.id===fixtureId?{...f,...schedule}:f)};
}

export function updateDraw(tournament,matches,input,uuid=()=>crypto.randomUUID()) {
  const fixtures=[...tournament.fixtures], index=input.id?fixtures.findIndex(f=>f.id===input.id):fixtures.length;
  if(index<0)throw Error('Fixture not found');
  if(input.id&&matches.some(m=>m.id===input.id))throw Error('A match already set up cannot be edited or removed');
  const depends=(f,id)=>f.fromA===id||f.fromB===id||[f.sourceA,f.sourceB].some(s=>s?.fixture===id);
  if(input.remove) {
    if(tournament.awardFinalId===input.id)throw Error('Choose another awards final or all-team eligibility before removing this fixture');
    if(fixtures.some(f=>depends(f,input.id)))throw Error('Remove dependent fixtures first');
    fixtures.splice(index,1);
  } else {
    const validate=source=>{
      if(source?.type==='team'&&tournament.teams.includes(source.team))return {...source};
      if(source?.type==='rank') {
        const group=(tournament.groups||[]).find(g=>g.id===source.group);
        if(group&&Number.isInteger(source.rank)&&source.rank>=1&&source.rank<=group.teams.length)return {...source};
      }
      if(['winner','loser'].includes(source?.type)&&fixtures.slice(0,index).some(f=>f.id===source.fixture))return {...source};
      throw Error('Choose a team, valid group position, or an earlier match result');
    };
    const sourceA=validate(input.sourceA),sourceB=validate(input.sourceB);
    if(JSON.stringify(sourceA)===JSON.stringify(sourceB))throw Error('Choose different participants');
    const round=Number(input.round);
    if(!Number.isSafeInteger(round)||round<1)throw Error('Round must be a positive whole number');
    const stage=input.stage==='league'?'league':'playoff';
    const group=stage==='league'?(tournament.groups||[]).find(g=>g.id===input.group):null;
    if(stage==='league'&&(sourceA.type!=='team'||sourceB.type!=='team'||(tournament.groups?.length&&!group)||group&&(!group.teams.includes(sourceA.team)||!group.teams.includes(sourceB.team))))throw Error('League matches need two teams from the selected group');
    const fixture={...fixtureSchedule(fixtures[index]),id:input.id||uuid(),round,label:String(input.label||'').trim().slice(0,80),stage,group:group?.id};
    if(stage==='league'){fixture.teamA=sourceA.team;fixture.teamB=sourceB.team;}else{fixture.sourceA=sourceA;fixture.sourceB=sourceB;}
    fixtures[index]=fixture;
  }
  // Do not rewrite the qualifying schedule once a dependent playoff is set up.
  const old=tournament.fixtures[index];
  const changedGroups=new Set([old?.group,input.remove?undefined:fixtures[index]?.group].filter(Boolean));
  if(tournament.fixtures.some(f=>matches.some(m=>m.id===f.id)&&[f.sourceA,f.sourceB].some(s=>s?.type==='rank'&&changedGroups.has(s.group))))throw Error('This group has a playoff already set up; its league draw is locked');
  return {...tournament,fixtures,revision:(tournament.revision||0)+1};
}

export function standings(tournament, matches) {
  const points = pointsRules(tournament.points);
  const rows = new Map(tournament.teams.map(name => [name, { name, played: 0, won: 0, lost: 0, tied: 0, points: 0, runsFor:0, runsAgainst:0, oversFor:0, oversAgainst:0, nrr:null }]));
  const byId = new Map(matches.map(m => [m.id, m]));
  for (const fixture of tournament.fixtures) {
    if(fixture.stage==='playoff')continue;
    const match = byId.get(fixture.id);
    if (!match || match.settings.teamA !== fixture.teamA || match.settings.teamB !== fixture.teamB) continue;
    const state = replay(match);
    if (!state.finished) continue;
    const a = rows.get(fixture.teamA), b = rows.get(fixture.teamB);
    a.played++; b.played++;
    if (state.result.by === 'tie') { a.tied++; b.tied++; a.points += points.tie; b.points += points.tie; }
    else { const winner = state.result.winner === 'A' ? a : b, loser = winner === a ? b : a; winner.won++; winner.points += points.win; loser.lost++; loser.points += points.loss; }
    for (const innings of state.innings) {
      const batting = innings.team === 'A' ? a : b, bowling = batting === a ? b : a;
      // All-out uses the entitled quota. Otherwise use actual balls, never
      // cricket's display notation (e.g. 4.2 is not 4.2 decimal overs).
      const overs = innings.wickets >= match.settings.players - 1 ? match.settings.overs : innings.balls / match.settings.ballsPerOver;
      batting.runsFor += innings.total; batting.oversFor += overs;
      bowling.runsAgainst += innings.total; bowling.oversAgainst += overs;
    }
  }
  for (const row of rows.values()) {
    if (row.oversFor > 0 && row.oversAgainst > 0) row.nrr = row.runsFor / row.oversFor - row.runsAgainst / row.oversAgainst;
  }
  return [...rows.values()].sort((a,b) => b.points - a.points || (a.nrr === null ? (b.nrr === null ? 0 : 1) : b.nrr === null ? -1 : b.nrr - a.nrr) || a.name.localeCompare(b.name));
}

export function formatNRR(value) {
  if (value === null || !Number.isFinite(value)) return '—';
  const rounded = Math.abs(value) < 0.0005 ? 0 : value;
  return (rounded >= 0 ? '+' : '') + rounded.toFixed(3);
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
