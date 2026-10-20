const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const source=path.resolve(process.env.HOME_DEMO_SOURCE||path.join(__dirname,'../srcs/extension'));
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
test('demo resets only default opacity once and preserves custom theme opacity',async()=>{
 const h=harness();h.data['zjuers-demo-v1:themes']=JSON.stringify({activeId:'custom',themes:[{id:'default',visuals:{searchOpacity:80}},{id:'custom',visuals:{searchOpacity:12}}]});
 h.data['zjuers-demo-v1:searchOpacity20']='true';
 const first=(await h.backend.send({type:'HOME_EXTERNAL',action:'themes-get'})).value.state;
 assert.equal(first.themes[0].visuals.searchOpacity,30);assert.equal(first.themes[1].visuals.searchOpacity,12);
 first.themes[0].visuals.searchOpacity=42;await h.backend.send({type:'HOME_EXTERNAL',action:'themes-set',state:first});
 assert.equal((await h.backend.send({type:'HOME_EXTERNAL',action:'themes-get'})).value.state.themes[0].visuals.searchOpacity,42);
});
test('demo navigation persists locally without reading extension storage',async()=>{
 const h=harness(),categories=require(path.join(source,'tests/navigation-fixture.json'));for(const a of Object.values(categories))for(const i of a)i.href=new URL(i.href,'https://zjuers.com/').href;
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
test('demo network policy blocks school, weather and forum APIs while allowing local assets and Bing images',()=>{
 const base='https://example.org/project/';
 for(const url of ['https://api.cc98.org/topic/new','https://webvpn.zju.edu.cn/login','https://courses.zju.edu.cn/api','https://api.qweather.com/v7/weather/now','https://example.org.evil.test/data','https://cn.bing.com/anything'])assert.equal(B.networkAllowed(base,url),false,url);
 assert.equal(B.networkAllowed(base,'https://example.org/project/navigation.json'),true);
 assert.equal(B.networkAllowed(base,'https://cn.bing.com/th?id=public-image'),true);
 assert.equal(B.forumResourceURL(base,'https://www.cc98.org/topic/1000001'),base+'post.html?example=topic%2F1000001');
 assert.equal(B.forumResourceURL(base,'javascript:alert(1)'),null);
});

const hasRichSource=require('node:fs').existsSync(path.join(source,'cc98-core.js'));
test('synthetic forum paginates distinct boards, messages and calendar without network', {skip:!hasRichSource},async()=>{
 const h=harness(),query=q=>h.backend.send({type:'HOME_EXTERNAL',action:'cc98-query',instance:'test-forum',query:q});
 const top=await query({kind:'top'});assert.equal(top.value.data.items.length,10);assert.equal(new Set(top.value.data.items.map(i=>i.id)).size,10);
 const signin=await query({kind:'signin'});assert.equal(signin.value.data.hasSignedInToday,true);assert.equal(signin.value.data.lastSignInCount,8);
 const first=await query({kind:'new',from:0,size:20});assert(first.ok,first.error);assert.equal(first.value.data.items.length,20);
 const next=await query({kind:'new',from:20,size:20});assert.equal(next.value.data.from,20);assert.notEqual(first.value.data.items[0].id,next.value.data.items[0].id);
 const end=await query({kind:'new',from:480,size:20});assert.equal(end.value.data.items.length,20);assert.equal(end.value.data.limitReached,true);assert.equal(end.value.data.hasMore,false);
 const blocked=await query({kind:'new',from:500,size:20});assert.equal(blocked.value.code,'LIMIT_REACHED');
 const boards=await query({kind:'boards'});assert(boards.value.data.items.length>=3);assert(boards.value.data.items.every(g=>g.boards.length>=3));
 const a=await query({kind:'board',boardId:'1',from:0,size:20}),b=await query({kind:'board',boardId:'2',from:0,size:20});assert.notEqual(a.value.data.items[0].id,b.value.data.items[0].id);
 const profile=await query({kind:'profile'});assert(profile.value.data.profile.name.startsWith("Demo"));assert(profile.value.data.profile.signInCardCount>=0);
 for(const kind of ['replies','mentions','system','contacts']){const r=await query({kind,from:0,size:20});assert(r.value.data.items.length>=10);assert(r.value.data.hasMore);}
 const chat=await query({kind:'conversation',peerId:'101',from:0,size:20});assert(chat.value.data.items.every(i=>i.content.includes('Demo')));
 const month=await query({kind:'month',year:2026,month:10});assert.equal(month.value.data.month,10);assert(month.value.data.items.some(i=>i.useCard));
 assert(!JSON.stringify(h.data).includes('Demo conversation'));assert(!Object.keys(h.data).some(k=>/cc98|externalCache/.test(k)));
 await h.backend.send({type:'HOME_EXTERNAL',action:'cc98-release',instance:'test-forum'});assert.equal(h.backend.cc98.stats().instances,0);
});
test('demo bounded forum cache preserves released-page anchors and isolates instance release', {skip:!hasRichSource},async()=>{
 const {backend}=harness();const read=(from,force=false)=>backend.send({type:'HOME_EXTERNAL',action:'cc98-query',instance:'bounded',query:{kind:'new',from,size:20},force});
 for(let from=0;from<260;from+=20)assert((await read(from)).ok);
 const stats=backend.cc98.stats('bounded');assert(stats.pages<=10);assert(stats.items<=200);assert.equal(stats.newProgress.nextFrom,260);
 assert.equal((await read(0)).value.code,'CACHE_RELEASED');
 assert.equal((await read(0,true)).value.status,'ready');
});
test('demo wallpaper renders solid colors and releases its surface and visibility listener',()=>{
 const vm=require('node:vm'),listeners=new Map(),nodes=[];let destroyed=0,source,layout;
 const container={querySelector:()=>null,prepend:n=>nodes.push(n)};
 const root={querySelector:()=>container,dispatchEvent(){}};
 const context={globalThis:null,document:{hidden:false,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),createElement:tag=>({tagName:tag.toUpperCase(),style:{},addEventListener(){},remove(){},pause(){},removeAttribute(){},load(){}})},crypto:{randomUUID:()=> 'id'},HomeDemo:{media:new Map(),mediaURL:()=> 'wallpaper.svg',notify(){}},HomeThemeCore:{},HomeGlassMedia:{create:()=>({setSource:n=>source=n,setLayout:v=>layout=v,setTheme(){},destroy:()=>destroyed++})},CustomEvent:class{}};context.globalThis=context;
 vm.runInNewContext(require('node:fs').readFileSync(path.join(__dirname,'../srcs/demo/wallpaper.js'),'utf8'),context);
 const wallpaper=context.HomeWallpaper.initialize(root,{});wallpaper.load({id:'solid',wallpaper:{type:'solid',color:'#123456'},visuals:{},material:'liquid'});
 assert.equal(nodes[0].style.backgroundColor,'#123456');
 wallpaper.setSurface({material:'liquid',panels:[{x:0,y:0,w:40,h:30}],visible:true});assert.equal(source,nodes[0]);assert.equal(layout.panels.length,1);
 wallpaper.dispose();assert.equal(destroyed,1);assert.equal(listeners.size,0);
});
