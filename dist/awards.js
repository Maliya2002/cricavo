import { replay } from './engine.js';
import { resolvedFixtures } from './tournaments.js';
import { fieldingFigures } from './fielding.js';

// Cricavo's transparent automatic rule, not an official cricket award rule.
export const AWARD_RULE={run:1,wicket:20};
const playerKey=(team,name)=>JSON.stringify([team,name.normalize('NFC').trim()]);
const leaders=(rows,metric)=>{
  const max=rows.reduce((best,row)=>Math.max(best,row[metric]),0);
  return max>0?rows.filter(row=>row[metric]===max).sort((a,b)=>a.team.localeCompare(b.team)||a.name.localeCompare(b.name)):[];
};

export function matchAwards(match) {
  const state=replay(match),players=new Map();
  if(!state.finished)return {completed:false,players:[],manOfMatch:[]};
  const row=(team,name)=>{const key=playerKey(team,name);if(!players.has(key))players.set(key,{name,team,runs:0,wickets:0,points:0});return players.get(key);};
  for(const innings of state.innings){
    const team=match.settings['team'+innings.team],opponent=match.settings[innings.team==='A'?'teamB':'teamA'];
    for(const batter of Object.values(innings.batters))row(team,batter.name).runs+=batter.runs;
    for(const bowler of Object.values(innings.bowlers))row(opponent,bowler.name).wickets+=bowler.wickets;
  }
  const fielding=fieldingFigures(state,match.settings);
  for(const f of fielding.rows)if(f.points)row(f.team,f.name).fieldingPoints=f.points;
  const rows=[...players.values()].map(p=>({...p,points:p.runs*AWARD_RULE.run+p.wickets*AWARD_RULE.wicket+(p.fieldingPoints||0)}));
  return {completed:true,players:rows,manOfMatch:leaders(rows,'points')};
}

export function tournamentAwards(tournament,matches) {
  const byId=new Map(matches.map(m=>[m.id,m])),fixtures=resolvedFixtures(tournament,matches),perMatch=new Map(),players=new Map();
  let complete=fixtures.length>0;
  for(const fixture of fixtures){
    if(fixture.conflict||fixture.waiting){complete=false;continue;}
    if(fixture.bye)continue;
    const match=byId.get(fixture.id);
    if(!match){complete=false;continue;}
    const awards=matchAwards(match);
    if(!awards.completed){complete=false;continue;}
    if((tournament.format==='knockout'||fixture.stage==='playoff')&&!fixture.winner)complete=false;
    perMatch.set(fixture.id,awards);
    for(const p of awards.players){
      const key=playerKey(p.team,p.name),total=players.get(key)||{name:p.name,team:p.team,runs:0,wickets:0,points:0};
      total.runs+=p.runs;total.wickets+=p.wickets;total.points+=p.points;players.set(key,total);
    }
  }
  const finalId=tournament.awardFinalId||defaultAwardFinal(tournament),final=fixtures.find(f=>f.id===finalId);
  const scope=tournament.awardScope||(finalId?'finalists':'all');
  const finalists=final&&!final.waiting&&!final.conflict&&final.teamA&&final.teamB?[final.teamA,final.teamB]:[];
  const rows=[...players.values()].filter(p=>scope==='all'||finalists.includes(p.team));
  return {complete,scope,finalId,finalists,completedMatches:perMatch.size,perMatch,bestBatsman:leaders(rows,'runs'),bestBowler:leaders(rows,'wickets'),manOfSeries:leaders(rows,'points')};
}

export function defaultAwardFinal(tournament) {
  return tournament.fixtures.findLast(f=>f.label?.trim().toLowerCase()==='final')?.id||(tournament.format==='knockout'?tournament.fixtures.at(-1)?.id:undefined);
}

export function updateAwardSelection(tournament,{scope,finalId}) {
  if(!['all','finalists'].includes(scope))throw Error('Choose an award eligibility rule');
  if(scope==='finalists'&&!tournament.fixtures.some(f=>f.id===finalId))throw Error('Choose the final fixture');
  return {...tournament,awardScope:scope,awardFinalId:scope==='finalists'?finalId:null,revision:(tournament.revision||0)+1};
}

export function awardNames(players,metric,{t,esc}) {
  if(!players.length)return t('No eligible performance yet','සුදුසු දක්ෂතාවක් තවම නැහැ');
  return `${players.length>1?t('Joint winners: ','සම ජයග්‍රාහකයන්: '):''}${players.map(p=>`${esc(p.name)} (${esc(p.team)}) — ${p[metric]}`).join(' · ')}`;
}

