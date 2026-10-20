const test = require('node:test');
const assert = require('node:assert/strict');
let core; try { core = require('../cc98-core.js'); } catch {}
const page = (q, ids) => ({kind:q.kind,items:ids.map(id=>({id:String(id),title:'fixture'})),rawCount:ids.length});
const tick = () => new Promise(resolve=>setImmediate(resolve));

test('first access is shared and no elapsed TTL causes automatic refresh; force failure preserves data', async () => {
  assert.ok(core,'CC98Core must exist');
  let calls=0, time=0, fail=false;
  const layer=core.createDataLayer({now:()=>time,read:async q=>{calls++; if(fail) throw Object.assign(new Error('secret server detail'),{code:'AUTH_REQUIRED'});return page(q,[1,2]);}});
  const [a,b]=await Promise.all([layer.query('home',{kind:'new'}),layer.query('home',{kind:'new'})]);
  assert.equal(calls,1); assert.deepEqual(a,b);
  time=60*60*1000; await layer.query('home',{kind:'new'}); assert.equal(calls,1);
  fail=true; const error=await layer.query('home',{kind:'new'},{force:true});
  assert.equal(error.status,'error'); assert.equal(error.code,'AUTH_REQUIRED'); assert.equal(error.stale,true); assert.equal(error.data.items.length,2); assert.ok(!error.error.includes('secret'));
  await layer.query('home',{kind:'new'}); assert.equal(calls,2);
});

test('one subscriber abort leaves shared read alive; release rejects remaining subscriber and discards late result', async () => {
  assert.ok(core);
  let resolveRead, upstream;
  const layer=core.createDataLayer({read:(q,{signal})=>{upstream=signal; return new Promise(r=>{resolveRead=r;});}});
  const a=new AbortController(); const b=new AbortController();
  const p1=layer.query('home',{kind:'contacts'},{signal:a.signal}); const rejected=assert.rejects(p1,{name:'AbortError'});
  const p2=layer.query('home',{kind:'contacts'},{signal:b.signal}); const released=assert.rejects(p2,{name:'AbortError'});
  await tick(); a.abort(); await rejected; assert.equal(upstream.aborted,false);
  layer.release('home'); await released; assert.equal(upstream.aborted,true);
  resolveRead(page({kind:'contacts'},[1])); await tick(); assert.equal(layer.stats('home').pages,0);
});

test('all subscribers abort cancels read and permits a later manual retry', async () => {
  assert.ok(core); let upstream;
  const layer=core.createDataLayer({read:(q,{signal})=>{upstream=signal;return new Promise(()=>{});}});
  const c=new AbortController(), p=layer.query('x',{kind:'top'},{signal:c.signal}); const rejected=assert.rejects(p,{name:'AbortError'});
  await tick(); c.abort(); await rejected; assert.equal(upstream.aborted,true); assert.equal(layer.stats('x').inflight,0);
});

test('page eviction retains raw progress and never issues offset 500; manual first page detects new IDs', async () => {
  assert.ok(core); const offsets=[]; let latest=1000;
  const layer=core.createDataLayer({maxPages:2,read:async q=>{offsets.push(q.from);return page(q,Array.from({length:q.size},(_,i)=>latest-q.from-i));}});
  for(let from=0;from<500;from+=20) await layer.query('x',{kind:'new',from});
  assert.equal(layer.stats('x').pages,2); assert.equal(layer.stats('x').newProgress.nextFrom,500);
  const stopped=await layer.query('x',{kind:'new',from:500}); assert.equal(stopped.code,'LIMIT_REACHED'); assert.equal(offsets.length,25);
  const evicted=await layer.query('x',{kind:'new',from:0}); assert.equal(evicted.code,'CACHE_RELEASED'); assert.equal(offsets.length,25);
  latest=1002; const refresh=await layer.query('x',{kind:'new'},{force:true}); assert.equal(refresh.newItemsDetected,true); assert.equal(layer.stats('x').newProgress.round,1);
});

test('deduplication does not decrease raw pagination progress', async () => {
  assert.ok(core); const layer=core.createDataLayer({read:async q=>page(q,[1,1,2])});
  const a=await layer.query('x',{kind:'new',size:3}); assert.equal(a.data.items.length,2); assert.equal(a.data.nextFrom,3);
  const b=await layer.query('x',{kind:'new',from:3,size:3}); assert.equal(b.data.items.length,0); assert.equal(b.data.nextFrom,6);
});

test('aggregate targets, conversations, bytes, items and instances are bounded', async () => {
  assert.ok(core);
  const layer=core.createDataLayer({maxTargets:3,maxPages:4,maxItems:5,maxBytes:1500,maxConversations:2,maxInstances:2,read:async q=>page(q,[1,2,3])});
  for(let id=1;id<12;id++) await layer.query('x',{kind:'conversation',peerId:id});
  const s=layer.stats('x'); assert.ok(s.targets<=3); assert.ok(s.conversations<=2); assert.ok(s.pages<=4); assert.ok(s.items<=5); assert.ok(s.bytes<=1500);
  await layer.query('y',{kind:'top'}); await layer.query('z',{kind:'top'}); assert.equal(layer.stats().instances,2); assert.equal(layer.stats('x').pages,0);
});

