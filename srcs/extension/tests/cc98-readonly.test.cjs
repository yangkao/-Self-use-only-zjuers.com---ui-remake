const {test}=require('node:test'),assert=require('node:assert/strict');
global.ExternalCore=require('../external-core.js');
global.WebVPNProvider={oidc:'https://webvpn.zju.edu.cn/oidc/'};
const C=require('../providers/cc98.js');
// Transport and storage are entirely fictional. No network or browser credentials.
function fixture(route){
 const data={local:{cc98PrivateRefresh:{clientId:'fiction',refresh:'fixture-refresh'}},session:{cc98PrivateAccess:{clientId:'fiction',access:'fixture-access',expiresAt:Date.now()+3600000}}},calls=[],storage={};let id='fiction',resets=0;
 for(const area of ['local','session'])storage[area]={setAccessLevel:async()=>{},get:async k=>({[k]:data[area][k]}),set:async v=>Object.assign(data[area],v),remove:async keys=>{for(const k of [].concat(keys))delete data[area][k];}};
 const p=C.create({storage,clientId:()=>id,vpn:{ensure:async()=>{},reset:()=>resets++},request:async(url,opts)=>{calls.push({url,opts});return route(new URL(url),opts,calls.length);}});
 return {p,calls,data,changeId:()=>id='other-fiction',resets:()=>resets};
}
const json=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
test('new topic board names load one shared directory on demand and reuse it across pages',async()=>{
 core();const f=fixture(url=>json(url.pathname.endsWith('/all')?[{id:1,name:'Section',boards:[{id:10,name:'Board ten'}]}]:[{id:2,title:'Topic',boardId:10}]));
 const rows=await Promise.all([f.p.query({kind:'new'}),f.p.query({kind:'new',from:20})]);
 assert(rows.every(r=>r.items[0].boardName==='Board ten'));await f.p.query({kind:'new',from:40});
 assert.equal(f.calls.filter(c=>new URL(c.url).pathname.endsWith('/all')).length,1);
});
test('unavailable directory preserves topic rows and never requests per-topic metadata',async()=>{
 core();const f=fixture(url=>url.pathname.endsWith('/all')?new Response('',{status:503}):json([{id:2,title:'Topic',boardId:10}]));
 const result=await f.p.query({kind:'new'});assert.equal(result.items[0].title,'Topic');assert.equal(result.items[0].boardId,'10');assert.equal(result.items[0].boardName,null);assert.equal(f.calls.length,2);
});
function core(){global.CC98Core=require('../cc98-core.js');}
test('provider exposes read-only query alongside existing authentication methods',()=>{const f=fixture(()=>json([]));assert.equal(typeof f.p.query,'function');for(const name of ['unread','top','start','poll','forget','status'])assert.equal(typeof f.p[name],'function');});
test('query emits only whitelisted GET paths, preserves pagination and VPN parameter',async()=>{
 core();const f=fixture(url=>{const path=url.pathname.split('/').pop();return json(path==='me'?{id:1,name:'Demo'}:path==='signin'?{hasSignedInToday:false,lastSignInTime:null,lastSignInCount:0,lastReward:0}:path==='unread-count'?{systemCount:0,atCount:0,replyCount:0,messageCount:0}:path==='index'?{hotTopic:[]}:[]);});
 for(const spec of [{kind:'new',from:20},{kind:'boards'},{kind:'board',boardId:10},{kind:'contacts'},{kind:'conversation',peerId:11},{kind:'replies'},{kind:'mentions'},{kind:'system'},{kind:'profile'},{kind:'unread'},{kind:'signin'},{kind:'month',year:2026,month:2},{kind:'top'}])await f.p.query(spec);
 assert.equal(f.calls.length,13);for(const {url,opts} of f.calls){assert.equal(opts.method,'GET');assert(new URL(url).searchParams.has('vpn-12-o2-www.cc98.org'));assert(!opts.body);}
 const u=new URL(f.calls[0].url);assert.equal(u.searchParams.get('from'),'20');assert.equal(u.searchParams.get('size'),'20');
 await assert.rejects(f.p.query({kind:'https://evil.invalid'}));const n=f.calls.length;const r=await f.p.query({kind:'new',from:500});assert.equal(r.items.length,0);assert.equal(f.calls.length,n);
});
test('profile and messages return selected fields, sanitized text and bounded known avatar URLs',async()=>{
 core();const f=fixture(url=>json(url.pathname.endsWith('/me')?{id:1,name:'Demo',signatureCode:'[b]Hello[/b]<script>bad</script>',portraitUrl:'https://evil.invalid/track',wealth:8,email:'secret',phone:'secret',access_token:'secret'}:[{id:2,senderId:1,receiverId:3,time:'2026-02-01T12:00:00',isRead:true,content:'<b>hi</b>',senderDeleted:false,receiverDeleted:false,isBookMessage:false,secret:'hidden'}]));
 const r=await f.p.query({kind:'profile'});assert.equal(r.profile.id,'1');assert.equal(r.profile.portraitUrl,null);assert.equal(r.profile.wealth,8);assert(!JSON.stringify(r).includes('secret'));assert(!r.profile.signature.includes('<'));
 const c=await f.p.query({kind:'conversation',peerId:3});assert.equal(c.items[0].content,'hi');assert(!JSON.stringify(c).includes('hidden'));
});
test('401 refreshes once; forbidden, absent, rate limit, redirect and malformed JSON remain distinguishable',async()=>{
 core();let gets=0;const f=fixture(url=>url.pathname.endsWith('connect/token')?json({access_token:'new-fiction',token_type:'Bearer',expires_in:3600}):++gets===1?new Response('',{status:401}):json([]));await f.p.query({kind:'new'});assert.equal(gets,2);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);
 for(const [status,code] of [[401,'auth-expired'],[403,'forbidden'],[404,'not-found'],[429,'rate-limit']]){const g=fixture(url=>url.pathname.endsWith('connect/token')?json({access_token:'new-fiction',token_type:'Bearer',expires_in:3600}):new Response('',{status}));await assert.rejects(g.p.query({kind:'new'}),e=>e.code===code);assert(g.calls.length<=3);}
 for(const response of [{type:'opaqueredirect'},{status:302,ok:false},new Response('<html>login</html>')]){const g=fixture(()=>response);await assert.rejects(g.p.query({kind:'new'}),e=>['interaction','format'].includes(e.code));}
});
test('abort, logout and client configuration changes cannot release in-flight private data',async()=>{
 core();for(const action of ['abort','forget','config']){let release,entered;const enteredPromise=new Promise(r=>entered=r),pending=new Promise(r=>release=r),controller=new AbortController();const f=fixture(async()=>{entered();await pending;return json({id:1,name:'Private'});});const job=f.p.query({kind:'profile'},{signal:controller.signal});await enteredPromise;if(action==='abort')controller.abort();if(action==='forget')await f.p.forget();if(action==='config')f.changeId();release();await assert.rejects(job,e=>e.code==='cancelled');}
 const controller=new AbortController();controller.abort();const f=fixture(()=>json([]));await assert.rejects(f.p.query({kind:'new'},{signal:controller.signal}),e=>e.code==='cancelled');assert.equal(f.calls.length,0);
});
test('empty arrays succeed, wrong structures and impossible month dates fail',async()=>{
 core();for(const kind of ['new','boards','contacts','conversation','replies','mentions','system','month']){const f=fixture(()=>json([]));assert.deepEqual((await f.p.query({kind,...(kind==='conversation'?{peerId:1}:kind==='month'?{year:2026,month:2}:{})})).items,[]);}
 for(const kind of ['new','boards','profile','signin','month']){const f=fixture(()=>json({}));await assert.rejects(f.p.query({kind,...(kind==='month'?{year:2026,month:2}:{})}),e=>e.code==='format');}
 const bad=fixture(()=>json([{year:2026,month:2,day:30,useCard:false,reward:10}]));await assert.rejects(bad.p.query({kind:'month',year:2026,month:2}),e=>e.code==='format');
 const good=fixture(()=>json([{year:2026,month:2,day:28,useCard:true,reward:10,secret:'omit'}]));assert.deepEqual((await good.p.query({kind:'month',year:2026,month:2})).items,[{year:2026,month:2,day:28,useCard:true,reward:10}]);
});
test('top metadata batches IDs, handles partial denial and hides anonymous author and post body',async()=>{
 core();const f=fixture(url=>{if(url.pathname.endsWith('/index'))return json({hotTopic:[{id:1,title:'One',isAnonymous:true,authorName:'Private',boardId:9},{id:2,title:'Two'}]});if(url.pathname.endsWith('/basic')){assert.deepEqual(url.searchParams.getAll('id'),['1','2']);return json([{id:1,title:'One',boardId:9},{id:2,title:'Two'}]);}if(url.pathname.endsWith('/1'))return json({id:1,title:'One',time:'2026-02-01T12:00:00',lastPostTime:'2026-02-01T13:00:00',lastPostContent:'FORBIDDEN',content:'FORBIDDEN',portraitUrl:'https://www.cc98.org/a.png'});return new Response('',{status:403});});
 const r=await f.p.query({kind:'top'});assert.equal(r.items[0].authorName,'匿名');assert.equal(r.items[0].lastPostTime,'2026-02-01T13:00:00');assert.equal(r.items[1].partial,true);assert(!JSON.stringify(r).includes('FORBIDDEN'));assert(!JSON.stringify(r).includes('Private'));assert(!JSON.stringify(r).includes('portrait'));assert.equal(f.calls.length,4);
});
test('contacts and reply notices batch only necessary user or topic metadata',async()=>{
 core();const f=fixture(url=>{
  if(url.pathname.endsWith('/recent-contact-users'))return json([{userId:3,lastContent:'[b]Hello[/b]',isRead:false,time:'2026-02-01T12:00:00',senderId:1,phone:'private'}]);
  if(url.pathname.endsWith('/user/basic')){assert.deepEqual(url.searchParams.getAll('id'),['3']);return json([{id:3,name:'Fictional',portraitUrl:'https://www.cc98.org/example.png',email:'private'}]);}
  if(url.pathname.endsWith('/reply'))return json([{id:9,type:1,time:'2026-02-01T12:00:00',topicId:2,postId:8,isRead:false,postBasicInfo:{floor:4,userId:3,userName:'Fictional',content:'private'}}]);
  if(url.pathname.endsWith('/topic/basic')){assert.deepEqual(url.searchParams.getAll('id'),['2']);return json([{id:2,title:'Topic two',boardId:10,lastPostContent:'private'}]);}
  if(url.pathname.endsWith('/all'))return json([{id:1,name:'Section',boards:[{id:10,name:'Board',masters:'private'}]}]);
  throw new Error('Unexpected endpoint');
 });
 await f.p.query({kind:'boards'});const c=await f.p.query({kind:'contacts'});assert.equal(c.items[0].name,'Fictional');assert.equal(c.items[0].lastContent,'Hello');assert.equal(c.items[0].portraitUrl,'https://www.cc98.org/example.png');
 const r=await f.p.query({kind:'replies'});assert.equal(r.items[0].title,'Topic two');assert.equal(r.items[0].floor,4);assert.equal(r.items[0].boardName,'Board');assert(!JSON.stringify([c,r]).includes('private'));assert.equal(f.calls.length,5);
});
test('top fallback has at most two simultaneous metadata requests and preserves ten-item order',async()=>{
 core();let active=0,max=0;const f=fixture(async url=>{
  if(url.pathname.endsWith('/index'))return json({hotTopic:Array.from({length:10},(_,i)=>({id:i+1,title:'Fiction '+i}))});
  if(url.pathname.endsWith('/basic'))return json([]);
  const n=Number(url.pathname.split('/').pop());active++;max=Math.max(max,active);await new Promise(resolve=>setImmediate(resolve));active--;return json({id:n,title:'Fiction '+(n-1),lastPostTime:'2026-02-01T13:00:00'});
 });const r=await f.p.query({kind:'top'});assert.equal(max,2);assert.equal(f.calls.length,12);assert.deepEqual(r.items.map(t=>t.id),['1','2','3','4','5','6','7','8','9','10']);
});
test('directory names cannot cross client configuration boundaries',async()=>{
 core();const f=fixture(url=>json(url.pathname.endsWith('/all')?[{id:1,name:'Section',boards:[{id:10,name:f.data.session.cc98PrivateAccess.clientId==='fiction'?'Private board':'Other board'}]}]:[{id:2,title:'Fictional topic',boardId:10}]));await f.p.query({kind:'boards'});f.changeId();f.data.session.cc98PrivateAccess={clientId:'other-fiction',access:'other-access',expiresAt:Date.now()+3600000};const r=await f.p.query({kind:'new'});assert.equal(r.items[0].boardName,'Other board');assert.equal(f.calls.filter(c=>new URL(c.url).pathname.endsWith('/all')).length,2);
});
test('changing clientId during token refresh never persists the old client token under the new client',async()=>{
 core();let release,entered;const waiting=new Promise(r=>release=r),started=new Promise(r=>entered=r);const f=fixture(async url=>{assert(url.pathname.endsWith('/connect/token'));entered();await waiting;return json({access_token:'old-client-token',refresh_token:'old-client-refresh',token_type:'Bearer',expires_in:3600});});delete f.data.session.cc98PrivateAccess;
 const job=f.p.query({kind:'profile'});await started;f.changeId();release();await assert.rejects(job,e=>e.code==='cancelled');assert.equal(f.data.session.cc98PrivateAccess,undefined);assert.equal(f.data.local.cc98PrivateRefresh.clientId,'fiction');assert.equal(f.calls.length,1);
});
test('avatars accept only verified forum or file hosts and official relative fallback paths',async()=>{
 core();for(const [value,want] of [['/static/images/avatar.gif','https://www.cc98.org/static/images/avatar.gif'],['http://file.cc98.org/fake.png','https://file.cc98.org/fake.png'],['https://file.cc98.org/fake.png','https://file.cc98.org/fake.png'],['https://www.cc98.org@evil.invalid/fake.png',null],['//evil.invalid/fake.png',null],['http://www.cc98.org/fake.png',null]]){const f=fixture(()=>json({id:1,name:'Demo',portraitUrl:value}));assert.equal((await f.p.query({kind:'profile'})).profile.portraitUrl,want);}
});
test('controlled transport errors retain their public codes and safe messages',async()=>{
 core();for(const code of ['rate-limit','timeout','cancelled']){const f=fixture(()=>{throw ExternalCore.problem('Safe fixture message',code);});await assert.rejects(f.p.query({kind:'new'}),e=>e.code===code&&e.publicMessage==='Safe fixture message');}
 const f=fixture(()=>{throw new Error('Secret transport details');});await assert.rejects(f.p.query({kind:'new'}),e=>e.code==='network'&&!e.publicMessage.includes('Secret'));
});
test('board directory is a complete nonpaged result',async()=>{
 core();const f=fixture(()=>json([{id:1,name:'Section',boards:[{id:10,name:'Board'}]}]));assert.deepEqual(await f.p.query({kind:'boards'}),{kind:'boards',items:[{id:'1',name:'Section',boards:[{id:'10',name:'Board'}]}],rawCount:1});
});
