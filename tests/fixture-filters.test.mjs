import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixtureStatus,matchesFixtureFilter} from '../dist/fixture-filters.js';
import {createTournament,resolvedFixtures} from '../dist/tournaments.js';
import {append} from '../dist/engine.js';
import {drawUI} from '../dist/draw-ui.js';

test('fixture status prioritizes conflicts, waits and byes; completed ties count as completed',()=>{
  assert.equal(fixtureStatus({conflict:true,waiting:true},null),'conflict');
  assert.equal(fixtureStatus({waiting:true},null),'waiting');
  assert.equal(fixtureStatus({bye:true},null),'bye');
  assert.equal(fixtureStatus({},null),'upcoming');
  let match={revision:0,audit:[],events:[],settings:{teamA:'A',teamB:'B',overs:1,ballsPerOver:1,players:2,ballType:'softball',battingFirst:'A',widePenalty:1,noBallPenalty:1}};
  assert.equal(fixtureStatus({},match),'upcoming');
  match=append(match,{type:'start',striker:'a',nonStriker:'b',bowler:'c'});
  assert.equal(fixtureStatus({},match),'inprogress');
  match=append(match,{type:'ball',kind:'normal',runs:0,running:0});
  match=append(match,{type:'start',striker:'c',nonStriker:'d',bowler:'a'});
  match=append(match,{type:'ball',kind:'normal',runs:0,running:0});
  assert.equal(fixtureStatus({},match),'completed');
  assert.equal(fixtureStatus({conflict:true},match),'conflict');
});
test('combined filters use case-insensitive literal text and exact group, stage and status',()=>{
  const item={search:'Kings සිංහ Café (Main ground)',group:'g0',stage:'league',status:'upcoming'};
  assert(matchesFixtureFilter(item,{search:'  KINGS ',group:'g0',stage:'league',status:'upcoming'}));
  assert(matchesFixtureFilter(item,{search:'සිංහ'}));
  assert(matchesFixtureFilter(item,{search:'Cafe\u0301'}));
  assert(matchesFixtureFilter(item,{search:'(Main'}));
  for(const filters of [{group:'g1'},{stage:'playoff'},{status:'completed'},{search:'.*'}])assert(!matchesFixtureFilter(item,filters));
  assert(matchesFixtureFilter(item,{}));
});
test('filter metadata escapes team text and leaves fixture order and source graph intact',()=>{
  const tournament=createTournament({name:'Cup',teams:['<Kings>','Lions','Stars'],format:'knockout',overs:6,ballsPerOver:6,players:8,ballType:'softball'});
  const before=JSON.stringify(tournament),fixtures=resolvedFixtures(tournament,[]);
  const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const html=drawUI({t:en=>en,esc,decisionForm:()=>''}).render(tournament,[]);
  assert.equal((html.match(/data-fixture-card /g)||[]).length,fixtures.length);
  assert(html.includes('data-status="waiting"'));assert(html.includes('data-status="bye"'));
  assert(!html.includes('<Kings>'));assert(html.includes('&lt;Kings>'));
  assert.equal(JSON.stringify(tournament),before);
});
