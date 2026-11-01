export function fieldingFigures(state,settings) {
  const rows=new Map(),observations=[];let unattributed=0;
  const player=(team,name)=>{name=name.normalize('NFC').trim();const key=JSON.stringify([team,name]);if(!rows.has(key))rows.set(key,{name,team,catches:0,stumpings:0,runOuts:0,assists:0,droppedCatches:0,runsSaved:0,runsMissed:0,points:0});return rows.get(key);};
  for(const innings of state.innings){
    const team=settings[innings.team==='A'?'teamB':'teamA'];
    for(const note of innings.fieldingNotes||[]){const row=player(team,note.fielder);if(note.kind==='droppedCatch')row.droppedCatches++;else row[note.kind]+=note.runs;observations.push({...note,team});}
    for(const delivery of innings.deliveries){
      if(!['caught','stumped','runOut'].includes(delivery.wicket))continue;
      if(!delivery.fielder){unattributed++;continue;}
      const row=player(team,delivery.fielder);
      if(delivery.wicket==='caught'){row.catches++;row.points+=10;}
      if(delivery.wicket==='stumped'){row.stumpings++;row.points+=10;}
      if(delivery.wicket==='runOut'){
        row.runOuts++;row.points+=delivery.assist?5:10;
        if(delivery.assist){const assist=player(team,delivery.assist);assist.assists++;assist.points+=5;}
      }
    }
  }
  return {rows:[...rows.values()],unattributed,observations};
}

export function fieldingView(figures,{t,esc}) {
  return `<section class="card stack spacer"><h3>${t('Fielding figures','පන්දු රැකීමේ දක්ෂතා')}</h3><p class="small muted">${t('Recorded fielders only. Run-outs lists the primary fielder; assists are separate. Use consistent player names. Dropped catches and saved/missed runs are scorer estimates; they do not change the score or award points.','සටහන් කළ fielders පමණි. Run-outs ප්‍රධාන fielder සඳහාත් assists වෙනමත් දැක්වේ. එකම player සඳහා ස්ථිර නමක් භාවිත කරන්න. Dropped catches සහ saved/missed runs සටහන් score හෝ award points වෙනස් නොකරයි.')}</p>${figures.unattributed?`<p>${figures.unattributed} ${t('dismissals have no recorded fielder','දැවී යාම් සඳහා fielder සටහන් කර නැහැ')}</p>`:''}${figures.rows.length?`<div class="table-wrap"><table><thead><tr>${[t('Player','ක්‍රීඩකයා'),t('Team','කණ්ඩායම'),'Catches','Stumpings','Run-outs','Assists','Dropped','Runs saved','Runs missed'].map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${figures.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.team)}</td><td>${r.catches}</td><td>${r.stumpings}</td><td>${r.runOuts}</td><td>${r.assists}</td><td>${r.droppedCatches||0}</td><td>${r.runsSaved||0}</td><td>${r.runsMissed||0}</td></tr>`).join('')}</tbody></table></div>`:`<p>${t('No fielding figures recorded yet.','පන්දු රැකීමේ දක්ෂතා තවම සටහන් කර නැහැ.')}</p>`}${figures.observations?.length?`<details><summary>${t('Recorded fielding notes','සටහන් කළ fielding තොරතුරු')}</summary>${figures.observations.map(n=>`<p>${esc(n.fielder)} (${esc(n.team)}) · ${t('Innings','ඉනිම')} ${n.innings+1} · #${n.delivery+1} · ${esc(({droppedCatch:t('Dropped catch','අතහැරුණු උඩපන්දුව'),runsSaved:t('Runs saved','වැළැක්වූ ලකුණු'),runsMissed:t('Runs missed','දෝෂයෙන් දුන් ලකුණු')})[n.kind])}${n.runs?' '+n.runs:''}</p>`).join('')}</details>`:''}</section>`;
}
