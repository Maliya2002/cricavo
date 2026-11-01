import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutoBackup } from '../dist/auto-backup.js';
import { append } from '../dist/engine.js';

function fixture() {
  let match = append({ id: crypto.randomUUID(), schemaVersion: 1, revision: 0, audit: [], events: [], settings: {teamA:'A',teamB:'B',overs:2,ballsPerOver:6,players:4,widePenalty:1,noBallPenalty:1,ballType:'softball',battingFirst:'A',freeHit:true} }, {type:'start',striker:'A',nonStriker:'B',bowler:'C'});
  const values = new Map(), calls = [];
  const state = { user: 'user-a', online: true, error: null };
  const options = { getUser: () => state.user, online: () => state.online, listMatches: async () => [match], storage: {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}, client: {from:()=>({insert:async row=>{calls.push(row);return {error:state.error};}})} };
  return { options, state, calls, id:match.id, change:()=>{match=append(match,{type:'ball',kind:'normal',runs:1,running:1});} };
}
test('offline scores persist until reconnect; restart does not resend acknowledged snapshots', async () => {
  const f=fixture(), worker=createAutoBackup(f.options);
  worker.enable(f.id); f.state.online=false; await worker.flush(); assert.equal(f.calls.length,0);
  f.change(); f.state.online=true; await worker.flush(); assert.equal(f.calls.length,1);
  await createAutoBackup(f.options).flush(); assert.equal(f.calls.length,1);
  f.change(); await worker.flush(); assert.equal(f.calls.length,2); assert.notEqual(f.calls[0].id,f.calls[1].id);
});
test('failed uploads retry the same immutable ID; account switches do not upload another account matches', async () => {
  const f=fixture(), worker=createAutoBackup(f.options); worker.enable(f.id);
  f.state.error={code:'NETWORK',message:'offline'}; await worker.flush();
  f.state.user='user-b'; await worker.flush(); assert.equal(f.calls.length,1);
  f.state.user='user-a'; f.state.error={code:'23505'}; await worker.flush();
  assert.equal(f.calls[0].id,f.calls[1].id); await worker.flush(); assert.equal(f.calls.length,2);
  worker.disable(f.id); f.change(); await worker.flush(); assert.equal(f.calls.length,2);
});
