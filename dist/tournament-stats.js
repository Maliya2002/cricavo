import { replay } from './engine.js';
import { resolvedFixtures } from './tournaments.js';
import { fieldingFigures, fieldingView } from './fielding.js';

export function tournamentPlayerStats(tournament,matches) {
  const batting=new Map(),bowling=new Map(),byId=new Map(matches.map(m=>[m.id,m]));
  let completedMatches=0,unattributed=0;const fielders=new Map();
  const key=(team,name)=>JSON.stringify([team,name.normalize('NFC').trim()]);
  for(const fixture of resolvedFixtures(tournament,matches)){
    const match=byId.get(fixture.id);
    if(!match||fixture.conflict||fixture.waiting||fixture.bye)continue;
    const state=replay(match);if(!state.finished)continue;completedMatches++;
    const figures=fieldingFigures(state,match.settings);unattributed+=figures.unattributed;
    for(const f of figures.rows){const id=key(f.team,f.name),row=fielders.get(id)||{name:f.name,team:f.team,catches:0,stumpings:0,runOuts:0,assists:0,droppedCatches:0,runsSaved:0,runsMissed:0,points:0};for(const stat of ['catches','stumpings','runOuts','assists','droppedCatches','runsSaved','runsMissed','points'])row[stat]+=f[stat];fielders.set(id,row);}
    for(const innings of state.innings){
      const team=match.settings['team'+innings.team],opponent=match.settings[innings.team==='A'?'teamB':'teamA'];
      for(const batter of Object.values(innings.batters)){
        const id=key(team,batter.name),row=batting.get(id)||{name:batter.name,team,innings:0,runs:0,balls:0,outs:0,fours:0,sixes:0,highest:0};
        row.innings++;row.runs+=batter.runs;row.balls+=batter.balls;row.outs+=Number(batter.out);row.fours+=batter.fours;row.sixes+=batter.sixes;row.highest=Math.max(row.highest,batter.runs);batting.set(id,row);
      }
      const delivered=new Set(innings.deliveries.map(d=>d.bowler));
      for(const bowler of Object.values(innings.bowlers)){
        if(!delivered.has(bowler.name))continue;
        const id=key(opponent,bowler.name),row=bowling.get(id)||{name:bowler.name,team:opponent,innings:0,balls:0,runs:0,wickets:0};
        row.innings++;row.balls+=bowler.balls;row.runs+=bowler.runs;row.wickets+=bowler.wickets;bowling.set(id,row);
      }
    }
  }
  const rank=(rows,metric)=>{
    rows.sort((a,b)=>b[metric]-a[metric]||a.team.localeCompare(b.team)||a.name.localeCompare(b.name));
    let last,position=0;return rows.map((row,i)=>{if(row[metric]!==last)position=i+1;last=row[metric];return {...row,rank:position};});
  };
  return {completedMatches,fielding:{rows:[...fielders.values()],unattributed},
    batting:rank([...batting.values()].map(r=>({...r,average:r.outs?r.runs/r.outs:null,strikeRate:r.balls?r.runs/r.balls*100:null})),'runs'),
    bowling:rank([...bowling.values()].map(r=>({...r,economy:r.balls?r.runs/r.balls*6:null,average:r.wickets?r.runs/r.wickets:null})),'wickets')};
}

export function playerStatsView(tournament,matches,{t,esc}) {
  const stats=tournamentPlayerStats(tournament,matches),rate=n=>n===null?'—':n.toFixed(2);
  const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<section class="card stack spacer"><h2>${t('Player leaderboards','ක්‍රීඩක ලකුණු ලැයිස්තු')}</h2><p>${stats.completedMatches} ${t('completed matches included','අවසන් තරග ඇතුළත් වේ')}</p><p class="small muted">${t('Completed, non-conflicted fixtures only, including playoffs. Players are grouped by team and exact name (case-sensitive); use consistent, distinct names. Equal runs or wickets share a rank. Bowling economy is runs per 6 counted balls so different over sizes can be compared. — means no denominator yet.','Playoffs ඇතුළුව ගැටලු නැති අවසන් තරග පමණි. Team එක සහ නම අනුව players එකතු වේ; අකුරු වෙනස් කළොත් වෙනම player ලෙස ගනී. එක් එක් player සඳහා එකම පැහැදිලි නම භාවිත කරන්න. Runs හෝ wickets සම නම් rank එක සමානයි. Bowling economy යනු ගණනය වූ පන්දු 6කට runs වේ. — යනු තවම ගණනය කළ නොහැක.')}</p>${!stats.completedMatches?`<p>${t('Finish a tournament match to see player statistics.','Player stats බැලීමට tournament තරගයක් අවසන් කරන්න.')}</p>`:`<details open><summary>${t('Most runs','වැඩිම ලකුණු')}</summary>${table(['#',t('Player','ක්‍රීඩකයා'),t('Team','කණ්ඩායම'),t('Innings','ඉනිම්'),t('Runs','ලකුණු'),t('Balls','පන්දු'),'4s','6s',t('Highest','වැඩිම'),'Avg','SR'],stats.batting.map(r=>[r.rank,r.name,r.team,r.innings,r.runs,r.balls,r.fours,r.sixes,r.highest,rate(r.average),rate(r.strikeRate)]))}</details><details><summary>${t('Most wickets','වැඩිම කඩුලු')}</summary>${table(['#',t('Player','ක්‍රීඩකයා'),t('Team','කණ්ඩායම'),t('Innings','ඉනිම්'),t('Wickets','කඩුලු'),t('Balls','පන්දු'),t('Runs conceded','දුන් ලකුණු'),'Econ / 6 balls','Avg'],stats.bowling.map(r=>[r.rank,r.name,r.team,r.innings,r.wickets,r.balls,r.runs,rate(r.economy),rate(r.average)]))}</details>`}${fieldingView(stats.fielding,{t,esc})}</section>`;
}
