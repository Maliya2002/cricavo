import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTournament} from '../dist/tournaments.js';
import {append,undo} from '../dist/engine.js';
import {tournamentPlayerStats,playerStatsView} from '../dist/tournament-stats.js';
const config={name:'Cup',teams:['A','B'],overs:1,ballsPerOver:2,players:2,ballType:'softball',cycles:2};
function finished(f,{runOut=false,wideChase=false}={}){
  let m={id:f.id,events:[],revision:0,audit:[],settings:{...config,teamA:f.teamA,teamB:f.teamB,battingFirst:'A',widePenalty:1,noBallPenalty:1}};
  m=append(m,{type:'start',striker:'Sam',nonStriker:'Partner',bowler:'Sam'});
  if(!wideChase)m=append(m,{type:'ball',kind:'normal',runs:4,running:0,boundary:true});
  m=append(m,{type:'ball',kind:'normal',runs:0,running:0,wicket:runOut?'runOut':'bowled',...(runOut?{out:'striker',nextEnd:'striker'}:{})});
  m=append(m,{type:'start',striker:'Sam',nonStriker:'Partner',bowler:'Sam'});
  return append(m,wideChase?{type:'ball',kind:'wide',runs:0,running:0}:{type:'ball',kind:'normal',runs:6,running:0,boundary:true});
}
test('stats aggregate by team and name, use weighted rates and preserve equal ranks',()=>{
  const tournament=createTournament(config),matches=tournament.fixtures.map(f=>finished(f));
  const before=JSON.stringify(matches),stats=tournamentPlayerStats(tournament,matches);
  assert.equal(stats.completedMatches,2);
  const sams=stats.batting.filter(r=>r.name==='Sam');assert.equal(sams.length,2);
  for(const row of sams){assert.equal(row.runs,10);assert.equal(row.balls,3);assert.equal(row.average,10);assert(Math.abs(row.strikeRate-1000/3)<1e-10);assert.equal(row.rank,1);}
  for(const row of stats.bowling){assert.equal(row.wickets,1);assert.equal(row.runs,10);assert.equal(row.balls,3);assert.equal(row.economy,20);}
  assert.equal(JSON.stringify(matches),before);
});
test('run outs are not bowler wickets, zero-ball chases have no infinite rates, and undo removes unfinished match stats',()=>{
  const tournament=createTournament({...config,cycles:1}),f=tournament.fixtures[0];
  const match=finished(f,{runOut:true,wideChase:true}),stats=tournamentPlayerStats(tournament,[match]);
  assert(stats.bowling.every(r=>r.wickets===0&&r.average===null));
  const bowler=stats.bowling.find(r=>r.team===f.teamA);assert.equal(bowler.runs,1);assert.equal(bowler.balls,0);assert.equal(bowler.economy,null);
  assert(stats.batting.filter(r=>r.team===f.teamB).every(r=>r.strikeRate===null));
  assert.equal(tournamentPlayerStats(tournament,[undo(match)]).completedMatches,0);
  assert.equal(tournamentPlayerStats(tournament,[{...match,id:crypto.randomUUID()}]).batting.length,0);
});
test('conflicted fixture scores are excluded and player names are escaped in rendered tables',()=>{
  const tournament=createTournament({...config,cycles:1}),f=tournament.fixtures[0],match=finished(f);
  assert.equal(tournamentPlayerStats(tournament,[{...match,settings:{...match.settings,teamA:'Other'}}]).completedMatches,0);
  for(const e of match.events){if(e.striker==='Sam')e.striker='<Sam>';if(e.bowler==='Sam')e.bowler='<Sam>';}
  const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const html=playerStatsView(tournament,[match],{t:en=>en,esc});assert(!html.includes('<Sam>'));assert(html.includes('&lt;Sam>'));
});
