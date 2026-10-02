const {test}=require('node:test');const assert=require('node:assert/strict');
const UI=require('../ui/external.js');

test('weather C uses three deep cloud layers, separate fog bands and original MVP geometry',()=>{
 const node=tag=>({tag,attributes:{},children:[],classList:{add(){}},setAttribute(k,v){this.attributes[k]=String(v);},append(n){this.children.push(n);}});
 global.document={createElementNS:(_,tag)=>node(tag)};
 try{
  const rainy=UI.weatherIcon('小雨','305',true),rects=rainy.children.filter(x=>x.tag==='rect');assert.equal(rects.length,3);assert.equal(Math.max(...rects.map(x=>+x.attributes.y + +x.attributes.height))-Math.min(...rects.map(x=>+x.attributes.y)),75);
  assert.equal(UI.weatherIcon('薄雾','500',true).children.filter(x=>x.tag==='rect').length,3);
  assert.equal(UI.weatherIcon('雾','501',true).children.filter(x=>x.tag==='rect').length,4);
  const cloudy=UI.weatherIcon('多云','101',true);assert.equal(cloudy.attributes.viewBox,'0 0 150 120');assert.equal(cloudy.children[0].attributes.r,'38');assert.equal(cloudy.children.at(-1).attributes.width,'102');
 }finally{delete global.document;}
});

test('rain summaries are concise without inventing timing or probability',()=>{
 assert.equal(UI.compactRain('未来两小时无降水'),'未来2小时无降水');
 assert.equal(UI.compactRain('间歇性降雨还将持续110分钟'),'间歇降雨约110分钟');
 assert.equal(UI.compactRain('20分钟后开始下雨'),'约20分钟后降雨');
 assert.equal(UI.compactRain('未知的服务描述'),'未知的服务描述');
});

test('future exams exclude ended and past dates but retain unpublished dates',()=>{
 const now=Date.parse('2026-10-02T12:00:00+08:00');
 const items=[{id:'past',date:'2026-10-01'},{id:'ended',date:'2026-10-02',end:'2026-10-02T11:00:00+08:00'},{id:'today',date:'2026-10-02'},{id:'future',date:'2026-11-01'},{id:'unknown'}];
 assert.deepEqual(UI.selectExams(items,true,now).map(x=>x.id),['today','future','unknown']);
 assert.deepEqual(UI.selectExams(items,false,now).map(x=>x.id),['today','unknown']);
});
test('calendar grid handles leap days and Monday first without timezone drift',()=>{
 const cells=UI.calendarDays('2024-02');assert.equal(cells.length,42);assert.equal(cells[0],'2024-01-29');assert.ok(cells.includes('2024-02-29'));
});
test('quote attribution wraps source only once',()=>{
 assert.equal(UI.quoteAttribution({author:'作者',from:'作品'}),'作者 · 《作品》');
 assert.equal(UI.quoteAttribution({from:'《作品》'}),'《作品》');
});
test('wallpaper recovery resumes pause without reloading video and cleans listeners',async()=>{
 const listeners={},docListeners={};let plays=0;
 const video={paused:true,ended:false,muted:false,addEventListener:(k,f)=>listeners[k]=f,removeEventListener:(k)=>delete listeners[k],play:async()=>{plays++;video.paused=false;}};
 const doc={hidden:false,addEventListener:(k,f)=>docListeners[k]=f,removeEventListener:(k)=>delete docListeners[k]};
 const stop=UI.watchVideo(video,doc,()=>{});
 try{await new Promise(setImmediate);assert.equal(plays,1);assert.equal(video.muted,true);
 video.paused=true;docListeners.visibilitychange();await new Promise(setImmediate);assert.equal(plays,2);}finally{stop();}
 assert.equal(Object.keys(listeners).length,0);
});

test('invalidated extension context explains that the existing home must reload',async()=>{
 global.chrome={runtime:{sendMessage(){throw new Error('Extension context invalidated.');}}};
 try{await assert.rejects(UI.call('open-account'),/刷新当前首页后重试/);}finally{delete global.chrome;}
});
test('courses prioritize ongoing then upcoming and separately retain completed/unknown',()=>{
 const now=Date.parse('2026-10-02T10:30:00+08:00');
 const course=(id,start,end)=>({id,date:'2026-10-02',start:`2026-10-02T${start}:00+08:00`,end:`2026-10-02T${end}:00+08:00`});
 const result=UI.selectCourses([course('future','14:00','15:35'),course('past','08:00','09:35'),course('ongoing','10:00','11:35'),{id:'unknown',period:'第1节'}],'2026-10-02',now);
 assert.deepEqual(result.current.map(i=>i.id),['ongoing','future']);assert.equal(result.past[0].id,'past');assert.equal(result.unknown[0].id,'unknown');
});
test('Shanghai calendar day is independent of host timezone',()=>{assert.equal(UI.dateOf('2026-10-01T20:00:00Z'),'2026-10-02');});
test('source URL rejects active content',()=>{assert.equal(UI.safeLink('javascript:alert(1)'),null);assert.equal(UI.safeLink('https://courses.zju.edu.cn/'),'https://courses.zju.edu.cn/');});
