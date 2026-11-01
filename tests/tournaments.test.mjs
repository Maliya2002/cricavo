import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roundRobin,createTournament,standings,resolvedFixtures,recordAdvancement,formatNRR} from '../dist/tournaments.js';
import {append,undo} from '../dist/engine.js';

const values={name:'Sunday League',teams:['Kings','Lions','Stars'],overs:1,ballsPerOver:1,players:4,ballType:'softball'};
test('round robin schedules every pair exactly once without two games in one round, including byes',()=>{
  for(let count=2;count<=16;count++) {
    const teams=Array.from({length:count},(_,i)=>'Team '+i),fixtures=roundRobin(teams),pairs=new Set(),rounds=new Map();
    assert.equal(fixtures.length,count*(count-1)/2);
    for(const f of fixtures){
      assert.notEqual(f.teamA,f.teamB);
      const pair=[f.teamA,f.teamB].sort().join('|');assert(!pairs.has(pair));pairs.add(pair);
      const playing=rounds.get(f.round)||new Set();assert(!playing.has(f.teamA));assert(!playing.has(f.teamB));playing.add(f.teamA);playing.add(f.teamB);rounds.set(f.round,playing);
    }
    assert.equal(rounds.size,count%2?count:count-1);
  }
});
test('tournament input rejects duplicate teams and invalid rules',()=>{
  assert.throws(()=>createTournament({...values,teams:[' Kings ','kings']}),/unique/);
  assert.throws(()=>createTournament({...values,teams:['Only']}),/2–16/);
  assert.throws(()=>createTournament({...values,overs:0}),/Overs/);
  assert.throws(()=>createTournament({...values,ballsPerOver:1.5}),/Balls/);
  const league=createTournament(values);assert.equal(new Set(league.fixtures.map(f=>f.id)).size,3);
});
function completed(f,secondRuns){
  const settings={...values,teamA:f.teamA,teamB:f.teamB,widePenalty:1,noBallPenalty:1,battingFirst:'A',freeHit:true};
  let m={id:f.id,settings,events:[],audit:[],revision:0};
  m=append(m,{type:'start',striker:'A',nonStriker:'B',bowler:'X'});
  m=append(m,{type:'ball',kind:'normal',runs:4,running:0,boundary:true});
  m=append(m,{type:'start',striker:'X',nonStriker:'Y',bowler:'A'});
  return append(m,{type:'ball',kind:'normal',runs:secondRuns,running:0,boundary:true});
}
test('points use finished fixtures only and recompute when a result is undone',()=>{
  const league=createTournament(values),f=league.fixtures[0],win=completed(f,6);
  let rows=standings(league,[win]);
  assert.equal(rows.find(r=>r.name===f.teamB).points,2);
  assert.equal(rows.find(r=>r.name===f.teamA).lost,1);
  rows=standings(league,[undo(win)]);assert(rows.every(r=>r.played===0));
  rows=standings(league,[completed(f,4)]);assert.equal(rows.filter(r=>r.points===1&&r.tied===1).length,2);
  rows=standings(league,[{...win,id:crypto.randomUUID()}]);assert(rows.every(r=>r.played===0));
});

test('knockout completes with exactly n-1 played matches for every supported team count',()=>{
  for(let n=2;n<=16;n++) {
    const tournament=createTournament({...values,format:'knockout',teams:Array.from({length:n},(_,i)=>'Team '+i)}),matches=[];
    const size=2**Math.ceil(Math.log2(n));
    assert.equal(tournament.fixtures.length,size-1);
    assert.equal(resolvedFixtures(tournament,[]).filter(f=>f.bye).length,size-n);
    for(const raw of tournament.fixtures) {
      const fixture=resolvedFixtures(tournament,matches).find(f=>f.id===raw.id);
      if(fixture.bye) continue;
      assert(fixture.ready);assert(fixture.teamA);assert(fixture.teamB);
      matches.push(completed(fixture,6));
    }
    assert.equal(matches.length,n-1);
    assert(tournament.teams.includes(resolvedFixtures(tournament,matches).at(-1).winner));
  }
});

