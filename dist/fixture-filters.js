import { replay } from './engine.js';

export function fixtureStatus(fixture,match) {
  if(fixture.conflict)return 'conflict';
  if(fixture.waiting)return 'waiting';
  if(fixture.bye)return 'bye';
  if(!match||!match.events.length)return 'upcoming';
  return replay(match).finished?'completed':'inprogress';
}

export function matchesFixtureFilter(item,filters={}) {
  const query=String(filters.search||'').trim().normalize('NFC').toLocaleLowerCase();
  return (!filters.group||item.group===filters.group)&&(!filters.stage||item.stage===filters.stage)&&(!filters.status||item.status===filters.status)&&(!query||item.search.normalize('NFC').toLocaleLowerCase().includes(query));
}

export function bindFixtureFilters(root,remembered={}) {
  const form=root.querySelector('[data-fixture-filters]');if(!form)return;
  const cards=[...root.querySelectorAll('[data-fixture-card]')];
  for(const key of ['search','group','stage','status'])form.elements[key].value=remembered[key]||'';
  const update=()=>{
    const filters=Object.fromEntries(new FormData(form));Object.assign(remembered,filters);
    let visible=0;
    for(const card of cards){card.hidden=!matchesFixtureFilter(card.dataset,filters);if(!card.hidden)visible++;}
    root.querySelector('[data-fixture-count]').textContent=`${visible} / ${cards.length}`;
    root.querySelector('[data-fixture-empty]').hidden=visible>0;
  };
  form.oninput=update;form.onchange=update;form.onsubmit=event=>event.preventDefault();
  form.querySelector('[data-clear-filters]').onclick=()=>{form.reset();update();};
  update();
}
