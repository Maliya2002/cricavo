import { updateAwardSelection } from './awards.js';
import { bindFixtureFilters } from './fixture-filters.js';
import { createTournament, saveTournament, recordAdvancement, updateDraw, updateFixtureSchedule } from './tournaments.js';
import { drawUI } from './draw-ui.js';
import { tournamentBackup, validateTournamentBackup, restoreTournamentCopy, saveTournamentCopy, MAX_TOURNAMENT_BACKUP_BYTES } from './tournament-backups.js';
import { listMatches, addMatchCopies } from './storage.js';

export function tournamentUI({ t, esc, getTournaments, getMatches, refresh, toast, redraw }) {
  const filterState=new Map();
  const field = (label,name,value,min,max) => `<label class="field">${label}<input name="${name}" type="number" required value="${value}" min="${min}" max="${max}"></label>`;
  function decisionForm(tournament,fixture) {
    return `<form class="stack" data-advancement="${fixture.id}" data-tournament="${tournament.id}"><h3>${t('Organizer advancement decision','සංවිධායකයාගේ ඉදිරි වටයේ තීරණය')}</h3><p class="small muted">${t('The score remains tied. Record an externally decided outcome and its reason. Recorder name is self-reported, not verified. Changing this may invalidate later-round matches.', 'තරග ලකුණු සම ලෙසම පවතී. පිටතදී ගත් තීරණය සහ හේතුව සටහන් කරන්න. සටහන්කරුගේ නම තහවුරු කළ අනන්‍යතාවයක් නොවේ. වෙනස් කිරීමෙන් පසු වටයේ තරගවල ගැටලු ඇති විය හැක.')}</p><label class="field">${t('Advance team','ඉදිරියට යන කණ්ඩායම')}<select name="winner" required><option value="">${t('Choose','තෝරන්න')}</option>${[fixture.teamA,fixture.teamB].map(name=>`<option value="${esc(JSON.stringify(name))}">${esc(name)}</option>`).join('')}<option value="null">${t('Revoke decision — pause advancement','තීරණය අවලංගු කර ඉදිරියට යාම නවත්වන්න')}</option></select></label><label class="field">${t('Reason / tie-break outcome','හේතුව / සම තත්ත්වය විසඳූ ප්‍රතිඵලය')}<input name="reason" required minlength="5" maxlength="300"></label><label class="field">${t('Recorded by','සටහන් කළේ')}<input name="recordedBy" required maxlength="80"></label><p class="form-error" role="alert"></p><button class="btn">${t('Save advancement decision','තීරණය සුරකින්න')}</button></form>`;
  }
  function render(id) {
    const tournaments = getTournaments(), tournament = tournaments.find(v => v.id === id);
    if (id && !tournament) return `<div class="notice">${t('Tournament not found on this device.', 'තරගාවලිය මෙම උපාංගයේ නැහැ.')} <a href="#tournaments">${t('Back','ආපසු')}</a></div>`;
    if (tournament) return `<section class="card stack"><button class="btn" data-export-tournament="${tournament.id}">${t('Download tournament backup','Tournament backup බාගන්න')}</button><p class="small muted">${t('Includes groups, draw, scores and advancement history. Keep this file private: it contains player and recorder names.','Groups, draw, ලකුණු සහ තීරණ ඉතිහාසය ඇතුළත් වේ. ක්‍රීඩක සහ සටහන්කරු නම් ඇති නිසා file එක පෞද්ගලිකව තබාගන්න.')}</p></section>` + drawUI({t,esc,decisionForm}).render(tournament,getMatches());
    return `<div class="page-head"><h1>${t('Tournaments','තරගාවලි')}</h1></div><p class="notice">${t('Tournaments are saved on this device. Choose team and group counts, assign groups, repeat league meetings, or build a manual draw. Team lists lock at creation.', 'තරගාවලි මෙම උපාංගයේ සුරැකේ. Team සහ group ගණන තෝරා teams බෙදන්න. League වට ගණන තෝරා හෝ manual draw එකක් සාදන්න. සෑදූ පසු team ලැයිස්තුව වෙනස් නොවේ.')}</p>${restoreForm()}<div class="home-grid"><section class="stack">${tournaments.map(v=>`<article class="card"><h2>${esc(v.name)}</h2><p>${v.teams.length} ${t('teams','කණ්ඩායම්')} · ${v.fixtures.length} ${t('matches','තරග')} · ${esc(v.format)}</p><a class="btn" href="#tournaments/${v.id}">${t('Fixtures and points','තරග සහ ලකුණු')}</a></article>`).join('') || `<div class="card">${t('Create your first tournament.','ඔබේ පළමු තරගාවලිය සාදන්න.')}</div>`}</section><form id="tournament-form" class="card stack"><h2>${t('Create tournament','තරගාවලියක් සාදන්න')}</h2><label class="field">${t('Format','ආකෘතිය')}<select name="format"><option value="league">League</option><option value="knockout">Knockout</option><option value="groups">Group league + playoffs</option><option value="manual">Manual draw</option></select></label><label class="field">${t('Tournament name','තරගාවලියේ නම')}<input name="name" required maxlength="80"></label><label class="field">${t('Teams — one per line (2+)','කණ්ඩායම් — පේළියකට එක බැගින් (2+)')}<textarea name="teams" rows="6" required></textarea></label><section id="group-settings" class="stack" hidden><label class="field">${t('Number of groups','Group ගණන')}<input name="groupCount" type="number" min="1" step="1" value="2"></label><div id="group-assignments" class="stack"></div><label class="field">${t('Playoff template','Playoff ආකෘතිය')}<select name="playoffs"><option value="qualifier">2 groups: Qualifier 1 → Eliminator → Qualifier 2 → Final</option><option value="semis">2 groups: Cross semi-finals → Final</option><option value="none">Custom / add playoffs manually</option></select></label></section><label class="field" id="cycles-field">${t('League meetings per pair','Teams දෙකක් අතර තරග ගණන')}<input name="cycles" type="number" min="1" step="1" value="1"></label><label class="field">${t('Ball type','පන්දු වර්ගය')}<select name="ballType"><option value="softball">Softball</option><option value="hardball">Hardball</option></select></label><div class="fields">${field(t('Overs','ඕවර'),'overs',6,1,50)}${field(t('Balls per over','ඕවරයක පන්දු'),'ballsPerOver',6,1,12)}${field(t('Players per team','කණ්ඩායමක ක්‍රීඩකයන්'),'players',8,2,22)}</div><fieldset id="league-points" class="stack"><legend>${t('League points — locked at creation','League ලකුණු — සෑදූ පසු වෙනස් නොවේ')}</legend><div class="fields">${field(t('Win','ජය'),'winPoints',2,0,20)}${field(t('Tie','සම'),'tiePoints',1,0,20)}${field(t('Loss','පරාජය'),'lossPoints',0,0,20)}</div></fieldset><p class="small muted">${t('League: each pair plays the selected number of meetings. Knockout: winners advance, with byes for extra slots. Enter teams in seed order. Players and toss are entered at match setup.', 'League: සියලු කණ්ඩායම් එකිනෙකා සමඟ තරග කරයි. Knockout: ජයග්‍රාහකයා ඉදිරියට යයි. Teams seed අනුපිළිවෙළට ඇතුළත් කරන්න. Players සහ toss තරගය සකසන විට දෙන්න.')}</p><p class="form-error" role="alert"></p><button class="btn primary">${t('Create fixtures','තරග ලැයිස්තුව සාදන්න')}</button></form></div>`;
  }
  function updateGroups(form) {
    const grouped=form.elements.format.value==='groups';
    form.querySelector('#group-settings').hidden=!grouped;
    const teams=form.elements.teams.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    const count=Number(form.elements.groupCount.value);
    form.querySelector('#cycles-field').hidden=!['league','groups'].includes(form.elements.format.value);
    form.elements.groupCount.required=grouped; form.elements.groupCount.disabled=!grouped; form.elements.cycles.disabled=!['league','groups'].includes(form.elements.format.value);
    form.elements.groupCount.max=Math.max(1,teams.length);
    const container=form.querySelector('#group-assignments');
    const old=new Map([...container.querySelectorAll('[data-team]')].map(el=>[el.dataset.team,el.value]));
    const oldNames=[...container.querySelectorAll('[data-group-name]')].map(el=>el.value);
    if(!Number.isInteger(count)||count<1||count>teams.length){container.innerHTML='';return;}
    container.innerHTML=Array.from({length:count},(_,i)=>`<label class="field">${t('Group name','Group නම')} ${i+1}<input data-group-name="${i}" maxlength="80" value="${esc(oldNames[i]||'Group '+(i+1))}"></label>`).join('')+teams.map((name,i)=>`<label class="field">${esc(name)}<select data-team="${esc(name)}">${Array.from({length:count},(_,g)=>`<option value="${g}" ${Number(old.get(name)??Math.floor(i*count/teams.length))===g?'selected':''}>Group ${g+1}</option>`).join('')}</select></label>`).join('');
    const template=form.elements.playoffs;
    [...template.options].forEach(o=>o.disabled=o.value!=='none'&&count!==2);
    if(count!==2)template.value='none';
  }
  function readGroups(form,teams) {
    if(form.elements.format.value!=='groups')return [];
    const count=Number(form.elements.groupCount.value);
    if(!Number.isInteger(count)||count<1||count>teams.length)throw Error('Choose a group count between 1 and the number of teams');
    const groups=Array.from({length:count},(_,i)=>({name:form.querySelector(`[data-group-name="${i}"]`)?.value||'Group '+(i+1),teams:[]}));
    form.querySelectorAll('[data-team]').forEach(el=>groups[Number(el.value)]?.teams.push(el.dataset.team));
    return groups;
  }
  function bindDraw() {
    document.querySelectorAll('[data-draw]').forEach(form=>{
      const tournament=getTournaments().find(v=>v.id===form.dataset.draw);
      const fixture=tournament.fixtures.find(f=>f.id===form.dataset.fixture);
      form.parentElement.addEventListener('toggle',()=>{
        if(!form.parentElement.open||form.dataset.hydrated)return;
        form.dataset.hydrated='true';
        const choices=drawUI({t,esc,decisionForm}).sources(tournament,fixture?tournament.fixtures.indexOf(fixture):tournament.fixtures.length);
        for(const side of ['A','B'])form.elements['source'+side].insertAdjacentHTML('beforeend',choices);
      if(fixture) {
        form.elements.stage.value=fixture.stage||(tournament.format==='league'?'league':'playoff');
        if(fixture.group)form.elements.group.value=fixture.group;
        for(const side of ['A','B']) {
          const source=fixture['source'+side]||(fixture['from'+side]?{type:'winner',fixture:fixture['from'+side]}:{type:'team',team:fixture['team'+side]});
          form.elements['source'+side].value=JSON.stringify(source);
        }
      }
      });
      let saving=false;
      form.onsubmit=async event=>{
        event.preventDefault();if(saving)return;saving=true;
        try {
          const values=Object.fromEntries(new FormData(form));
          const remove=event.submitter?.value==='remove';
          const updated=updateDraw(tournament,await listMatches(),{...values,id:fixture?.id,remove,...(!remove?{sourceA:JSON.parse(values.sourceA),sourceB:JSON.parse(values.sourceB)}:{})});
          await saveTournament(updated,tournament.revision||0);await refresh();redraw();toast(t('Draw saved','Draw එක සුරැකුණා'));
        }catch(error){form.querySelector('.form-error').textContent=error.message;}finally{saving=false;}
      };
    });
  }
  function restoreForm() {
    return `<form id="restore-tournament" class="card stack spacer"><h2>${t('Restore tournament backup','Tournament backup නැවත ලබාගන්න')}</h2><label class="field">${t('Choose JSON backup (up to 25 MB)','JSON backup තෝරන්න (25 MB දක්වා)')}<input type="file" name="backup" accept=".json,application/json" required></label><p>${t('Restores a separate copy, including its matches. Existing tournaments and scores stay unchanged. This is a file transfer, not live device sync.', 'තරග ඇතුළුව වෙනම පිටපතක් සාදයි. තිබෙන තරගාවලි සහ ලකුණු වෙනස් නොවේ. මෙය file හුවමාරුවකි; live device sync නොවේ.')}</p><div data-preview aria-live="polite"></div><p class="form-error" role="alert"></p><button class="btn primary" disabled>${t('Restore as a new copy','අලුත් පිටපතක් ලෙස ලබාගන්න')}</button></form>`;
  }
  function bindBackups() {
    document.querySelectorAll('[data-export-tournament]').forEach(button=>{
      button.onclick=async()=>{
        button.disabled=true;
        try {
          await refresh();
          const tournament=getTournaments().find(v=>v.id===button.dataset.exportTournament);
          const bundle=tournamentBackup(tournament,getMatches());
          const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'}));
          const link=document.createElement('a');link.href=url;link.download=`cricavo-tournament-${tournament.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }catch(error){toast(error.message);}finally{button.disabled=false;}
      };
    });
    const form=document.querySelector('#restore-tournament');if(!form)return;
    let bundle=null,reading=0,saving=false;
    const input=form.elements.backup,button=form.querySelector('button'),error=form.querySelector('.form-error'),preview=form.querySelector('[data-preview]');
    input.onchange=async()=>{
      const generation=++reading;bundle=null;button.disabled=true;error.textContent='';preview.textContent='';
      try {
        const file=input.files[0];if(!file)return;
        if(file.size>MAX_TOURNAMENT_BACKUP_BYTES)throw Error('Tournament backup exceeds 25 MB');
        const parsed=validateTournamentBackup(JSON.parse(await file.text()));if(generation!==reading)return;
        bundle=parsed;preview.textContent=`${parsed.tournament.name} · ${parsed.tournament.teams.length} teams · ${parsed.tournament.groups?.length||0} groups · ${parsed.tournament.fixtures.length} fixtures · ${parsed.matches.length} saved matches`;
        button.disabled=false;
      }catch(e){if(generation===reading)error.textContent=e.message;}
    };
    form.onsubmit=async event=>{
      event.preventDefault();if(!bundle||saving)return;saving=true;button.disabled=true;input.disabled=true;error.textContent='';
      try {
        const copy=restoreTournamentCopy(bundle);
        await saveTournamentCopy(copy,{saveMatches:addMatchCopies,saveTournament});
        await refresh();location.hash='#tournaments/'+copy.tournament.id;toast(t('Tournament copy restored','තරගාවලියේ පිටපත ලබාගත්තා'));
      }catch(e){error.textContent=e.message;await refresh();}finally{saving=false;button.disabled=false;input.disabled=false;}
    };
  }
  function bindSchedules() {
    document.querySelectorAll('[data-schedule]').forEach(form=>{
      const tournament=getTournaments().find(v=>v.id===form.dataset.schedule);
      let saving=false;
      form.onsubmit=async event=>{
        event.preventDefault();if(saving)return;saving=true;
        const button=form.querySelector('button');button.disabled=true;
        try{
          const updated=updateFixtureSchedule(tournament,form.dataset.fixture,Object.fromEntries(new FormData(form)));
          await saveTournament(updated,tournament.revision||0);await refresh();redraw();toast(t('Schedule saved','කාලසටහන සුරැකුණා'));
        }catch(error){form.querySelector('.form-error').textContent=error.message;}finally{saving=false;button.disabled=false;}
      };
    });
  }
  function bindAwardSettings() {
    document.querySelectorAll('[data-award-settings]').forEach(form=>{
      const tournament=getTournaments().find(v=>v.id===form.dataset.awardSettings);let saving=false;
      const update=()=>{form.elements.finalId.disabled=form.elements.scope.value==='all';form.elements.finalId.required=!form.elements.finalId.disabled;};form.elements.scope.onchange=update;update();
      form.onsubmit=async event=>{
        event.preventDefault();if(saving)return;saving=true;const button=form.querySelector('button');button.disabled=true;
        try{const updated=updateAwardSelection(tournament,Object.fromEntries(new FormData(form)));await saveTournament(updated,tournament.revision||0);await refresh();redraw();toast(t('Award rule saved','සම්මාන නීතිය සුරැකුණා'));}
        catch(error){form.querySelector('.form-error').textContent=error.message;}finally{saving=false;button.disabled=false;}
      };
    });
  }
  function bind() {
    bindAwardSettings();
    const filterForm=document.querySelector('[data-fixture-filters]');
    if(filterForm){const id=filterForm.dataset.fixtureFilters;if(!filterState.has(id))filterState.set(id,{});bindFixtureFilters(filterForm.parentElement,filterState.get(id));}
    bindSchedules();
    bindBackups();
    bindDraw();
    document.querySelectorAll('[data-advancement]').forEach(form => {
      let saving = false;
      form.onsubmit = async event => {
        event.preventDefault(); if (saving) return; saving = true;
        const button = form.querySelector('button'); button.disabled = true;
        try {
          const tournament = getTournaments().find(v => v.id === form.dataset.tournament);
          const values = Object.fromEntries(new FormData(form));
          const updated = recordAdvancement(tournament,await listMatches(),{...values,fixtureId:form.dataset.advancement,winner:JSON.parse(values.winner)});
          await saveTournament(updated,tournament.revision || 0);
          await refresh(); redraw(); toast(t('Advancement decision saved','ඉදිරි වටයේ තීරණය සුරැකුණා'));
        } catch(error) { form.querySelector('.form-error').textContent = error.message; }
        finally { saving = false; button.disabled = false; }
      };
    });
    const form = document.querySelector('#tournament-form'); if (!form) return;
    const updatePoints = () => { const fields=form.querySelector('#league-points'); fields.hidden=form.elements.format.value==='knockout'; fields.disabled=fields.hidden; };
    form.elements.format.addEventListener('change',()=>{updatePoints();updateGroups(form)}); form.elements.teams.addEventListener('change',()=>updateGroups(form)); form.elements.groupCount.addEventListener('change',()=>updateGroups(form)); updatePoints(); updateGroups(form);
    let saving = false;
    form.onsubmit = async event => {
      event.preventDefault(); if (saving) return; saving = true;
      const submit = form.querySelector('button'); submit.disabled = true;
      try {
        const values = Object.fromEntries(new FormData(form));
        const tournament = createTournament({...values, groups:readGroups(form,values.teams.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)),playoffs:values.format==='groups'?values.playoffs:'none',points:values.format!=='knockout'?{win:values.winPoints,tie:values.tiePoints,loss:values.lossPoints}:undefined, teams:values.teams.split(/\r?\n/)});
        await saveTournament(tournament); await refresh(); location.hash = '#tournaments/' + tournament.id;
        toast(t('Tournament saved','තරගාවලිය සුරැකුණා'));
      } catch(error) { form.querySelector('.form-error').textContent = error.message; }
      finally { saving = false; submit.disabled = false; }
    };
  }
  return { render, bind };
}
