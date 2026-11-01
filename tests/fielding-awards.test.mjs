import {test} from 'node:test';
import assert from 'node:assert/strict';
import {append,replay,undo} from '../dist/engine.js';
import {fieldingFigures} from '../dist/fielding.js';
import {createTournament,updateDraw} from '../dist/tournaments.js';
import {matchAwards,tournamentAwards,updateAwardSelection} from '../dist/awards.js';
import {tournamentBackup,restoreTournamentCopy} from '../dist/tournament-backups.js';
const config={name:'Cup',teams:['A','B','C','D'],format:'manual',overs:1,ballsPerOver:1,players:2,ballType:'softball'};
function start(f={id:'match',teamA:'A',teamB:'B'}){return append({id:f.id,schemaVersion:1,revision:0,events:[],audit:[],settings:{...config,teamA:f.teamA,teamB:f.teamB,battingFirst:'A',widePenalty:1,noBallPenalty:1}},{type:'start',striker:'Batter',nonStriker:'Partner',bowler:'Bowler'});}
function wicketMatch(wicket,fielder,assist){
  let match=start();
  match=append(match,{type:'ball',kind:'normal',runs:0,running:0,wicket,...(fielder?{fielder}:{}),...(assist?{assist}:{}),...(wicket==='runOut'?{out:'striker',nextEnd:'striker'}:{})});
  match=append(match,{type:'start',striker:'Chaser',nonStriker:'Partner',bowler:'Other bowler'});
  return append(match,{type:'ball',kind:'wide',runs:0,running:0});
}
test('catches, stumpings and assisted run-outs record fielders and award split points without changing wickets',()=>{
  for(const wicket of ['caught','stumped','runOut']){
    const m=wicketMatch(wicket,'Fielder',wicket==='runOut'?'Assistant':undefined),figures=fieldingFigures(replay(m),m.settings);
    const row=figures.rows.find(r=>r.name==='Fielder');assert.equal(row.team,'B');assert.equal(row.points,wicket==='runOut'?5:10);
    assert.equal(row[wicket==='caught'?'catches':wicket==='stumped'?'stumpings':'runOuts'],1);
    assert.equal(replay(m).innings[0].bowlers.Bowler.wickets,wicket==='runOut'?0:1);
    assert.equal(matchAwards(m).players.find(p=>p.name==='Fielder').fieldingPoints,row.points);
    if(wicket==='runOut'){assert.equal(figures.rows.find(r=>r.name==='Assistant').assists,1);assert.equal(figures.rows.reduce((s,r)=>s+r.points,0),10);}
  }
  const direct=wicketMatch('runOut','Fielder');assert.equal(matchAwards(direct).manOfMatch[0].points,10);
  const old=wicketMatch('caught');assert.equal(fieldingFigures(replay(old),old.settings).unattributed,1);
});
test('fielding validation rejects impossible credits and undo removes a fielding contribution',()=>{
  const m=start(),ball={type:'ball',kind:'normal',runs:0,running:0};
  for(const data of [{wicket:'bowled',fielder:'X'},{wicket:'caught',fielder:'X',assist:'Y'},{wicket:'runOut',assist:'Y',out:'striker',nextEnd:'striker'},{wicket:'runOut',fielder:'X',assist:' x ',out:'striker',nextEnd:'striker'},{wicket:'caught',fielder:' '.repeat(3)}])assert.throws(()=>append(m,{...ball,...data}));
  const caught=append(m,{...ball,wicket:'caught',fielder:'Fielder'});assert.equal(fieldingFigures(replay(caught),caught.settings).rows.length,1);assert.equal(fieldingFigures(replay(undo(caught)),caught.settings).rows.length,0);
});
test('finalists-only awards use whole tournament stats, all-teams option restores excluded leaders, and backup preserves selection',()=>{
  let t=createTournament(config);const source=team=>({type:'team',team});
  for(let i=0;i<3;i++)t=updateDraw(t,[],{round:i+1,sourceA:source('A'),sourceB:source('B')});
  t=updateDraw(t,[],{round:4,label:'Final',sourceA:source('C'),sourceB:source('D')});
  const matches=t.fixtures.map(f=>{let m=start({...f,teamA:f.sourceA.team,teamB:f.sourceB.team});m.tournamentId=t.id;m=append(m,{type:'ball',kind:'normal',runs:4,running:0,boundary:true});m=append(m,{type:'start',striker:'Chaser',nonStriker:'Partner',bowler:'Other'});return append(m,{type:'ball',kind:'normal',runs:6,running:0,boundary:true});});
  const automatic=tournamentAwards(t,matches);assert.equal(automatic.scope,'finalists');assert.deepEqual(automatic.finalists,['C','D']);assert.equal(automatic.bestBatsman[0].team,'D');assert.equal(automatic.perMatch.size,4);
  const all=updateAwardSelection(t,{scope:'all'});assert.equal(tournamentAwards(all,matches).bestBatsman[0].team,'B');
  t=updateAwardSelection(all,{scope:'finalists',finalId:t.fixtures.at(-1).id});
  const copy=restoreTournamentCopy(tournamentBackup(t,matches));assert.equal(copy.tournament.awardFinalId,copy.tournament.fixtures.at(-1).id);assert.equal(tournamentAwards(copy.tournament,copy.matches).bestBatsman[0].team,'D');
  assert.throws(()=>updateAwardSelection(t,{scope:'finalists',finalId:'missing'}));assert.throws(()=>updateDraw(t,[],{id:t.awardFinalId,remove:true}),/awards final/);
});
