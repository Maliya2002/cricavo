import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,resolvedFixtures,recordAdvancement} from '../dist/tournaments.js';
import {append} from '../dist/engine.js';
import {tournamentBackup,validateTournamentBackup,restoreTournamentCopy,saveTournamentCopy} from '../dist/tournament-backups.js';

const config={name:'Weekend',teams:['A','B','C','D'],ballType:'softball',overs:1,ballsPerOver:1,players:2};
function tiedMatch(tournament){
  const f=resolvedFixtures(tournament,[])[0];
  let match={id:f.id,tournamentId:tournament.id,schemaVersion:1,revision:0,audit:[],events:[],settings:{...config,teamA:f.teamA,teamB:f.teamB,battingFirst:'A',widePenalty:1,noBallPenalty:1,freeHit:true}};
  for(const event of [{type:'start',striker:'a',nonStriker:'b',bowler:'c'},{type:'ball',kind:'normal',runs:4,running:0,boundary:true},{type:'start',striker:'c',nonStriker:'d',bowler:'a'},{type:'ball',kind:'normal',runs:4,running:0,boundary:true}])match=append(match,event);
  return match;
}
test('restored knockout remaps all dependencies and preserves tied advancement without mutating source',()=>{
  let tournament=createTournament({...config,format:'knockout'});
  const match=tiedMatch(tournament);
  tournament=recordAdvancement(tournament,[match],{fixtureId:match.id,winner:match.settings.teamA,reason:'Approved bowl out',recordedBy:'Referee'});
  const raw=tournamentBackup(tournament,[match]),before=JSON.stringify(raw),copy=restoreTournamentCopy(raw);
  assert.notEqual(copy.tournament.id,tournament.id);
  assert.equal(copy.matches[0].tournamentId,copy.tournament.id);
  assert.notEqual(copy.matches[0].id,match.id);
  assert.equal(copy.tournament.fixtures.at(-1).fromA,copy.matches[0].id);
  assert.equal(copy.tournament.decisions[0].fixtureId,copy.matches[0].id);
  assert.equal(resolvedFixtures(copy.tournament,copy.matches)[0].winner,match.settings.teamA);
  assert.equal(JSON.stringify(raw),before);
  validateTournamentBackup(tournamentBackup(copy.tournament,copy.matches));
});
test('group templates keep rank sources and remap winner/loser fixture sources',()=>{
  const tournament=createTournament({...config,format:'groups',groups:[{name:'A',teams:['A','B']},{name:'B',teams:['C','D']}],playoffs:'qualifier'});
  const copy=restoreTournamentCopy(tournamentBackup(tournament,[]));
  const playoffs=copy.tournament.fixtures.filter(f=>f.stage==='playoff');
  assert.deepEqual(playoffs[0].sourceA,{type:'rank',group:'g0',rank:1});
  assert.equal(playoffs[2].sourceA.fixture,playoffs[0].id);
  assert.equal(playoffs[2].sourceA.type,'loser');
  assert.equal(playoffs[3].sourceB.fixture,playoffs[2].id);
});
test('backup excludes unrelated matches and rejects corrupted or unsafe draw inputs',()=>{
  const tournament=createTournament({...config,format:'knockout'}),match=tiedMatch(tournament);
  const raw=tournamentBackup(tournament,[match,{id:crypto.randomUUID()}]);assert.equal(raw.matches.length,1);
  for(const mutate of [
    b=>b.version=2,
    b=>b.tournament.fixtures[0].id='"><script>',
    b=>b.tournament.fixtures[0].fromA=b.tournament.fixtures.at(-1).id,
    b=>b.tournament.fixtures.push({...b.tournament.fixtures[0]}),
    b=>b.matches.push({...b.matches[0]}),
    b=>b.matches[0].tournamentId=crypto.randomUUID(),
    b=>b.matches[0].events.push({type:'unknown'}),
    b=>b.tournament.teams.push('A')
  ]){const bad=structuredClone(raw);mutate(bad);assert.throws(()=>validateTournamentBackup(bad));}
});
test('restore failure does not claim success or remove existing matches',async()=>{
  const copy=restoreTournamentCopy(tournamentBackup(createTournament({...config,format:'league'}),[]));
  const calls=[];
  await assert.rejects(saveTournamentCopy(copy,{saveMatches:async()=>{throw Error('Quota full');},saveTournament:async()=>calls.push('draw')}),/Quota full/);
  assert.deepEqual(calls,[]);
  await assert.rejects(saveTournamentCopy(copy,{saveMatches:async()=>calls.push('matches'),saveTournament:async()=>{throw Error('Quota full');}}),/original data is unchanged/);
  assert.deepEqual(calls,['matches']);
  const saved=await saveTournamentCopy(copy,{saveMatches:async()=>{},saveTournament:async()=>{}});assert.equal(saved.id,copy.tournament.id);
});
