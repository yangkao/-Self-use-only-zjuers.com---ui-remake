const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function setup(fail=false){
 const listeners=new Map(),frames=new Map(),statuses=[],calls=[];let next=0,kills=0,surface;
 const canvas={style:{},addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),remove(){this.removed=true;}};
 const document={hidden:false,createElement:()=>canvas,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 class Surface{constructor(){if(fail)throw Error('WebGL unavailable');surface=this;}setSize(...v){calls.push(['size',...v]);}setPanels(v){calls.push(['panels',v]);}setSource(v){calls.push(['source',v]);}setVisuals(v){calls.push(['visuals',v]);}flush(commit){calls.push(['flush']);commit?.();}suspend(){calls.push(['suspend']);}destroy(){kills++;}}
 const context={document,ZJGGooseSurface:Surface,innerWidth:1000,innerHeight:700,console,requestAnimationFrame:f=>{frames.set(++next,f);return next;},cancelAnimationFrame:id=>frames.delete(id)};
 context.globalThis=context;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../glass-media.js'),'utf8'),context);
 const container={appendChild:n=>{container.child=n;}};
 const api=context.HomeGlassMedia.create({container,onStatus:s=>statuses.push(s)});
 const handlers=new Map(),video={tagName:'VIDEO',style:{},videoWidth:1920,videoHeight:1080,readyState:4,paused:false,ended:false,addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:n=>handlers.delete(n),requestVideoFrameCallback:f=>{frames.set(++next,f);return next;},cancelVideoFrameCallback:id=>frames.delete(id)};
 return{api,canvas,document,container,video,handlers,frames,statuses,calls,listeners,get surface(){return surface;},get kills(){return kills;}};
}
test('shares active video, uses actual panel radius, and stops callbacks on hide/destroy',()=>{
 const s=setup();s.api.setSource(s.video,{visuals:{scale:110,brightness:.7,grayscale:20}});
 s.api.setLayout({visible:true,width:1000,height:700,panels:[{kind:'search',x:10,y:20,w:400,h:50,radius:9,opacity:.3,tint:[.1,.2,.3]}]});
 assert.ok(s.calls.some(v=>v[0]==='source'&&v[1]===s.video));
 assert.match(s.canvas.style.clipPath,/9 9/);
 assert.equal(s.calls.filter(v=>v[0]==='panels').at(-1)[1][0].radius,9);
 assert.ok(s.frames.size>0);s.api.setLayout({visible:false});assert.equal(s.frames.size,0);
 s.api.destroy();assert.equal(s.kills,1);assert.equal(s.handlers.size,0);assert.equal(s.listeners.size,0);assert.equal(s.canvas.removed,true);
});
test('static image uploads on change without ongoing animation',()=>{
 const s=setup(),img={tagName:'IMG',style:{},naturalWidth:100,naturalHeight:100,complete:true,addEventListener(){},removeEventListener(){}};
 s.api.setLayout({visible:true,panels:[{x:0,y:0,w:100,h:40,radius:0}]});s.api.setSource(img,{visuals:{}});
 assert.ok(s.calls.some(v=>v[0]==='source'&&v[1]===img));assert.equal(s.frames.size,0);s.api.destroy();
});
test('WebGL initialization failure and context loss report observable blend fallback',()=>{
 const failed=setup(true);assert.equal(failed.statuses.at(-1).effective,'blend');assert.match(failed.statuses.at(-1).reason,/WebGL/);
 const s=setup();s.listeners.get('webglcontextlost')({preventDefault(){}});assert.equal(s.statuses.at(-1).effective,'blend');assert.equal(s.kills,1);s.api.destroy();assert.equal(s.kills,1);
});
test('layout changes reuse source texture and skip redundant viewport allocation',()=>{
 const s=setup(),img={tagName:'IMG',style:{},naturalWidth:100,naturalHeight:100,complete:true,addEventListener(){},removeEventListener(){}};
 s.api.setLayout({visible:true,width:1000,height:700,panels:[{x:0,y:0,w:100,h:40,radius:9}]});s.api.setSource(img,{visuals:{}});
 const uploads=s.calls.filter(v=>v[0]==='source').length,sizes=s.calls.filter(v=>v[0]==='size').length;
 s.api.setLayout({panels:[{x:0,y:10,w:100,h:40,radius:9}]});
 assert.equal(s.calls.filter(v=>v[0]==='source').length,uploads);assert.equal(s.calls.filter(v=>v[0]==='size').length,sizes);s.api.destroy();
});

test('moving panels keeps the pending video callback and requests a coordinated commit',()=>{
 const s=setup();
 s.api.setLayout({panels:[{id:'card-a',x:10,y:20,w:100,h:50}]});s.api.setSource(s.video,{visuals:{}});
 const pending=[...s.frames.keys()][0],before=s.calls.filter(v=>v[0]==='flush').length;
 s.api.setLayout({panels:[{id:'card-a',x:10,y:5,w:100,h:50}]});
 assert.ok(s.frames.has(pending),'layout must not cancel video callbacks');
 assert.ok(s.calls.filter(v=>v[0]==='flush').length>before,'geometry must commit before exposing its clip');s.api.destroy();
});

