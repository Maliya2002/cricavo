import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roundRobin,createTournament,standings} from '../dist/tournaments.js';
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
