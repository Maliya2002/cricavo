import {test} from 'node:test';
import assert from 'node:assert/strict';
import {append,replay,undo} from '../dist/engine.js';
import {fieldingFigures} from '../dist/fielding.js';
import {matchAwards} from '../dist/awards.js';
import {createTournament} from '../dist/tournaments.js';
import {tournamentPlayerStats} from '../dist/tournament-stats.js';
import {tournamentBackup,restoreTournamentCopy} from '../dist/tournament-backups.js';
const config={name:'Notes',teams:['A','B'],overs:1,ballsPerOver:1,players:2,ballType:'softball'};
function sample(){const tournament=createTournament(config),fixture=tournament.fixtures[0];let match={id:fixture.id,tournamentId:tournament.id,schemaVersion:1,revision:0,events:[],audit:[],settings:{...config,teamA:fixture.teamA,teamB:fixture.teamB,battingFirst:'A',widePenalty:1,noBallPenalty:1}};for(const event of [{type:'start',striker:'A',nonStriker:'B',bowler:'X'},{type:'ball',kind:'normal',runs:4,running:0,boundary:true},{type:'start',striker:'X',nonStriker:'Y',bowler:'A'},{type:'ball',kind:'normal',runs:6,running:0,boundary:true}])match=append(match,event);return {tournament,match};}
const note={type:'fielding',innings:0,delivery:0,kind:'runsSaved',fielder:'Fielder',runs:2};
test('post-match observations preserve result and all score figures, aggregate separately, and undo cleanly',()=>{
  const {match}=sample(),before=replay(match),awards=matchAwards(match);
  let noted=append(match,note);noted=append(noted,{...note,kind:'droppedCatch',runs:0});noted=append(noted,{...note,innings:1,kind:'runsMissed',runs:3});
  const state=replay(noted);assert.deepEqual(state.result,before.result);assert(state.finished);
  for(let i=0;i<2;i++){const {fieldingNotes,...innings}=state.innings[i];assert.deepEqual(innings,before.innings[i]);}
  assert.deepEqual(matchAwards(noted),awards);
  const figures=fieldingFigures(state,noted.settings);assert.equal(figures.observations.length,3);assert.equal(figures.rows.find(r=>r.team==='B').runsSaved,2);assert.equal(figures.rows.find(r=>r.team==='B').droppedCatches,1);assert.equal(figures.rows.find(r=>r.team==='A').runsMissed,3);
  const reverted=undo(noted);assert.equal(fieldingFigures(replay(reverted),reverted.settings).observations.length,2);assert.equal(reverted.audit.at(-1).event.type,'fielding');
});
test('invalid note types, references and values are rejected before they can alter a score',()=>{
  const {match}=sample();
  for(const change of [{innings:2},{innings:-1},{delivery:1},{delivery:-1},{kind:'anything'},{runs:0},{runs:7},{runs:1.5},{fielder:''},{kind:'droppedCatch',runs:1}])assert.throws(()=>append(match,{...note,...change}));
  assert.throws(()=>append({...match,events:[]},note),/started innings/);
  assert.throws(()=>append({...match,events:match.events.slice(0,1)},note),/delivery/);
});
test('fielding observations survive tournament backup and aggregate without counting extra matches',()=>{
  const {tournament,match}=sample(),noted=append(match,note);
  const copy=restoreTournamentCopy(tournamentBackup(tournament,[noted]));
  const stats=tournamentPlayerStats(copy.tournament,copy.matches);
  assert.equal(stats.completedMatches,1);assert.equal(stats.fielding.rows[0].runsSaved,2);assert.equal(stats.fielding.rows[0].points,0);
});
