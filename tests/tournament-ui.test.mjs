import 'fake-indexeddb/auto';
import {JSDOM} from 'jsdom';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tournamentUI} from '../dist/tournament-ui.js';
import {createTournament,listTournaments,saveTournament} from '../dist/tournaments.js';

const config={name:'UI Cup',teams:['A','B','C','D'],overs:6,ballsPerOver:6,players:8,ballType:'softball'};
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function harness(t,initial=[]) {
  const dom=new JSDOM('<main id="root"></main>',{url:'http://localhost/#tournaments'});
  globalThis.document=dom.window.document;globalThis.FormData=dom.window.FormData;globalThis.location=dom.window.location;
  let tournaments=initial;const messages=[];
  const ui=tournamentUI({t:en=>en,esc,getTournaments:()=>tournaments,getMatches:()=>[],refresh:async()=>{tournaments=await listTournaments();},toast:message=>messages.push(message),redraw:()=>{}});
  const render=id=>{document.querySelector('#root').innerHTML=ui.render(id);ui.bind();};
  const change=(control,value)=>{control.value=value;control.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  t.after(()=>dom.window.close());
  return {dom,render,change,messages,submit:form=>form.onsubmit(new dom.window.Event('submit',{cancelable:true}))};
}
test('group creation form assigns ten teams and persists the four-match qualifier template',async t=>{
  const h=harness(t);h.render();const form=document.querySelector('#tournament-form');
  form.elements.name.value='DOM qualifier';h.change(form.elements.teams,Array.from({length:10},(_,i)=>'Team '+i).join('\n'));h.change(form.elements.format,'groups');
  assert.equal(form.querySelectorAll('[data-team]').length,10);
  assert.equal(form.elements.playoffs.value,'qualifier');assert(form.checkValidity());
  const assignments=[...form.querySelectorAll('[data-team]')];assert.equal(assignments.filter(el=>el.value==='0').length,5);assert.equal(assignments.filter(el=>el.value==='1').length,5);
  await h.submit(form);assert.equal(form.querySelector('.form-error').textContent,'');
  const saved=(await listTournaments()).find(v=>v.name==='DOM qualifier');assert(saved);assert.equal(saved.fixtures.length,24);assert(location.hash.endsWith(saved.id));
});
test('hidden group controls do not block league or manual creation, and group counts above two disable templates',t=>{
  const h=harness(t);h.render();const form=document.querySelector('#tournament-form');form.elements.name.value='Switch formats';
  h.change(form.elements.teams,'A\nB\nC\nD\nE\nF');h.change(form.elements.format,'groups');h.change(form.elements.groupCount,'3');
  assert.equal(form.elements.playoffs.value,'none');assert(form.elements.playoffs.options[0].disabled);
  h.change(form.elements.groupCount,'99');assert(!form.checkValidity());h.change(form.elements.format,'manual');assert(form.checkValidity());assert(form.elements.groupCount.disabled);assert(form.elements.cycles.disabled);
  h.change(form.elements.format,'knockout');assert(form.querySelector('#league-points').disabled);assert(form.checkValidity());
});
test('fixture filters combine, reset, and survive rerender without changing draw cards',t=>{
  const tournament=createTournament({...config,format:'groups',groups:[{name:'North',teams:['A','B']},{name:'South',teams:['C','D']}],playoffs:'qualifier'}),h=harness(t,[tournament]);h.render(tournament.id);
  let form=document.querySelector('[data-fixture-filters]');assert.equal(document.querySelector('[data-fixture-count]').textContent,'6 / 6');
  h.change(form.elements.group,'g0');assert.equal(document.querySelector('[data-fixture-count]').textContent,'1 / 6');h.change(form.elements.status,'waiting');assert.equal(document.querySelector('[data-fixture-count]').textContent,'0 / 6');assert(!document.querySelector('[data-fixture-empty]').hidden);
  h.render(tournament.id);form=document.querySelector('[data-fixture-filters]');assert.equal(form.elements.group.value,'g0');assert.equal(form.elements.status.value,'waiting');
  form.querySelector('[data-clear-filters]').click();assert.equal(document.querySelector('[data-fixture-count]').textContent,'6 / 6');assert.equal(document.querySelectorAll('[data-fixture-card]').length,6);
});
test('manual editor hydrates once, preselects participants, and saves edited round',async t=>{
  const tournament=createTournament({...config,name:'DOM edit'});await saveTournament(tournament);const h=harness(t,[tournament]);h.render(tournament.id);
  const form=document.querySelector('[data-draw][data-fixture]'),details=form.parentElement;details.open=true;details.dispatchEvent(new h.dom.window.Event('toggle'));
  assert.equal(form.elements.stage.value,'league');assert.equal(form.elements.sourceA.value,JSON.stringify({type:'team',team:tournament.fixtures[0].teamA}));
  const count=form.elements.sourceA.options.length;details.dispatchEvent(new h.dom.window.Event('toggle'));assert.equal(form.elements.sourceA.options.length,count);
  form.elements.round.value='5';assert(form.checkValidity());await h.submit(form);assert.equal(form.querySelector('.form-error').textContent,'');assert.equal((await listTournaments()).find(v=>v.id===tournament.id).fixtures[0].round,5);
});
test('award eligibility toggles required final selection and persists all-team preference',async t=>{
  const tournament=createTournament({...config,name:'DOM awards',format:'knockout'});await saveTournament(tournament);const h=harness(t,[tournament]);h.render(tournament.id);
  const form=document.querySelector('[data-award-settings]');assert.equal(form.elements.scope.value,'finalists');assert(form.elements.finalId.required);assert(form.elements.finalId.value);
  h.change(form.elements.scope,'all');assert(form.elements.finalId.disabled);await h.submit(form);assert.equal(form.querySelector('.form-error').textContent,'');assert.equal((await listTournaments()).find(v=>v.id===tournament.id).awardScope,'all');
});