test('Goose merges pending commits and exposes only the newest clip after actual draw',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../vendor/goose-glass.js'),'utf8');
 const adapter=code.slice(code.indexOf('globalThis.ZJGGooseSurface = class'),code.lastIndexOf('})();'));
 const gl=new Proxy({NO_ERROR:0,getError:()=>0},{get:(o,k)=>k in o?o[k]:(()=>{})});let draws=0;
 class Renderer{constructor(){this.gl=gl;this.uWp={};this.rafId=null;this.wallpaperReady=true;}gooseRender(){if(this.needsRedraw){draws++;this.needsRedraw=false;}}gooseBG(){}gooseResize(){}gooseContentH(){}gooseReqRender(){this.needsRedraw=true;this.rafId=1;}gooseKill(){}}
 const ctx={LiquidGlassRenderer:Renderer,window:{devicePixelRatio:1,innerWidth:1000,innerHeight:700},cancelAnimationFrame(){}};ctx.globalThis=ctx;vm.runInNewContext(adapter,ctx);
 const a=new ctx.ZJGGooseSurface({}),commits=[];
 a.flush(()=>commits.push('old'));a.flush(()=>commits.push('latest'));
 assert.equal(draws,0);assert.equal(commits.length,0);
 a.renderer.gooseRender();assert.equal(draws,1);assert.deepEqual(commits,['latest']);
 a.destroy();
});
test('source upload failure restores source styling and releases context once',()=>{
 const s=setup();const img={tagName:'IMG',style:{filter:'original',transform:'translateX(1px)'},naturalWidth:10,naturalHeight:10,addEventListener(){},removeEventListener(){}};
 s.api.setLayout({panels:[{x:0,y:0,w:100,h:40,radius:9}]});s.surface.setSource=()=>{const error=Error('tainted');error.name='SecurityError';throw error;};s.api.setSource(img,{visuals:{brightness:.6}});
 assert.equal(s.statuses.at(-1).effective,'blend');assert.match(s.statuses.at(-1).reason,/origin/);
 assert.equal(img.style.filter,'original');assert.equal(img.style.transform,'translateX(1px)');assert.equal(s.kills,1);s.api.destroy();assert.equal(s.kills,1);
});
test('Goose adapter uses real radius and directly uploads the supplied video node',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../vendor/goose-glass.js'),'utf8');
 const adapter=code.slice(code.indexOf('globalThis.ZJGGooseSurface = class'),code.lastIndexOf('})();'));
 let uploaded,panels,deleted=0;
 const gl=new Proxy({NO_ERROR:0,texImage2D(...args){uploaded=args.at(-1);},getError:()=>0,createTexture:()=>({})},{get(target,key){return key in target?target[key]:(()=>{});}});
 class Renderer{constructor(){this.gl=gl;this.uWp={};this.rafId=null;this.animRafId=null;}gooseRender(){}gooseBG(){}gooseResize(){}gooseContentH(){}gooseReqRender(){}gooseElements(v){panels=v;}gooseKill(){deleted++;}}
 const ctx={LiquidGlassRenderer:Renderer,window:{devicePixelRatio:1,innerWidth:1000,innerHeight:700},gooseGlass:(id,rect,opts)=>({id,rect,...opts}),gooseHL:{},gooseShadow:{},cancelAnimationFrame(){}};ctx.globalThis=ctx;vm.runInNewContext(adapter,ctx);
 const a=new ctx.ZJGGooseSurface({});a.setPanels([{kind:'search',x:1,y:1,w:300,h:50,radius:9,tint:[.1,.2,.3],opacity:.3},{kind:'search',x:1,y:70,w:300,h:50,radius:0}]);
 assert.equal(panels[0].cornerRadius,9);assert.equal(panels[1].cornerRadius,0);
 const video={videoWidth:1920,videoHeight:1080};assert.equal(a.setSource(video),true);assert.equal(uploaded,video);a.destroy();assert.equal(deleted,1);
});
test('SVG IMG invalid-value upload rasterizes once, reuses cache, frees it, and never rasterizes video',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../vendor/goose-glass.js'),'utf8'),adapter=code.slice(code.indexOf('globalThis.ZJGGooseSurface = class'),code.lastIndexOf('})();'));
 const uploads=[],rasters=[];let error=0,draws=0;
 const gl=new Proxy({NO_ERROR:0,INVALID_VALUE:1281,MAX_TEXTURE_SIZE:3379,getParameter:()=>1024,texImage2D(...args){const source=args.at(-1);uploads.push(source);if(source.tagName==='IMG')error=1281;},getError(){const e=error;error=0;return e;},createTexture:()=>({})},{get:(target,key)=>key in target?target[key]:(()=>{})});
 class Renderer{constructor(){this.gl=gl;this.uWp={};}gooseRender(){}gooseBG(){}gooseResize(){}gooseContentH(){}gooseReqRender(){}gooseKill(){}}
 const ctx={LiquidGlassRenderer:Renderer,window:{devicePixelRatio:1,innerWidth:1000,innerHeight:700},document:{createElement(){const c={tagName:'CANVAS',width:0,height:0,getContext:()=>({drawImage(){draws++;}})};rasters.push(c);return c;}},cancelAnimationFrame(){}};ctx.globalThis=ctx;vm.runInNewContext(adapter,ctx);
 const a=new ctx.ZJGGooseSurface({}),img={tagName:'IMG',naturalWidth:4000,naturalHeight:2000};a.setSource(img);
 assert.equal(draws,1);assert.equal(rasters[0].width,1024);assert.equal(rasters[0].height,512);assert.equal(uploads.at(-1),rasters[0]);
 a.setSource(img);assert.equal(draws,1);assert.equal(uploads.at(-1),rasters[0]);
 const video={tagName:'VIDEO',videoWidth:1920,videoHeight:1080};a.setSource(video);assert.equal(uploads.at(-1),video);assert.equal(draws,1);assert.equal(rasters[0].width,0);assert.equal(rasters[0].height,0);
 a.setSource(img);assert.equal(draws,2);const last=rasters.at(-1);a.destroy();assert.equal(last.width,0);assert.equal(last.height,0);
 const b=new ctx.ZJGGooseSurface({});error=1282;const count=rasters.length;assert.throws(()=>b.setSource(img),/before media upload error \(1282/);assert.equal(rasters.length,count);b.destroy();
});
