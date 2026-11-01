export function fieldingFigures(state,settings) {
  const rows=new Map();let unattributed=0;
  const player=(team,name)=>{name=name.normalize('NFC').trim();const key=JSON.stringify([team,name]);if(!rows.has(key))rows.set(key,{name,team,catches:0,stumpings:0,runOuts:0,assists:0,points:0});return rows.get(key);};
  for(const innings of state.innings){
    const team=settings[innings.team==='A'?'teamB':'teamA'];
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
  return {rows:[...rows.values()],unattributed};
}

export function fieldingView(figures,{t,esc}) {
  return `<section class="card stack spacer"><h3>${t('Fielding figures','පන්දු රැකීමේ දක්ෂතා')}</h3><p class="small muted">${t('Recorded fielders only. Run-outs lists the primary fielder; assists are separate. Use consistent player names.','සටහන් කළ fielders පමණි. Run-outs ප්‍රධාන fielder සඳහාත් assists වෙනමත් දැක්වේ. එකම player සඳහා ස්ථිර නමක් භාවිත කරන්න.')}</p>${figures.unattributed?`<p>${figures.unattributed} ${t('dismissals have no recorded fielder','දැවී යාම් සඳහා fielder සටහන් කර නැහැ')}</p>`:''}${figures.rows.length?`<div class="table-wrap"><table><thead><tr>${[t('Player','ක්‍රීඩකයා'),t('Team','කණ්ඩායම'),'Catches','Stumpings','Run-outs','Assists'].map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${figures.rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.team)}</td><td>${r.catches}</td><td>${r.stumpings}</td><td>${r.runOuts}</td><td>${r.assists}</td></tr>`).join('')}</tbody></table></div>`:`<p>${t('No fielding figures recorded yet.','පන්දු රැකීමේ දක්ෂතා තවම සටහන් කර නැහැ.')}</p>`}</section>`;
}
