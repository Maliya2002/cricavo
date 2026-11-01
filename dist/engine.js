// Pure replay engine. Match settings are immutable; events form the scoring history.
const integer=(n,min,max,label)=>{if(!Number.isInteger(n)||n<min||n>max)throw Error(`Invalid ${label}`);return n};
const name=n=>{if(typeof n!=='string'||!n.trim()||n.trim().length>80)throw Error('Enter a name (1–80 characters)');return n.trim()};
export function validateSettings(raw){
 const s={...raw,teamA:name(raw.teamA),teamB:name(raw.teamB),overs:Number(raw.overs),ballsPerOver:Number(raw.ballsPerOver),players:Number(raw.players),widePenalty:Number(raw.widePenalty),noBallPenalty:Number(raw.noBallPenalty)};
 if(s.teamA.toLowerCase()===s.teamB.toLowerCase())throw Error('Use two different team names');
 integer(s.overs,1,50,'overs');integer(s.ballsPerOver,1,12,'balls per over');integer(s.players,2,22,'players');integer(s.widePenalty,1,5,'wide penalty');integer(s.noBallPenalty,1,5,'no-ball penalty');
 if(!['softball','hardball'].includes(s.ballType))throw Error('Choose a ball type');
 if(!['A','B'].includes(s.battingFirst))throw Error('Choose the team batting first');
 s.freeHit=!!raw.freeHit;s.wideCounts=!!raw.wideCounts;s.noBallCounts=!!raw.noBallCounts;
 return s;
}
export function overs(balls,size=6){return `${Math.floor(balls/size)}.${balls%size}`}
const bat=n=>({name:n,runs:0,balls:0,fours:0,sixes:0,out:false,dismissal:''});
const bowl=n=>({name:n,balls:0,runs:0,wickets:0});
function innings(team,opening){const striker=name(opening.striker),non=name(opening.nonStriker),bowler=name(opening.bowler);if(striker.toLowerCase()===non.toLowerCase())throw Error('Opening batters must be different');return{team,total:0,wickets:0,balls:0,striker,nonStriker:non,bowler,batters:Object.assign(Object.create(null),{[striker]:bat(striker),[non]:bat(non)}),bowlers:Object.assign(Object.create(null),{[bowler]:bowl(bowler)}),extras:{wide:0,noBall:0,bye:0,legBye:0},freeHit:false,needBatter:null,needBowler:false,complete:false,deliveries:[]}}
const swap=i=>{[i.striker,i.nonStriker]=[i.nonStriker,i.striker]};
export function replay(match){
 const s=validateSettings(match.settings);const state={innings:[],current:null,finished:false,result:null};
 for(const e of match.events){
  if(e.type==='fielding'){
   const inning=state.innings[integer(e.innings,0,1,'fielding innings')];
   if(!inning)throw Error('Fielding note requires a started innings');
   integer(e.delivery,0,inning.deliveries.length-1,'fielding delivery');
   if(!['droppedCatch','runsSaved','runsMissed'].includes(e.kind))throw Error('Invalid fielding note');
   const fielder=name(e.fielder);
   const runs=integer(e.runs,e.kind==='droppedCatch'?0:1,e.kind==='droppedCatch'?0:6,'fielding runs');
   (inning.fieldingNotes??=[]).push({...e,fielder,runs});continue;
  }
  if(state.finished)throw Error('Match is already complete');
  if(e.type==='start'){
   if(state.innings.length&&(!state.current.complete||state.innings.length>=2))throw Error('Cannot start this innings');
   const team=state.innings.length?(s.battingFirst==='A'?'B':'A'):s.battingFirst;
   state.current=innings(team,e);state.innings.push(state.current);continue;
  }
  const i=state.current;if(!i)throw Error('Start an innings first');if(i.complete)throw Error('Innings is complete');
  if(e.type==='batter'){
   if(!i.needBatter)throw Error('No replacement batter needed');const n=name(e.name);
   if(Object.keys(i.batters).some(x=>x.toLowerCase()===n.toLowerCase()))throw Error('Choose a new batter; use initials to distinguish names');
   i.batters[n]=bat(n);i[i.needBatter]=n;i.needBatter=null;continue;
  }
  if(e.type==='bowler'){
   if(!i.needBowler)throw Error('Bowler changes are available at the end of an over');const n=name(e.name);if(n.toLowerCase()===i.bowler.toLowerCase())throw Error('A different bowler must bowl the next over');
   const known=Object.keys(i.bowlers).find(x=>x.toLowerCase()===n.toLowerCase());i.bowler=known||n;i.bowlers[i.bowler]??=bowl(i.bowler);i.needBowler=false;continue;
  }
  if(e.type!=='ball')throw Error('Unsupported event');if(i.needBatter||i.needBowler)throw Error('Select the next player before scoring');
  if(!['normal','wide','noBall','bye','legBye'].includes(e.kind))throw Error('Invalid delivery type');
  const runs=integer(e.runs,0,6,'runs');const running=integer(e.running,0,6,'completed runs');
  const boundary=!!e.boundary;
  if(boundary&&![4,6].includes(runs))throw Error('Boundary must be four or six');
  if(boundary&&running!==0)throw Error('A boundary does not rotate strike');
  if(!boundary&&running!==runs)throw Error('Completed runs must match runs scored');
  if(e.kind==='wide'&&boundary&&runs!==4)throw Error('A wide boundary is four plus the penalty');
  if(['bye','legBye'].includes(e.kind)&&runs===0)throw Error('Enter the extra runs');
  if(e.kind==='noBall'&&!['bat','bye','legBye'].includes(e.credit))throw Error('Choose who receives the additional runs');
  if(e.fielder!==undefined||e.assist!==undefined){
   if(!['caught','stumped','runOut'].includes(e.wicket))throw Error('Fielders apply only to catches, stumpings and run outs');
   if(e.fielder!==undefined)name(e.fielder);
   if(e.assist!==undefined){name(e.assist);if(e.wicket!=='runOut'||!e.fielder)throw Error('Run-out assist requires a primary fielder');if(e.assist.trim().toLowerCase()===e.fielder.trim().toLowerCase())throw Error('Fielder and assistant must be different players');}
  }
  if(e.wicket){
   if(!['bowled','caught','lbw','stumped','hitWicket','runOut'].includes(e.wicket))throw Error('Unsupported dismissal');
   if((e.kind==='noBall'||i.freeHit)&&e.wicket!=='runOut')throw Error('Only run out is supported on a no-ball or free hit');
   if(e.kind==='wide'&&!['stumped','hitWicket','runOut'].includes(e.wicket))throw Error('Dismissal is not valid on a wide');
   if(e.wicket!=='runOut'&&(runs!==0||!['normal','wide'].includes(e.kind)))throw Error('This dismissal cannot include additional runs');
   if(boundary)throw Error('A wicket cannot accompany a boundary in this scorer');
   if(e.wicket==='runOut'&&!['striker','nonStriker'].includes(e.out))throw Error('Choose the dismissed batter');
   if(e.wicket==='runOut'&&!['striker','nonStriker'].includes(e.nextEnd))throw Error('Choose the replacement end');
  }
  const legal=e.kind==='wide'?s.wideCounts:e.kind==='noBall'?s.noBallCounts:true;
  const striker=i.striker;const b=i.batters[striker],bo=i.bowlers[i.bowler];const before=i.total;
  const penalty=e.kind==='wide'?s.widePenalty:e.kind==='noBall'?s.noBallPenalty:0;
  const batting=e.kind==='normal'||(e.kind==='noBall'&&e.credit==='bat');
  i.total+=runs+penalty;i.balls+=legal?1:0;bo.balls+=legal?1:0;
  if(e.kind!=='wide')b.balls++;
  if(batting){b.runs+=runs;if(boundary&&runs===4)b.fours++;if(boundary&&runs===6)b.sixes++}
  if(e.kind==='wide')i.extras.wide+=runs+penalty;
  if(e.kind==='noBall'){i.extras.noBall+=penalty;if(e.credit!=='bat')i.extras[e.credit]+=runs}
  if(['bye','legBye'].includes(e.kind))i.extras[e.kind]+=runs;
  bo.runs+=penalty+(batting||e.kind==='wide'?runs:0);
  if(running%2)swap(i);
  if(e.wicket){
   const dismissed=e.wicket==='runOut'?(e.out==='striker'?striker:(striker===i.striker?i.nonStriker:i.striker)):striker;
   i.batters[dismissed].out=true;i.batters[dismissed].dismissal=e.wicket;i.wickets++;
   if(e.wicket!=='runOut')bo.wickets++;
   if(e.wicket==='runOut'){const survivor=i.striker===dismissed?i.nonStriker:i.striker;i[e.nextEnd]=null;i[e.nextEnd==='striker'?'nonStriker':'striker']=survivor;i.needBatter=e.nextEnd}
   else{const end=i.striker===dismissed?'striker':'nonStriker';i[end]=null;i.needBatter=end}
  }
  // A free hit is cleared by a fair delivery even in custom counted-extra formats.
  if(e.kind==='noBall'&&s.freeHit)i.freeHit=true;else if(!['wide','noBall'].includes(e.kind))i.freeHit=false;
  const overEnd=legal&&i.balls%s.ballsPerOver===0;
  if(overEnd){swap(i);if(i.needBatter)i.needBatter=i.needBatter==='striker'?'nonStriker':'striker';i.needBowler=true}
  const chase=state.innings.length===2;const target=chase?state.innings[0].total+1:null;
  i.complete=i.balls>=s.overs*s.ballsPerOver||i.wickets>=s.players-1||(chase&&i.total>=target);
  const label=e.wicket?'W':e.kind==='normal'?String(runs):`${runs+penalty}${{wide:'wd',noBall:'nb',bye:'b',legBye:'lb'}[e.kind]}`;
  i.deliveries.push({...e,label,score:i.total,before,striker,bowler:i.bowler,over:overs(i.balls,s.ballsPerOver),legal});
  if(i.complete){i.needBatter=null;i.needBowler=false;if(chase){state.finished=true;const first=state.innings[0];state.result=i.total>=target?{winner:i.team,margin:s.players-1-i.wickets,by:'wickets'}:i.total===first.total?{winner:null,by:'tie'}:{winner:first.team,margin:first.total-i.total,by:'runs'}}}
 }
 return state;
}
export function append(match,event){const next={...match,events:[...match.events,event],revision:match.revision+1,updatedAt:new Date().toISOString()};replay(next);return next}
export function undo(match){if(match.events.length<=1)throw Error('Nothing to undo');const removed=match.events.at(-1);const next={...match,events:match.events.slice(0,-1),revision:match.revision+1,updatedAt:new Date().toISOString(),audit:[...(match.audit||[]),{action:'undo',event:removed,at:new Date().toISOString()}]};replay(next);return next}
