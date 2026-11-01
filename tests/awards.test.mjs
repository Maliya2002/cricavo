import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,resolvedFixtures,recordAdvancement} from '../dist/tournaments.js';
import {append,undo} from '../dist/engine.js';
import {matchAwards,tournamentAwards,tournamentAwardView,matchAwardView} from '../dist/awards.js';
import {tournamentBackup,restoreTournamentCopy} from '../dist/tournament-backups.js';
const settings={name:'Awards cup',teams:['A','B'],overs:1,ballsPerOver:2,players:2,ballType:'softball'};
function complete(t,f,{runOut=false,zero=false,tie=false}={}){
  let m={id:f.id,tournamentId:t.id,schemaVersion:1,events:[],audit:[],revision:0,settings:{...settings,teamA:f.teamA,teamB:f.teamB,battingFirst:'A',widePenalty:1,noBallPenalty:1}};
  m=append(m,{type:'start',striker:'Sam',nonStriker:'Partner',bowler:'Sam'});
  m=append(m,{type:'ball',kind:'normal',runs:zero?0:4,running:0,boundary:!zero});
  m=append(m,{type:'ball',kind:'normal',runs:0,running:0,...(!tie?{wicket:runOut?'runOut':'bowled',...(runOut?{out:'striker',nextEnd:'striker'}:{})}:{})});
  m=append(m,{type:'start',striker:'Sam',nonStriker:'Partner',bowler:'Sam'});
  m=append(m,zero&&!tie?{type:'ball',kind:'wide',runs:0,running:0}:{type:'ball',kind:'normal',runs:zero?0:tie?4:6,running:0,boundary:!zero});
  if(tie)m=append(m,{type:'ball',kind:'normal',runs:0,running:0});
  return m;
}
test('match award combines runs and credited wickets for same player and separates opposing names',()=>{
  const t=createTournament(settings),m=complete(t,t.fixtures[0]),before=JSON.stringify(m),a=matchAwards(m);
  assert(a.completed);assert.equal(a.manOfMatch.length,1);
  assert.deepEqual(a.manOfMatch[0],{name:'Sam',team:m.settings.teamB,runs:6,wickets:1,points:26});
  assert.equal(a.players.filter(p=>p.name==='Sam').length,2);assert.equal(JSON.stringify(m),before);
  assert.equal(matchAwards(undo(m)).manOfMatch.length,0);
});
test('run outs and extras earn no points; zero performances do not manufacture winners',()=>{
  const t=createTournament(settings),f=t.fixtures[0];
  assert.equal(matchAwards(complete(t,f,{runOut:true})).manOfMatch[0].points,6);
  const m=complete(t,f,{runOut:true,zero:true}),awards=tournamentAwards(t,[m]);
  assert.equal(awards.perMatch.get(f.id).manOfMatch.length,0);assert.equal(awards.bestBowler.length,0);assert.equal(awards.bestBatsman.length,0);assert.equal(awards.manOfSeries.length,0);
});
test('series is provisional until draw completes, aggregates matches and shares exact ties',()=>{
  const t=createTournament({...settings,cycles:2}),matches=t.fixtures.map(f=>complete(t,f));
  assert.equal(tournamentAwards(t,matches.slice(0,1)).complete,false);
  const awards=tournamentAwards(t,matches);assert(awards.complete);
  assert.equal(awards.perMatch.size,2);assert.equal(awards.bestBatsman.length,2);assert.equal(awards.bestBowler.length,2);assert.equal(awards.manOfSeries.length,2);
  assert(awards.manOfSeries.every(p=>p.runs===10&&p.wickets===1&&p.points===30));
  assert(!tournamentAwards(t,[undo(matches[0]),matches[1]]).complete);
  const restored=restoreTournamentCopy(tournamentBackup(t,matches));
  assert.deepEqual(tournamentAwards(restored.tournament,restored.matches).manOfSeries,awards.manOfSeries);
});
test('playoff ties await advancement and conflicts never contribute to awards',()=>{
  let t=createTournament({...settings,format:'knockout'});const f=t.fixtures[0],m=complete(t,f,{tie:true});
  assert.equal(matchAwards(m).manOfMatch.length,2);
  assert(!tournamentAwards(t,[m]).complete);
  t=recordAdvancement(t,[m],{fixtureId:f.id,winner:f.teamA,reason:'Approved external tie break',recordedBy:'Referee'});
  assert(tournamentAwards(t,[m]).complete);
  const conflict={...m,settings:{...m.settings,teamA:'Wrong team'}};
  const awards=tournamentAwards(t,[conflict]);assert(!awards.complete);assert.equal(awards.completedMatches,0);assert.equal(awards.manOfSeries.length,0);
  assert.equal(tournamentAwards(t,[{...m,id:crypto.randomUUID()}]).completedMatches,0);
});
test('multi-round knockout awards include final and withdraw it if its source result is undone',()=>{
  const t=createTournament({...settings,format:'knockout',teams:['A','B','C','D']}),matches=[];
  for(const f of t.fixtures){const resolved=resolvedFixtures(t,matches).find(r=>r.id===f.id);matches.push(complete(t,resolved));}
  assert.equal(tournamentAwards(t,matches).completedMatches,3);assert(tournamentAwards(t,matches).complete);
  matches[0]=undo(matches[0]);const awards=tournamentAwards(t,matches);
  assert.equal(awards.completedMatches,1);assert(!awards.complete);assert(!awards.perMatch.has(t.fixtures.at(-1).id));
});
test('award UI explains auto rules, provisional state, joint winners, and escapes player names',()=>{
  const t=createTournament({...settings,cycles:2}),m=complete(t,t.fixtures[0],{tie:true});
  for(const e of m.events){if(e.striker==='Sam')e.striker='<Sam>';if(e.bowler==='Sam')e.bowler='<Sam>';}
  const helpers={t:en=>en,esc:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')};
  const html=tournamentAwardView(tournamentAwards(t,[m]),helpers)+matchAwardView(matchAwards(m),helpers,true);
  assert(html.includes('Provisional'));assert(html.includes('Joint winners'));assert(html.includes('20 per bowler-credited wicket'));assert(!html.includes('<Sam>'));assert(html.includes('&lt;Sam>'));
});
