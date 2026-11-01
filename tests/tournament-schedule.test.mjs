import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,fixtureSchedule,updateFixtureSchedule,updateDraw} from '../dist/tournaments.js';
import {tournamentBackup,restoreTournamentCopy} from '../dist/tournament-backups.js';
import {drawUI} from '../dist/draw-ui.js';
const config={name:'Cup',teams:['A','B'],format:'league',overs:6,ballsPerOver:6,players:8,ballType:'softball'};
test('schedule validates real dates and zone and allows clearing start independently of venue',()=>{
  assert.deepEqual(fixtureSchedule(),{scheduledStart:'',venue:'',timeZone:'Asia/Colombo'});
  assert.equal(fixtureSchedule({scheduledStart:'2028-02-29T09:30'}).scheduledStart,'2028-02-29T09:30');
  for(const scheduledStart of ['2026-02-29T09:30','2026-04-31T09:30','2026-11-01T24:00','tomorrow','2026-11-01'])assert.throws(()=>fixtureSchedule({scheduledStart}),/valid/);
  assert.throws(()=>fixtureSchedule({timeZone:'invalid/zone'}),/time zone/);
  assert.throws(()=>fixtureSchedule({venue:'x'.repeat(161)}),/Venue/);
  assert.equal(fixtureSchedule({venue:'  Main ground  '}).venue,'Main ground');
});
test('schedule changes preserve participants and decision history, and survive draw editing and backup restore',()=>{
  const original=createTournament(config),id=original.fixtures[0].id;
  const scheduled=updateFixtureSchedule(original,id,{scheduledStart:'2026-11-15T09:00',venue:'Town ground',timeZone:'Asia/Colombo'});
  assert.equal(original.fixtures[0].scheduledStart,undefined);assert.equal(scheduled.revision,1);
  assert.equal(scheduled.fixtures[0].teamA,original.fixtures[0].teamA);
  const edited=updateDraw(scheduled,[],{id,round:2,stage:'league',group:'g0',sourceA:{type:'team',team:'A'},sourceB:{type:'team',team:'B'}});
  assert.equal(edited.fixtures[0].scheduledStart,'2026-11-15T09:00');
  const restored=restoreTournamentCopy(tournamentBackup(edited,[]));
  assert.equal(restored.tournament.fixtures[0].venue,'Town ground');
  assert.equal(restored.tournament.fixtures[0].scheduledStart,'2026-11-15T09:00');
  const cleared=updateFixtureSchedule(edited,id,{scheduledStart:'',venue:'Town ground'});
  assert.equal(cleared.fixtures[0].scheduledStart,'');assert.equal(cleared.fixtures[0].venue,'Town ground');
  assert.throws(()=>updateFixtureSchedule(original,'missing',{}),/not found/);
});
test('draw renders schedule in its named zone with escaped venue values',()=>{
  const tournament=createTournament(config);
  const scheduled=updateFixtureSchedule(tournament,tournament.fixtures[0].id,{scheduledStart:'2026-11-15T09:00',venue:'<img onerror="bad">'});
  const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const html=drawUI({t:en=>en,esc,decisionForm:()=>''}).render(scheduled,[]);
  assert(html.includes('2026-11-15 09:00 (Asia/Colombo)'));assert(!html.includes('<img onerror'));assert(html.includes('data-schedule='));
});
