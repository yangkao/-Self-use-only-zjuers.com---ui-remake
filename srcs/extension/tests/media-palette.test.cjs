const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const flush=()=>new Promise(setImmediate);
function fixture({sampling}={}){
 const events={},sent=[],nodes=[],opened=[],samples=[],palettes=[];
 const themes=[{id:'solid',wallpaper:{type:'solid',color:'#2468ac'}},{id:'legacy',wallpaper:{type:'video'}},{id:'video',wallpaper:{type:'video',crop:{x:20,y:70}},visuals:{scale:125},paletteSettings:{mode:'range',frameCount:16,start:2,end:8,region:'crop',saturation:110},lockedColors:{text:'#ffffff'}}];
 themes.push({...themes[2],id:'custom-bing',wallpaper:{type:'bing',crop:{x:25,y:60}}});
 const host={children:[],querySelectorAll(){return this.children.filter(n=>n.tagName==='VIDEO');},replaceChildren(...children){this.children=children;},append(n){this.children.push(n);}};
 const parent={postMessage(message,origin){sent.push({...message,origin});}};
 const document={hidden:false,getElementById:()=>host,addEventListener(){},createElement(tag){const listeners={};const n={tagName:tag.toUpperCase(),style:{},paused:true,removeAttribute(){this.released=true;},load(){},pause(){this.paused=true;},play:async function(){this.paused=false;},addEventListener(k,f){(listeners[k]??=[]).push(f);},removeEventListener(k,f){listeners[k]=(listeners[k]||[]).filter(v=>v!==f);},set src(v){this.url=v;queueMicrotask(()=>{for(const fn of listeners[tag==='video'?'loadeddata':'load']||[])fn();});}};nodes.push(n);return n;}};
 const context=vm.createContext({AbortController,parent,document,window:{addEventListener(k,f){events[k]=f;}},URL:{revokeObjectURL(){}},setTimeout,clearTimeout,setInterval,clearInterval,
  chrome:{storage:{local:{get:async()=>({update1Themes:{themes}})},session:{get:async()=>({})}}},
  HomeFileHandles:{url:async wallpaper=>{opened.push(wallpaper);return 'blob:local';}},HomeMediaPlayback:{create:n=>({sync:()=>n.play(),dispose:()=>n.pause(),check(){}})},
  HomeBing:{call:async()=>({id:'today',colors:{text:'#123456'}}),url:async()=> 'blob:bing'},
  HomePaletteSampling:{collectPalettePixels:async(n,options,signal)=>{samples.push({n,options,signal});return sampling?sampling(n,options,signal):[new Uint8ClampedArray([1,2,3,255])];}},
  HomeThemeCore:{...require('../theme-core.js'),paletteFromPixels:(pixels,options)=>{palettes.push(options);return {text:'#ffffff'};},paletteFromSolid:(color,options)=>({text:color})}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../media.js'),'utf8'),context);
 let requestId=0;const send=(themeId,analyze=false,extra={})=>events.message({source:parent,origin:'https://zjuers.com',data:{type:'WALLPAPER_LOAD',token:'a'.repeat(32),requestId:++requestId,themeId,analyze,...extra}});
 return {events,sent,nodes,opened,samples,palettes,host,send};
}
test('solid wallpaper is ready without file access and switching releases playing video',async t=>{
 const f=fixture();t.after(()=>f.events.pagehide());f.send('video');await flush();const video=f.host.children[0];assert.equal(video.paused,false);
 f.send('solid',true);await flush();assert.equal(f.opened.length,1);assert.equal(video.paused,true);assert.equal(video.released,true);
 assert.equal(f.host.children[0].style.backgroundColor,'#2468ac');assert(f.sent.some(m=>m.requestId===2&&m.status==='ready'));
 assert(f.sent.some(m=>m.requestId===2&&m.status==='palette'&&m.colors.text==='#2468ac'));f.events.pagehide();
});
test('palette generation samples an independent media with saved crop, scale and palette settings',async t=>{
 const f=fixture();t.after(()=>f.events.pagehide());f.send('video',true,{ratio:1.6});await flush();
 assert.equal(f.samples.length,1);const sample=f.samples[0];assert.notEqual(sample.n,f.host.children[0]);
 assert.equal(sample.options.mode,'range');assert.equal(sample.options.frameCount,16);assert.equal(sample.options.ratio,1.6);assert.equal(sample.options.zoom,1.25);
 assert.equal(sample.options.crop.x,20);assert.equal(f.palettes[0].saturation,110);assert.equal(f.palettes[0].lockedColors.text,'#ffffff');
 assert.equal(sample.n.released,true);assert.equal(f.host.children[0].paused,false);f.events.pagehide();
});
test('changing wallpaper aborts pending analysis and never sends stale colors',async t=>{
 const f=fixture({sampling:(_n,_o,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{name:'AbortError'})),{once:true}))});
 t.after(()=>f.events.pagehide());f.send('video',true);await flush();assert.equal(f.samples.length,1);f.send('solid');await flush();
 assert.equal(f.samples[0].signal.aborted,true);assert.equal(f.samples[0].n.released,true);assert.equal(f.sent.some(m=>m.requestId===1&&m.status==='palette'),false);f.events.pagehide();
});
test('legacy themes use uniform eight-frame crop sampling without changing playback',async t=>{
 const f=fixture();t.after(()=>f.events.pagehide());f.send('legacy',true);await flush();
 const options=require('../palette-sampling.js').normalizeOptions(f.samples[0].options);
 assert.equal(options.mode,'uniform');assert.equal(options.frameCount,8);assert.equal(options.region,'crop');assert.equal(options.zoom,1);assert.equal(options.ratio,16/9);
 assert.equal(f.host.children[0].paused,false);
});
test('sampling failure preserves displayed wallpaper and reports no replacement colors',async t=>{
 const f=fixture({sampling:async()=>{throw Error('decode');}});t.after(()=>f.events.pagehide());f.send('video',true);await flush();
 const failure=f.sent.find(m=>m.status==='palette');assert.equal(failure.colors,undefined);assert.equal(failure.message,'取色失败，保留原配色');
 assert.equal(f.host.children[0].paused,false);assert.equal(f.samples[0].n.released,true);
});
test('custom Bing wallpaper keeps saved colors on ordinary load while default still receives daily colors',async t=>{
 const f=fixture();t.after(()=>f.events.pagehide());f.send('custom-bing');await flush();
 assert(f.sent.some(m=>m.status==='ready'));assert.equal(f.sent.some(m=>m.status==='palette'),false);assert.equal(f.samples.length,0);
 f.send('default');await flush();assert.equal(f.sent.find(m=>m.requestId===2&&m.status==='palette').colors.text,'#123456');
});
test('explicit custom Bing analysis samples the image using custom parameters and locks instead of cached colors',async t=>{
 const f=fixture();t.after(()=>f.events.pagehide());f.send('custom-bing',true,{ratio:1.4});await flush();
 assert.equal(f.samples.length,1);assert.equal(f.samples[0].n.tagName,'IMG');assert.notEqual(f.samples[0].n,f.host.children[0]);
 assert.equal(f.samples[0].options.crop.x,25);assert.equal(f.samples[0].options.zoom,1.25);assert.equal(f.samples[0].options.ratio,1.4);
 assert.equal(f.palettes[0].saturation,110);assert.equal(f.palettes[0].lockedColors.text,'#ffffff');assert.equal(f.sent.find(m=>m.status==='palette').colors.text,'#ffffff');
});
test('solid thumbnail fills JPEG canvas and reports only to the allowed parent without opening files',async()=>{
 const sent=[],fills=[];let opens=0;const body={style:{},replaceChildren(n){this.node=n;}};const parent={postMessage:(m,o)=>sent.push({m,o})};
 const ctx=vm.createContext({URL,location:{href:'chrome-extension://test/thumbnail.html?id=solid'},setTimeout,clearTimeout,parent,window:{addEventListener(){}},
  chrome:{storage:{local:{get:async()=>({update1Themes:{themes:[{id:'solid',wallpaper:{type:'solid',color:'#2468ac'}}]}})}}},HomeThemeCore:{},HomeFileHandles:{url:async()=>{opens++;throw Error('file');}},
  document:{body,createElement(tag){return {tagName:tag.toUpperCase(),getContext(){return {set fillStyle(v){fills.push(v);},fillRect(...v){fills.push(v);}};},toDataURL(type){assert.equal(this.width,320);assert.equal(this.height,180);return 'data:'+type+';base64,solid';}};}}});
 await vm.runInContext(fs.readFileSync(path.join(__dirname,'../thumbnail.js'),'utf8'),ctx);
 assert.equal(opens,0);assert.equal(body.node.tagName,'IMG');assert.deepEqual(fills,['#2468ac',[0,0,320,180]]);assert.equal(sent[0].m.type,'THEME_THUMBNAIL');assert.equal(sent[0].o,'https://zjuers.com');
});