test('oversize data is returned without retention and quiet expired instances are cleared opportunistically', async () => {
  assert.ok(core); let time=0;
  const layer=core.createDataLayer({maxBytes:200,now:()=>time,read:async q=>({...page(q,[1]),extra:'x'.repeat(2000)})});
  await layer.query('x',{kind:'top'}); assert.equal(layer.stats('x').bytes,0);
  time=1800001; await layer.query('y',{kind:'top'}); assert.equal(layer.stats('x').anchors,0);
  layer.clear(); assert.equal(layer.stats().instances,0);
});

test('manual new refresh preserves its complete first page and cancels older round continuations', {timeout:500}, async () => {
  let delayed, upstream, latest=100;
  const layer=core.createDataLayer({read:(q,{signal})=>q.from===20?new Promise(resolve=>{delayed=resolve;upstream=signal;}):Promise.resolve(page(q,[latest,latest-1]))});
  await layer.query('x',{kind:'new'});
  const old=layer.query('x',{kind:'new',from:20}); const aborted=assert.rejects(old,{name:'AbortError'});
  await tick(); latest=101;
  const fresh=await layer.query('x',{kind:'new'},{force:true});
  await aborted; assert.equal(upstream.aborted,true); assert.deepEqual(fresh.data.items.map(x=>x.id),['101','100']);
  delayed(page({kind:'new'},[80,79])); await tick(); assert.equal(layer.stats('x').pages,1); assert.equal(layer.stats('x').newProgress.nextFrom,2);
});

test('capacity also bounds anchors and request fanout; returned objects cannot mutate cached data', async () => {
  const layer=core.createDataLayer({maxAnchors:2,read:async q=>page(q,[1])});
  const a=await layer.query('x',{kind:'board',boardId:1}); a.data.items[0].title='modified';
  assert.equal((await layer.query('x',{kind:'board',boardId:1})).data.items[0].title,'fixture');
  await layer.query('x',{kind:'board',boardId:2});
  assert.equal((await layer.query('x',{kind:'board',boardId:3})).code,'CAPACITY_REACHED'); assert.equal(layer.stats('x').anchors,2);
  const pending=core.createDataLayer({maxInflight:1,read:()=>new Promise(()=>{})});
  const task=pending.query('x',{kind:'top'}); const aborted=assert.rejects(task,{name:'AbortError'});
  assert.equal((await pending.query('x',{kind:'profile'})).code,'CAPACITY_REACHED'); pending.clear(); await aborted;
});

test('removal of the newest topic does not falsely report newly inserted topics', async () => {
  let latest=100;
  const layer=core.createDataLayer({read:async q=>page(q,[latest])});
  await layer.query('x',{kind:'new'}); latest=99;
  assert.equal((await layer.query('x',{kind:'new'},{force:true})).newItemsDetected,false);
});

test('provider failures preserve public guidance and distinguish authentication, throttling, format and network errors', async () => {
  for (const [code,want] of [['auth-expired','AUTH_EXPIRED'],['configuration','CONFIGURATION_REQUIRED'],['forbidden','FORBIDDEN'],['not-found','NOT_FOUND'],['rate-limit','RATE_LIMIT'],['format','INVALID_RESPONSE'],['interaction-required','INTERACTION_REQUIRED'],['interaction','INTERACTION_REQUIRED'],['cancelled','CANCELLED'],['unavailable','UNAVAILABLE']]) {
    const layer=core.createDataLayer({read:async()=>{throw Object.assign(new Error('private upstream detail'),{code,publicMessage:'请检查连接后重试'});}});
    const result=await layer.query('x',{kind:'profile'});
    assert.equal(result.code,want); assert.equal(result.error,'请检查连接后重试'); assert.equal(result.status,'error');
    assert.equal((await layer.query('x',{kind:'profile'})).error,'请检查连接后重试');
  }
  const network=core.createDataLayer({read:async()=>{throw new TypeError('Failed to fetch private URL');}});
  const result=await network.query('x',{kind:'top'}); assert.equal(result.code,'NETWORK_ERROR'); assert.equal(result.error,'CC98 data unavailable');
  const unknown=core.createDataLayer({read:async()=>{throw Object.assign(new Error('private'),{code:'SECRET_CODE',publicMessage:'untrusted'});}});
  assert.equal((await unknown.query('x',{kind:'top'})).error,'CC98 data unavailable');
});

test('a complete 31-day calendar retains every date without synthetic pagination', async () => {
  const layer=core.createDataLayer({read:async q=>({kind:q.kind,year:q.year,month:q.month,items:Array.from({length:31},(_,i)=>({year:2026,month:10,day:i+1,reward:10,useCard:false}))})});
  const result=await layer.query('x',{kind:'month',year:2026,month:10});
  assert.equal(result.status,'ready'); assert.equal(result.data.items.length,31);
  assert.equal(result.data.items[30].day,31);
  for(const key of ['hasMore','nextFrom','from','size','limitReached','blocked']) assert.equal(Object.hasOwn(result.data,key),false,key+' must not describe a complete calendar');
  assert.deepEqual((await layer.query('x',{kind:'month',year:2026,month:10})).data,result.data);
});

test('the complete board directory keeps more than twenty sections without paging or deduplication', async () => {
  let received;
  const sections=Array.from({length:31},(_,i)=>({id:String(i+1),name:'fixture',boards:[{id:String(i+100),name:'board'}]}));
  const layer=core.createDataLayer({read:async q=>{received=q;return {kind:q.kind,items:sections,rawCount:31};}});
  const result=await layer.query('x',{kind:'boards'});
  assert.deepEqual(received,{kind:'boards'}); assert.deepEqual(result.data.items,sections); assert.equal(Object.hasOwn(result.data,'hasMore'),false);
});
