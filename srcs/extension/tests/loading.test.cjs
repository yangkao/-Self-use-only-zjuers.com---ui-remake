const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const core=require('../core.js');
const fixture=require('./navigation-fixture.json');
const startup=require('../startup.js');
test('settings and stylesheet start while template request is still pending',async()=>{
  const events=[];let rejectTemplate;
  const node=()=>({style:{},append(){},prepend(){},remove(){}});
  const root=node();
  const document={body:node(),head:node(),readyState:'complete',querySelector:()=>({}),getElementById(id){
    if(!fixture[id])return null;
    return {closest:()=>({querySelector:()=>({}),querySelectorAll:()=>fixture[id].map(a=>({...a,href:new URL(a.href,'https://zjuers.com/').href,textContent:a.label,getAttribute:()=>a.title,dataset:{}}))})};
  },createElement(tag){events.push(`create:${tag}`);return {...node(),attachShadow:()=>root};}};
  document.body.childNodes=[];
  const context=vm.createContext({HomeExternal:{call:async()=>{events.push('settings');return {};}},document,HomeCore:core,HomeStartup:startup,HomeBoot:{controller:new AbortController(),fail(){},ready(){}},MutationObserver:class {},AbortController,location:{pathname:'/'},performance:{now:()=>12},chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p,sendMessage:async()=>{}},storage:{local:{get:async()=>{events.push('settings');return {};}}}},fetch:()=>{events.push('template');return new Promise((_,reject)=>{rejectTemplate=reject;});},console:{error(){}},URL,Promise});
  const task=vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../content.js'),'utf8'),context);
  await Promise.resolve();
  const concurrent=events.includes('settings') && events.includes('create:link');
  rejectTemplate(new Error('test ends before template completes'));await task;
  assert.equal(concurrent,true,'settings and CSS must not wait for the template response');
});
test('external dashboard initializes only after main ready and two painting frames',async()=>{
 const events=[],frames=[];
 const video={muted:true,addEventListener(){}};
 const root={append(node){if(node?.rel==='stylesheet')queueMicrotask(()=>node.onload());},querySelector:()=>video,querySelectorAll:()=>[]};
 const node=()=>({style:{},append(){},prepend(){},remove(){},isConnected:true});
 const document={body:node(),head:node(),documentElement:node(),getElementById(id){return fixture[id]?{closest:()=>({querySelectorAll:()=>fixture[id].map(a=>({id:a.id,href:new URL(a.href,'https://zjuers.com/').href,textContent:a.label,target:a.target,getAttribute:()=>a.title,dataset:{}}))})}:null;},querySelectorAll:()=>[],createElement(tag){return tag==='template'?{content:{cloneNode:()=>({})}}:{...node(),attachShadow:()=>root};}};
 const context=vm.createContext({document,HomeCore:core,HomeStartup:{waitForDom:async predicate=>predicate(),navigationComplete:()=>true},HomeBoot:{controller:new AbortController(),ready:()=>events.push('ready'),fail:()=>events.push('fail')},HomeExternal:{call:async()=>({}),initialize:r=>{assert.equal(r,root);events.push('external');}},initializeHome:()=>events.push('home'),MutationObserver:class{},location:{pathname:'/'},performance:{now:()=>1},fetch:async()=>({ok:true,text:async()=>''}),chrome:{runtime:{getURL:p=>p,sendMessage:async()=>{}}},requestAnimationFrame:f=>frames.push(f),queueMicrotask,console,URL});
 await vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../content.js'),'utf8'),context);
 assert.deepEqual(events,['home','ready']);frames.shift()();assert.deepEqual(events,['home','ready']);frames.shift()();assert.deepEqual(events,['home','ready','external']);
});