test('tied and undone results never silently advance a knockout team',()=>{
  const tournament=createTournament({...values,format:'knockout',teams:['A','B','C','D']});
  let fixtures=resolvedFixtures(tournament,[]);
  const tied=completed(fixtures[0],4),other=completed(fixtures[1],6);
  fixtures=resolvedFixtures(tournament,[tied,other]);
  assert(fixtures[0].tied);assert(fixtures.at(-1).waiting);assert(!fixtures.at(-1).ready);
  const first=completed(fixtures[0],6);
  fixtures=resolvedFixtures(tournament,[first,other]);
  assert(fixtures.at(-1).ready);
  const final=completed(fixtures.at(-1),6);
  fixtures=resolvedFixtures(tournament,[undo(first),other,final]);
  assert(fixtures.at(-1).conflict);assert(!fixtures.at(-1).winner);assert(!fixtures.at(-1).ready);
});

test('recorded tie decisions advance without changing scores, and can be revoked with history',()=>{
  const tournament=createTournament({...values,format:'knockout',teams:['A','B']});
  const f=tournament.fixtures[0], match=completed(f,4), before=JSON.stringify(match);
  const input={fixtureId:f.id,winner:f.teamA,reason:'Organizer approved bowl-out result',recordedBy:'Match referee'};
  const decided=recordAdvancement(tournament,[match],input);
  assert.equal(resolvedFixtures(decided,[match])[0].winner,f.teamA);
  assert.equal(JSON.stringify(match),before);
  assert.equal(tournament.decisions,undefined);
  const revoked=recordAdvancement(decided,[match],{...input,winner:null,reason:'Result under review'});
  assert.equal(revoked.decisions.length,2);assert.equal(revoked.revision,2);
  assert.equal(resolvedFixtures(revoked,[match])[0].winner,null);
  const changed={...match,revision:match.revision+1};
  assert.equal(resolvedFixtures(decided,[changed])[0].winner,null);
  assert.throws(()=>recordAdvancement(tournament,[completed(f,6)],input),/tied/);
  assert.throws(()=>recordAdvancement(tournament,[match],{...input,winner:'Other team'}),/Choose/);
  assert.throws(()=>recordAdvancement(tournament,[match],{...input,reason:''}),/reason/);
  assert.throws(()=>recordAdvancement(tournament,[match],{...input,recordedBy:''}),/recorder/);
});

function allOutChase(f,{firstRuns=4,chaseRuns=6,wide=false}={}) {
  const settings={...values,overs:2,ballsPerOver:5,players:2,teamA:f.teamA,teamB:f.teamB,widePenalty:1,noBallPenalty:1,battingFirst:'A'};
  let m={id:f.id,settings,events:[],audit:[],revision:0};
  m=append(m,{type:'start',striker:'A',nonStriker:'B',bowler:'X'});
  if(firstRuns)m=append(m,{type:'ball',kind:'normal',runs:firstRuns,running:0,boundary:true});
  m=append(m,{type:'ball',kind:'normal',runs:0,running:0,wicket:'bowled'});
  m=append(m,{type:'start',striker:'X',nonStriker:'Y',bowler:'A'});
  return append(m,{type:'ball',kind:wide?'wide':'normal',runs:wide?0:chaseRuns,running:0,boundary:!wide});
}
test('NRR uses full quota for all out and actual balls for early chase with custom over size',()=>{
  const league=createTournament({...values,teams:['A','B']}),f=league.fixtures[0];
  const rows=standings(league,[allOutChase(f)]);
  const a=rows.find(r=>r.name===f.teamA),b=rows.find(r=>r.name===f.teamB);
  assert.equal(a.oversFor,2);assert.equal(b.oversFor,1/5);
  assert.equal(a.nrr,4/2-6/(1/5));assert.equal(b.nrr,28);
  assert.equal(formatNRR(b.nrr),'+28.000');
});
test('NRR aggregates runs and overs across matches instead of averaging match rates',()=>{
  const league=createTournament(values);
  league.fixtures=[{id:'one',teamA:'Kings',teamB:'Lions',round:1},{id:'two',teamA:'Kings',teamB:'Stars',round:2}];
  const rows=standings(league,[allOutChase(league.fixtures[0]),completed(league.fixtures[1],6)]);
  const kings=rows.find(r=>r.name==='Kings');
  assert.equal(kings.nrr,8/3-12/1.2);
  assert.notEqual(kings.nrr,(-28-2)/2);
});
test('zero legal-ball chases do not produce infinity and pending/undone matches are excluded',()=>{
  const league=createTournament({...values,teams:['A','B']}),f=league.fixtures[0];
  const match=allOutChase(f,{firstRuns:0,wide:true});
  assert(standings(league,[match]).every(r=>r.nrr===null));
  assert(standings(league,[undo(match)]).every(r=>r.nrr===null&&r.runsFor===0));
  assert.equal(formatNRR(null),'—');assert.equal(formatNRR(-0.00001),'+0.000');
});
