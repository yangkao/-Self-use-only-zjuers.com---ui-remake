const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(options={}){
 const values={},writes=[],listeners=[],calls=[],broadcasts=[];let hold=false;const pending=[];
 const local={setAccessLevel:async()=>{},get:async()=>({}),set:async d=>{writes.push(structuredClone(d));Object.assign(values,d);}};
 const chrome={storage:{local},runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,onMessage:{addListener:f=>listeners.push(f)}},tabs:{onRemoved:{addListener:f=>{chrome.removed=f;}}}};
 const context=vm.createContext({chrome,URL,Response,AbortController,TextEncoder,structuredClone,setTimeout:(fn,ms)=>setTimeout(fn,options.fastTimeout&&ms===18000?5:ms),clearTimeout,CampusProvider:{create:()=>({})},WebVPNProvider:{create:()=>({})},CC98Provider:{create:({request})=>({start:async()=>({status:'pending'}),poll:async()=>({status:'ready'}),unread:async()=>({total:0}),async query(q,{signal}){const r=await request('https://webvpn.zju.edu.cn/readonly-fixture',{method:'GET',signal});return {kind:q.kind,items:await r.json(),rawCount:1};}})},fetch:async(url,o)=>{calls.push({url,signal:o.signal});if(hold)await new Promise((resolve,reject)=>{pending.push(resolve);o.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});});if(options.rateLimit)return new Response('',{status:429});return new Response(JSON.stringify([{id:'1',content:'private-fixture-content'}]));}});
 context.HomeBroadcast=async type=>broadcasts.push(type);
 for(const f of ['external-core.js','cc98-core.js','external-background.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context);
 function send(action,args={},tab=1,url='chrome-extension://fixture/account.html'){return new Promise(resolve=>listeners[0]({type:'HOME_EXTERNAL',action,instance:'instance-fixture-0001',requestId:'request-fixture-0001',...args},{id:'fixture',url,tab:{id:tab},frameId:0},resolve));}
 return {send,calls,writes,broadcasts,hold(){hold=true;},pending,removed:id=>chrome.removed(id)};
}
const tick=()=>new Promise(r=>setTimeout(r,5));
test('background coalesces reads, isolates owners, and never persists private query text',async()=>{
 const h=harness(),spec={query:{kind:'conversation',peerId:'3'}};
 const a=await h.send('cc98-query',spec);assert.equal(a.value.status,'ready');assert.equal(a.value.data.items[0].content,'private-fixture-content');
 await h.send('cc98-query',spec);assert.equal(h.calls.length,1);
 await h.send('cc98-query',spec,2);assert.equal(h.calls.length,2);
 assert.equal(h.writes.length,0);assert(h.calls.every(c=>c.url.startsWith('https://webvpn.zju.edu.cn/')));
 await h.send('cc98-release');await h.send('cc98-query',spec);assert.equal(h.calls.length,3);
 h.removed(2);await h.send('cc98-query',spec);assert.equal(h.calls.length,3,'closing another owner must not clear this instance');
 const denied=await h.send('cc98-query',spec,4,'https://example.com/');assert.equal(denied.ok,false);
});
test('individual cancellation reaches fetch only when every subscriber cancels',async()=>{
 const h=harness();h.hold();const query={kind:'new',from:0,size:20};
 const a=h.send('cc98-query',{query,requestId:'request-a-000001'}),b=h.send('cc98-query',{query,requestId:'request-b-000001'});await tick();assert.equal(h.calls.length,1);
 await h.send('cc98-cancel',{requestId:'request-a-000001'});assert.equal((await a).code,'CANCELLED');assert.equal(h.calls[0].signal.aborted,false);
 await h.send('cc98-cancel',{requestId:'request-b-000001'});assert.equal((await b).code,'CANCELLED');assert.equal(h.calls[0].signal.aborted,true);assert.equal(h.writes.length,0);
});
test('blocked new offset does not request and clearing releases in-flight readers',async()=>{
 const h=harness();const blocked=await h.send('cc98-query',{query:{kind:'new',from:500,size:20}});assert.equal(blocked.value.data.limitReached,true);assert.equal(h.calls.length,0);
 h.hold();const read=h.send('cc98-query',{query:{kind:'contacts'}});await tick();await h.send('cc98-release');assert.equal((await read).code,'CANCELLED');assert.equal(h.calls[0].signal.aborted,true);
});
test('reauthorizing the same client clears prior account data before and after device grant',async()=>{
 const h=harness(),spec={query:{kind:'conversation',peerId:'3'}};
 await h.send('cc98-query',spec);await h.send('cc98-start');await h.send('cc98-query',spec);assert.equal(h.calls.length,2);
 await h.send('cc98-poll');await h.send('cc98-query',spec);assert.equal(h.calls.length,3);
 assert.equal(h.broadcasts.filter(type=>type==='HOME_CC98_RESET').length,2,'both authorization boundaries invalidate the front-end private cache');
 assert(!JSON.stringify(h.writes).includes('private-fixture-content'));
});
test('HTTP throttling and actual fetch timeouts retain distinct background error codes',async()=>{
 const rate=harness({rateLimit:true});assert.equal((await rate.send('cc98-query',{query:{kind:'profile'}})).value.code,'RATE_LIMIT');
 const slow=harness({fastTimeout:true});slow.hold();assert.equal((await slow.send('cc98-query',{query:{kind:'profile'}})).value.code,'TIMEOUT');
});
