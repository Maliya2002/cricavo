import { resolvedFixtures, standings, formatNRR } from './tournaments.js';

export function drawUI({t,esc,decisionForm}) {
  const option=(value,label)=>`<option value="${esc(JSON.stringify(value))}">${esc(label)}</option>`;
  function sources(tournament,index) {
    return tournament.teams.map(team=>option({type:'team',team},team)).join('')+
      (tournament.groups||[]).flatMap(g=>g.teams.map((_,i)=>option({type:'rank',group:g.id,rank:i+1},`${g.name} #${i+1}`))).join('')+
      tournament.fixtures.slice(0,index).flatMap((f,i)=>['winner','loser'].map(type=>option({type,fixture:f.id},`${t(type==='winner'?'Winner':'Loser',type==='winner'?'ජයග්‍රාහකයා':'පරාජිතයා')} — ${i+1}: ${f.label||`${f.teamA||'?'} / ${f.teamB||'?'}`}`))).join('');
  }
  function editor(tournament,f,index) {
    const choices='';
    return `<details class="card"><summary>${f?t('Edit fixture','තරගය වෙනස් කරන්න'):t('Add manual fixture','Manual තරගයක් එක් කරන්න')}</summary><form class="stack" data-draw="${tournament.id}" data-fixture="${f?.id||''}"><label class="field">${t('Match label','තරග නම')}<input name="label" maxlength="80" value="${esc(f?.label||'')}"></label><label class="field">${t('Round','වටය')}<input name="round" type="number" min="1" step="1" required value="${f?.round||1}"></label><label class="field">${t('Stage','අදියර')}<select name="stage"><option value="playoff">Playoff / knockout</option><option value="league">League / points</option></select></label><label class="field">${t('Group for league points','League ලකුණු සඳහා group එක')}<select name="group">${(tournament.groups||[]).map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label>${['A','B'].map(side=>`<label class="field">${t('Participant','කණ්ඩායම')} ${side}<select required name="source${side}"><option value="">${t('Choose team / group rank / result','Team / group position / ප්‍රතිඵලය තෝරන්න')}</option>${choices}</select></label>`).join('')}<p class="small muted">${t('League games use named teams from the selected group. Playoffs can use group positions and earlier winners or losers. Set-up matches are locked.', 'League තරග සඳහා එම group එකේ teams තෝරන්න. Playoffs සඳහා group positions හෝ පෙර තරගයේ ජයග්‍රාහකයා / පරාජිතයා තෝරන්න. Setup කළ තරග වෙනස් කළ නොහැක.')}</p><p class="form-error" role="alert"></p><button class="btn primary" name="action" value="save">${t('Save fixture','තරගය සුරකින්න')}</button>${f?`<button class="btn" name="action" value="remove" formnovalidate>${t('Remove unstarted fixture','ආරම්භ නොකළ තරගය ඉවත් කරන්න')}</button>`:''}</form></details>`;
  }
  function sourceLabel(tournament,f,side) {
    const source=f['source'+side];
    if(source?.type==='rank')return `${tournament.groups.find(g=>g.id===source.group)?.name} #${source.rank}`;
    const id=source?.fixture||f['from'+side],i=tournament.fixtures.findIndex(v=>v.id===id);
    return id?`${source?.type==='loser'?t('Loser','පරාජිතයා'):t('Winner','ජයග්‍රාහකයා')} ${i+1}`:t('Bye','නිතරග ජය');
  }
  function render(tournament,matches) {
    const fixtures=resolvedFixtures(tournament,matches);
    const final=fixtures.at(-1), champion=(tournament.format==='knockout'||final?.label==='Final')&&final?.winner;
    const groups=tournament.groups?.length?tournament.groups:[{id:null,name:t('Points','ලකුණු'),teams:tournament.teams}];
    const tables=tournament.format==='knockout'?'':groups.map(group=>{
      const rows=standings({...tournament,teams:group.teams,fixtures:tournament.fixtures.filter(f=>!group.id||f.group===group.id)},matches);
      return `<section class="card stack"><h2>${esc(group.name)}</h2><p>${t('Win / Tie / Loss points','ජය / සම / පරාජ ලකුණු')}: ${tournament.points?.win??2} / ${tournament.points?.tie??1} / ${tournament.points?.loss??0}</p><div class="table-wrap"><table><thead><tr>${[t('Team','කණ්ඩායම'),t('Played','තරග'),t('Won','ජය'),t('Lost','පරාජ'),t('Tied','සම'),t('Points','ලකුණු'),'NRR'].map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td>${[r.played,r.won,r.lost,r.tied,r.points,formatNRR(r.nrr)].map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
    }).join('');
    return `<div class="page-head"><div><h1>${esc(tournament.name)}</h1><p>${tournament.teams.length} ${t('teams','කණ්ඩායම්')} · ${tournament.groups?.length||0} groups</p></div><a class="btn" href="#tournaments">${t('All tournaments','තරගාවලි සියල්ල')}</a></div><p class="notice">${t('Group positions resolve after all group games finish, using points then NRR. Exact ties pause qualification; edit an unstarted playoff to select the organizer-decided team. Changing earlier results can block later matches. Draws are stored on this device only.', 'සියලු group තරග අවසානයේ points සහ NRR අනුව positions තීරණය වේ. දෙකම සම නම් qualification නවතී; ආරම්භ නොකළ playoff එක edit කර සංවිධායකයා තීරණය කළ team එක තෝරන්න. පෙර ප්‍රතිඵල වෙනස් කිරීමෙන් පසු තරග අවහිර විය හැක. Draw එක මෙම උපාංගයේ පමණක් සුරැකේ.')}</p><div class="stack spacer">${champion?`<section class="card"><h2>${t('Champion','ශූරයා')}: ${esc(champion)}</h2></section>`:''}${tables}</div><section class="stack spacer"><h2>${t('Draw','තරග ලැයිස්තුව')}</h2>${fixtures.map((f,i)=>{
      const match=matches.find(m=>m.id===f.id),group=tournament.groups?.find(g=>g.id===f.group);
      return `<article class="card stack"><span class="badge neutral">#${i+1} · ${esc(f.label||`${group?.name||f.stage||'Knockout'} · ${t('Round','වටය')} ${f.round}`)}</span><h3>${esc(f.teamA||sourceLabel(tournament,f,'A'))} vs ${esc(f.teamB||sourceLabel(tournament,f,'B'))}</h3>${f.conflict?`<p class="form-error">${t('Participants changed or are identical. Scoring is blocked; restore earlier results.', 'කණ්ඩායම් වෙනස් වී හෝ එකම team එක දෙවරක් ඇත. Scoring අවහිරයි; පෙර ප්‍රතිඵල නිවැරදි කරන්න.')}</p>`:f.waiting?`<p>${t('Waiting for group standings or earlier results','Group positions හෝ පෙර ප්‍රතිඵල බලාපොරොත්තුවෙන්')}</p>`:''}${f.winner?`<p>${f.bye?'Bye':t('Winner','ජයග්‍රාහකයා')}: ${esc(f.winner)}</p>`:''}${f.tied?`<p>${t('Match tied','තරගය සමයි')}</p>${f.stage==='playoff'||tournament.format==='knockout'?decisionForm(tournament,f):''}`:''}${f.ready?`<a class="btn" href="#${match?'score':'new'}/${f.id}">${match?t('Open match','තරගය විවෘත කරන්න'):t('Set up match','තරගය සකසන්න')}</a>`:''}${!match?editor(tournament,tournament.fixtures[i],i):''}</article>`;
    }).join('')}${editor(tournament,null,tournament.fixtures.length)}</section><section class="card stack spacer"><h2>${t('Advancement history','ඉදිරි වට තීරණ ඉතිහාසය')}</h2>${(tournament.decisions||[]).map(d=>`<p>${esc(d.winner||t('Revoked','අවලංගුයි'))} · ${esc(d.reason)} · ${esc(d.recordedBy)} · ${esc(d.at)}</p>`).join('')}</section>`;
  }
  return {render,sources};
}
