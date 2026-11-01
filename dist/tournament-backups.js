import { createTournament } from './tournaments.js';
import { validateSnapshot } from './cloud-backups.js';

export const MAX_TOURNAMENT_BACKUP_BYTES=25000000;
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};

export function validateTournamentBackup(bundle) {
  requireValue(bundle?.kind==='cricavo-tournament'&&bundle.version===1,'Unsupported tournament backup');
  requireValue(new TextEncoder().encode(JSON.stringify(bundle)).length<=MAX_TOURNAMENT_BACKUP_BYTES,'Tournament backup exceeds 25 MB');
  const tournament=bundle.tournament;
  requireValue(tournament&&idPattern.test(tournament.id)&&tournament.schemaVersion===1,'Invalid tournament identity');
  requireValue(['league','groups','manual','knockout'].includes(tournament.format),'Unsupported tournament format');
  requireValue(Array.isArray(tournament.teams),'Missing team list');
  // Validate rules and names without generating another potentially large draw.
  const validated=createTournament({...tournament,format:'manual',cycles:1});
  requireValue(JSON.stringify(validated.teams)===JSON.stringify(tournament.teams),'Invalid team names');
  const groups=tournament.groups||[];
  requireValue(Array.isArray(groups),'Invalid groups');
  const groupMap=new Map();
  for(const group of groups){
    requireValue(typeof group.id==='string'&&/^g\d+$/.test(group.id)&&!groupMap.has(group.id),'Invalid or duplicate group identity');
    requireValue(typeof group.name==='string'&&group.name.length<=80&&Array.isArray(group.teams)&&group.teams.length>0,'Invalid group');
    requireValue(group.teams.every(team=>tournament.teams.includes(team)),'Unknown group team');
    groupMap.set(group.id,group);
  }
  if(groups.length){const assigned=groups.flatMap(g=>g.teams);requireValue(assigned.length===tournament.teams.length&&new Set(assigned).size===assigned.length,'Each team must belong to exactly one group');}
  requireValue(tournament.format!=='groups'||groups.length>0,'Missing groups');
  requireValue(Array.isArray(tournament.fixtures)&&tournament.fixtures.length<=10000,'Invalid fixture list (maximum 10,000)');
  const fixtureMap=new Map();
  for(const fixture of tournament.fixtures){
    requireValue(idPattern.test(fixture.id)&&!fixtureMap.has(fixture.id),'Invalid or duplicate fixture identity');
    requireValue(Number.isSafeInteger(fixture.round)&&fixture.round>0,'Invalid fixture round');
    requireValue(fixture.label===undefined||typeof fixture.label==='string'&&fixture.label.length<=80,'Invalid fixture label');
    requireValue(fixture.stage===undefined||['league','playoff'].includes(fixture.stage),'Invalid fixture stage');
    requireValue(fixture.group===undefined||groupMap.has(fixture.group),'Unknown fixture group');
    for(const side of ['A','B']) {
      const source=fixture['source'+side],from=fixture['from'+side],team=fixture['team'+side];
      requireValue([source!==undefined,from!==undefined,team!==undefined&&team!==null].filter(Boolean).length<=1,'Ambiguous fixture participant');
      if(source){
        if(source.type==='team')requireValue(tournament.teams.includes(source.team),'Unknown participant');
        else if(source.type==='rank')requireValue(groupMap.has(source.group)&&Number.isInteger(source.rank)&&source.rank>=1&&source.rank<=groupMap.get(source.group).teams.length,'Invalid group position');
        else requireValue(['winner','loser'].includes(source.type)&&fixtureMap.has(source.fixture),'Invalid result dependency');
      }else if(from)requireValue(fixtureMap.has(from),'Invalid bracket dependency');
      else requireValue(tournament.teams.includes(team)||(tournament.format==='knockout'&&team===null),'Unknown fixture team');
    }
    if(fixture.stage==='league')requireValue(tournament.teams.includes(fixture.teamA)&&tournament.teams.includes(fixture.teamB)&&(!fixture.group||[fixture.teamA,fixture.teamB].every(team=>groupMap.get(fixture.group).teams.includes(team))),'Invalid league participants');
    fixtureMap.set(fixture.id,fixture);
  }
  requireValue(Array.isArray(bundle.matches),'Missing matches');
  const matchIds=new Set();
  for(const match of bundle.matches){
    requireValue(fixtureMap.has(match.id)&&!matchIds.has(match.id)&&match.tournamentId===tournament.id,'Duplicate or unrelated match');
    requireValue(Number.isSafeInteger(match.revision)&&match.revision>=0,'Invalid match revision');
    requireValue(Array.isArray(match.audit),'Invalid match audit history');
    requireValue(tournament.teams.includes(match.settings?.teamA)&&tournament.teams.includes(match.settings?.teamB),'Unknown match team');
    validateSnapshot(match);matchIds.add(match.id);
  }
  requireValue(tournament.decisions===undefined||Array.isArray(tournament.decisions),'Invalid advancement history');
  for(const decision of tournament.decisions||[])requireValue(fixtureMap.has(decision.fixtureId)&&(decision.winner===null||tournament.teams.includes(decision.winner))&&typeof decision.signature==='string'&&typeof decision.reason==='string'&&typeof decision.recordedBy==='string'&&typeof decision.at==='string','Invalid advancement decision');
  return bundle;
}

export function tournamentBackup(tournament,matches) {
  const ids=new Set(tournament.fixtures.map(f=>f.id));
  return validateTournamentBackup({kind:'cricavo-tournament',version:1,exportedAt:new Date().toISOString(),tournament,matches:matches.filter(m=>ids.has(m.id))});
}

export function restoreTournamentCopy(raw,uuid=()=>crypto.randomUUID()) {
  const bundle=structuredClone(validateTournamentBackup(raw)),tournament=bundle.tournament;
  const newId=uuid(),ids=new Map(tournament.fixtures.map(f=>[f.id,uuid()]));
  for(const fixture of tournament.fixtures){
    fixture.id=ids.get(fixture.id);
    for(const side of ['A','B']){
      if(fixture['from'+side])fixture['from'+side]=ids.get(fixture['from'+side]);
      const source=fixture['source'+side];if(source?.fixture)source.fixture=ids.get(source.fixture);
    }
  }
  for(const decision of tournament.decisions||[]){decision.id=uuid();decision.fixtureId=ids.get(decision.fixtureId);}
  const now=new Date().toISOString();
  tournament.restoredFrom=tournament.id;tournament.id=newId;tournament.revision=0;tournament.createdAt=now;
  tournament.name=(tournament.name.slice(0,69)+' (restored)').slice(0,80);
  for(const match of bundle.matches){match.id=ids.get(match.id);match.tournamentId=newId;match.createdAt=now;match.updatedAt=now;match.restored=true;}
  return {tournament,matches:bundle.matches};
}

// Both stores predate bundle restore and live in separate IndexedDB databases.
// Scores are committed atomically first. If the draw write fails, keep the scores
// recoverable and report partial failure instead of deleting user-visible data.
export async function saveTournamentCopy(copy,{saveMatches,saveTournament}) {
  await saveMatches(copy.matches);
  try {await saveTournament(copy.tournament);}
  catch(error){throw Error(`Draw could not be saved. ${copy.matches.length} restored match copies remain in Matches; the original data is unchanged. ${error.message}`);}
  return copy.tournament;
}
