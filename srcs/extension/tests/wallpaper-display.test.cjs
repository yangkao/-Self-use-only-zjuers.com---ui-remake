const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const flush=()=>new Promise(setImmediate);

// Run the real editor closure. Expose only its existing private operations in
// this test VM so browser events and delayed URL results can be ordered exactly.
function fixture(resolveURL){
 const elements=new Map(),media=[],revoked=[],timers=new Set();let readyCount=0;
 function element(tag='div'){
  const listeners=new Map();
  return {tagName:tag.toUpperCase(),style:{},classList:{add(){},remove(){}},clientWidth:100,value:'#123456',
   replaceChildren(...children){this.children=children;},getBoundingClientRect:()=>({height:100}),
   addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
   removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
   dispatch(type){for(const fn of [...(listeners.get(type)||[])])fn();},
   listenerCount(){return [...listeners.values()].reduce((sum,set)=>sum+set.size,0);},
   pause(){this.paused=true;},load(){},removeAttribute(name){if(name==='src')this.src='';}
  };
 }
 const context=vm.createContext({
  URL:Object.assign(class extends URL {},{createObjectURL:()=> 'blob:temporary',revokeObjectURL:url=>revoked.push(url)}),
  location:{href:'https://extension.invalid/wallpaper-editor.html'},crypto:{randomUUID:()=> 'test-request'},
  parent:{postMessage(){}},window:{addEventListener(){}},
  document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement(tag){const node=element(tag);media.push(node);return node;},addEventListener(){},body:element(),documentElement:element()},
  ResizeObserver:class {observe(){}},getComputedStyle:()=>({color:''}),
  setTimeout(fn,delay){const timer=setTimeout(()=>{timers.delete(timer);fn();},delay);timers.add(timer);return timer;},
  clearTimeout(timer){clearTimeout(timer);timers.delete(timer);},
  HomeThemeCore:{defaultTheme:()=>({visuals:{scale:100,brightness:1,grayscale:0}})},
  HomePaletteEditor:{create:()=>({cancel(){},update(){},mediaReady(){readyCount++;},destroy(){}})},
  HomeFileHandles:{url:resolveURL},chrome:{storage:{onChanged:{addListener(){},removeListener(){}}}}
 });
 const source=fs.readFileSync(path.join(__dirname,'../wallpaper-editor.js'),'utf8');
 const exposed=source.replace(/\}\)\(\);\s*$/,'globalThis.probe={display,cleanup,state:()=>({url,node,wallpaper,canApply})};})();');
 assert.notEqual(exposed,source,'test must expose the editor closure');
 vm.runInContext(exposed,context);
 return {probe:context.probe,media,revoked,timers,get readyCount(){return readyCount;}};
}

test('a stale URL is revoked without replacing or leaking the newer displayed image URL',async t=>{
 let completeOld;
 const f=fixture(w=>w.path==='old'?new Promise(resolve=>{completeOld=resolve;}):Promise.resolve('blob:current'));
 t.after(()=>f.probe.cleanup());
 const old=f.probe.display({type:'image',path:'old'});
 const current=f.probe.display({type:'image',path:'current'});await flush();
 f.media[0].dispatch('load');await current;
 completeOld('blob:old');await old;
 const state=f.probe.state();assert.equal(state.url,'blob:current');assert.equal(state.node.src,'blob:current');
 assert.equal(state.wallpaper.path,'current');assert.equal(state.canApply,true);assert.deepEqual(f.revoked,['blob:old']);
 f.probe.cleanup();assert.deepEqual(f.revoked,['blob:old','blob:current']);assert.equal(f.timers.size,0);
});

test('switching media cancels old ready listeners and cannot authorize a temporary replacement',async t=>{
 const f=fixture(async w=>'blob:'+w.path);t.after(()=>f.probe.cleanup());
 const old=f.probe.display({type:'image',path:'old'});await flush();const oldNode=f.media[0];
 assert.equal(oldNode.listenerCount(),2);assert.equal(f.timers.size,1);
 const current=f.probe.display({type:'image',name:'unapproved.png'},{type:'image/png'});await old;
 assert.equal(oldNode.listenerCount(),0);assert.equal(f.timers.size,1);assert.equal(f.probe.state().canApply,false);
 oldNode.dispatch('load');oldNode.dispatch('error');await flush();
 assert.equal(f.probe.state().canApply,false);assert.equal(f.readyCount,0);
 const currentNode=f.media[1];assert.equal(f.probe.state().node,currentNode);assert.equal(currentNode.src,'blob:temporary');
 currentNode.dispatch('load');await current;
 assert.equal(f.probe.state().canApply,false,'temporary media still needs file authorization');
 assert.equal(currentNode.listenerCount(),0);assert.equal(f.timers.size,0);assert.equal(f.readyCount,1);
 f.probe.cleanup();assert.deepEqual(f.revoked,['blob:old','blob:temporary']);
});