export function awardSettingsView(tournament,awards,{t,esc}) {
  return `<details class="card spacer"><summary>${t('Series award eligibility','Series සම්මාන සඳහා සුදුසු teams')}</summary><form class="stack" data-award-settings="${tournament.id}"><label class="field">${t('Best Batsman, Best Bowler and Man of the Series','Best Batsman, Best Bowler සහ Man of the Series')}<select name="scope"><option value="finalists" ${awards.scope==='finalists'?'selected':''}>${t('Finalists only','Final teams දෙක පමණි')}</option><option value="all" ${awards.scope==='all'?'selected':''}>${t('All teams','සියලු teams')}</option></select></label><label class="field">${t('Final fixture','Final තරගය')}<select name="finalId"><option value="">${t('Select final','Final එක තෝරන්න')}</option>${tournament.fixtures.map((f,i)=>`<option value="${f.id}" ${awards.finalId===f.id?'selected':''}>#${i+1} · ${esc(f.label||`${f.teamA||'?'} vs ${f.teamB||'?'}`)}</option>`).join('')}</select></label><p>${t('Uses all completed tournament performances by eligible players. Match awards remain open to both teams in that match.','සුදුසු playersගේ සියලු අවසන් tournament තරගවල දක්ෂතා ගනී. Match awards එම තරගයේ teams දෙකටම විවෘතයි.')}</p><p class="form-error" role="alert"></p><button class="btn">${t('Save award rule','සම්මාන නීතිය සුරකින්න')}</button></form></details>`;
}

export function matchAwardView(awards,{t,esc},explain=false) {
  if(!awards?.completed)return '';
  return `<section class="card stack spacer"><h3>${t('Man of the Match · Auto','තරගයේ වීරයා · Auto')}</h3><p>${awardNames(awards.manOfMatch,'points',{t,esc})} ${awards.manOfMatch.length?t('points','ලකුණු'):''}</p>${explain?`<p class="small muted">${awardRuleText(t)}</p>`:''}</section>`;
}

export function awardRuleText(t) {
  return t('Cricavo auto rule: 1 point per batting run + 20 per bowler-credited wicket. Catch/stumping: 10 points. Run-out: 10 to a lone named fielder, or 5 each to the named fielder and assistant. Unnamed fielding and extras earn no points. Equal points share the award. Players are identified by team and exact name; use distinct, consistent names. Recomputed after score corrections.', 'Cricavo auto ක්‍රමය: batting run එකකට point 1 + bowler wicket එකකට points 20. Catch/stumping: points 10. Run-out: තනි fielderට 10 හෝ fielder සහ සහායකයාට 5 බැගින්. නම් නොදුන් fielding සහ extras සඳහා points නැහැ. Points සම නම් සම්මානය බෙදා ගනී. Team එක සහ නම අනුව players හඳුනාගනී; පැහැදිලි ස්ථිර නම් භාවිත කරන්න. ලකුණු නිවැරදි කළ විට නැවත ගණනය වේ.');
}

export function tournamentAwardView(awards,{t,esc}) {
  return `<section class="card stack spacer"><h2>${t('Tournament awards · Auto','තරගාවලි සම්මාන · Auto')}</h2><span class="badge neutral">${awards.complete?t('Final for the current draw','දැනට ඇති draw එකේ අවසන් ප්‍රතිඵල'):t('Provisional — tournament in progress','තාවකාලිකයි — තරගාවලිය අවසන් නැහැ')}</span><p>${awards.scope==='finalists'?t('Eligible: finalists only. Their whole-tournament performances count.','සුදුසුකම්: finalists දෙක පමණි. ඔවුන්ගේ මුළු tournament දක්ෂතා ගණන් ගනී.'):t('Eligible: all teams.','සුදුසුකම්: සියලු teams.')}</p>${awards.scope==='finalists'?`<p>${awards.finalists.length?awards.finalists.map(esc).join(' · '):t('Waiting for both final participants.','Final කණ්ඩායම් දෙක තීරණය වන තුරු බලා සිටී.')}</p>`:''}<p>${t('Completed matches included','ඇතුළත් අවසන් තරග')}: ${awards.completedMatches}</p><h3>${t('Best Batsman — most runs','හොඳම පිතිකරු — වැඩිම runs')}</h3><p>${awardNames(awards.bestBatsman,'runs',{t,esc})}</p><h3>${t('Best Bowler — most wickets','හොඳම පන්දු යවන්නා — වැඩිම wickets')}</h3><p>${awardNames(awards.bestBowler,'wickets',{t,esc})}</p><h3>${t('Man of the Series — most performance points','තරගාවලියේ වීරයා — වැඩිම performance points')}</h3><p>${awardNames(awards.manOfSeries,'points',{t,esc})}</p><p class="small muted">${awardRuleText(t)} ${t('Best batting/bowling ties share the award. Only completed, non-conflicted fixture scores count, including playoffs.','Best batsman/bowler දක්ෂතා සම නම් සම්මානය බෙදා ගනී. Playoffs ඇතුළු ගැටලු නැති අවසන් තරගවල ලකුණු පමණක් ගනී.')}</p></section>`;
}
