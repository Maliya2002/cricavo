import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
function worker({keys=[],cached,offline=false,failInstall=false}={}) {
  const handlers={},deleted=[],network=[];
  let installed=[],claimed=false,current;
  vm.runInNewContext(source,{
    URL,location:{origin:'https://cricavo.test'},
    self:{addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:()=>{claimed=true;}}},
    caches:{open:async name=>{current=name;return {addAll:async files=>{if(failInstall)throw Error('network unavailable');installed=Array.from(files);}};},
      keys:async()=>keys,delete:async name=>deleted.push(name),match:async()=>cached},
    fetch:async request=>{network.push(request.url);if(offline)throw Error('offline');return 'network response';}
  });
  return {deleted,network,get installed(){return installed;},get claimed(){return claimed;},get current(){return current;},
    lifecycle(name){let pending;handlers[name]({waitUntil:p=>pending=p});return pending;},
    request(path,options={}){let response;handlers.fetch({request:{url:new URL(path,'https://cricavo.test').href,method:'GET',mode:'cors',...options},respondWith:p=>response=p});return response;}};
}
test('offline installation includes real shell files and rejects incomplete downloads',async()=>{
  const w=worker();await w.lifecycle('install');
  assert(w.installed.includes('./engine.js'));assert(w.installed.includes('./index.html'));
  assert(!w.installed.includes('./config.json'));
  for(const file of w.installed)await access(new URL('../dist/'+file,import.meta.url));
  await assert.rejects(worker({failInstall:true}).lifecycle('install'),/network unavailable/);
});
test('cache activation preserves current and unrelated caches',async()=>{
  const initial=worker();await initial.lifecycle('install');
  const w=worker({keys:[initial.current,'cricavo-shell-obsolete','other-app-cache']});
  await w.lifecycle('activate');
  assert.deepEqual(w.deleted,['cricavo-shell-obsolete']);assert.equal(w.claimed,true);
});
test('offline navigation uses shell while online navigation stays fresh',async()=>{
  assert.equal(await worker({offline:true,cached:'offline shell'}).request('/?page=score',{mode:'navigate'}),'offline shell');
  assert.equal(await worker({cached:'old shell'}).request('/',{mode:'navigate'}),'network response');
});
test('auth callbacks, configuration, external requests and writes bypass cache',()=>{
  const w=worker({cached:'must not return this'});
  for(const path of ['/?code=oauth-code','/config.json','https://project.supabase.co/auth/v1/user'])assert.equal(w.request(path),undefined);
  assert.equal(w.request('/scores',{method:'POST'}),undefined);assert.deepEqual(w.network,[]);
});
test('cached scoring assets work offline and uncached assets use network',async()=>{
  const offline=worker({offline:true,cached:'scoring code'});
  assert.equal(await offline.request('/engine.js'),'scoring code');assert.deepEqual(offline.network,[]);
  const online=worker();assert.equal(await online.request('/vendor/supabase.js'),'network response');assert.equal(online.network.length,1);
});
