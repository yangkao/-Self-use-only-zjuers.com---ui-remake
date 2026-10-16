const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../srcs/demo/data.js');
const B=require('../srcs/demo/backend.js');
const now=Date.parse('2026-10-16T09:20:00+08:00');
test('demo models a full semester and five useful courses on the example day',()=>{
 const s=D.create(now),c=s.entries.courses.data;
 assert.equal(new Set(c.items.map(i=>i.title)).size,10);assert.equal(c.items.length,272);
 assert.equal(c.items.filter(i=>i.date==='2026-10-16').length,5);
 assert(c.items.every(i=>i.schedule&&i.start&&i.end&&i.campus&&i.place));
 assert.equal(new Set(c.items.map(i=>JSON.stringify(i.schedule)+i.title)).size,18);
});
test('all information cards have credible populated detail data and future deadlines',()=>{
 const s=D.create(now),e=s.entries;
 assert.equal(e.assignments.data.items.length,12);assert.equal(e.exams.data.items.length,6);
 assert(e.assignments.data.items.every(i=>Date.parse(i.deadline)>now));
 assert.equal(e.daily7.data.days.length,7);assert.equal(e.hourly.data.hours.length,24);assert.equal(e.rainDetail.data.points.length,24);
 assert.equal(e.cc98Top.data.items.length,10);assert(e.cc98.data.total>0);assert(e.alerts.data.alerts.length);assert(e.air.data.indexes.length);
 assert(s.example);assert(!JSON.stringify(s).includes('6653986'));
});
test('example dates follow a later visitor rather than staying in 2026',()=>{
 const future=Date.parse('2030-04-21T09:20:00+08:00'),s=D.create(future);
 assert.equal(s.entries.courses.data.items.filter(i=>i.date==='2030-04-21').length,5);
 assert(s.entries.assignments.data.items.every(i=>Date.parse(i.deadline)>future));
});
function harness(){const data={};const storage={getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=v,removeItem:k=>delete data[k]};const backend=B.create({storage,now:()=>now});return {backend,data};}
test('demo navigation persists locally without reading extension storage',async()=>{
 const h=harness(),categories=require('../srcs/extension/tests/navigation-fixture.json');for(const a of Object.values(categories))for(const i of a)i.href=new URL(i.href,'https://zjuers.com/').href;
 const read=await h.backend.send({type:'HOME_NAV',action:'read',categories});assert(read.ok);
 const next=await h.backend.send({type:'HOME_NAV',action:'apply',categories,revision:read.value.state.revision,op:{type:'fold',id:'dg-zju',value:true}});assert(next.ok);
 const again=await h.backend.send({type:'HOME_NAV',action:'read',categories});assert.equal(again.value.state.folds['dg-zju'],true);
 assert(Object.keys(h.data).every(k=>k.startsWith('zjuers-demo-v1:')));
});
test('demo rejects credential collection and portable configuration operations',async()=>{
 const h=harness();for(const action of ['save-campus','save-weather','save-webvpn','cc98-device-start','portable-import','portable-export']){
  const r=await h.backend.send({type:'HOME_EXTERNAL',action,password:'do-not-store',key:'do-not-store'});assert.equal(r.ok,false);
 }assert(!JSON.stringify(h.data).includes('do-not-store'));
});
test('default widget identities survive repeat reads and timers persist their pause state',async()=>{
 const {backend}=harness(),a=await backend.send({type:'HOME_WIDGETS',action:'read'}),b=await backend.send({type:'HOME_WIDGETS',action:'read'});assert.deepEqual(a.value.state,b.value.state);
 const state=a.value.state;state.instances.push({id:'demo-focus',kind:'focus',enabled:true,config:{name:'阅读',minutes:25}});
 assert((await backend.send({type:'HOME_WIDGETS',action:'save',state})).ok);
 const running=await backend.send({type:'HOME_WIDGETS',action:'timer',id:'demo-focus',operation:'start'});assert.equal(running.value.runtime['demo-focus'].running,true);
 const paused=await backend.send({type:'HOME_WIDGETS',action:'timer',id:'demo-focus',operation:'pause'});assert.equal(paused.value.runtime['demo-focus'].running,false);
});
test('demo resource routing preserves settings queries and a Pages project subdirectory',()=>{
 assert.equal(B.resourceURL('https://example.org/project/','account.html?section=weather'),'https://example.org/project/frames/account.html?section=weather');
 assert.equal(B.resourceURL('https://example.org/project/','ui/style.css'),'https://example.org/project/app/ui/style.css');
});
