const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
for(const name of ['NotAllowedError','SecurityError','AbortError'])test(`embedded picker invokes API in click stack and handles ${name}`,async()=>{
 const elements=new Map(),tabs=[];let invoked=0;
 const get=id=>{if(!elements.has(id))elements.set(id,{style:{},classList:{add(){},remove(){}},textContent:'',replaceChildren(){}});return elements.get(id);};
 const window={addEventListener(){}},context=vm.createContext({window,parent:{postMessage(){}},location:{href:'chrome-extension://test/wallpaper-editor.html'},URL,URLSearchParams,crypto:require('node:crypto').webcrypto,
  HomeThemeCore:require('../theme-core.js'),HomePaletteEditor:{create:()=>({analyze:async()=>{},cancel(){},update(){},mediaReady(){},destroy(){}})},ResizeObserver:class{observe(){}},document:{getElementById:get,addEventListener(){},body:{}},
  chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p},tabs:{create:async data=>tabs.push(data)},storage:{onChanged:{addListener(){},removeListener(){}}}},
  showOpenFilePicker:()=>{invoked++;return Promise.reject(Object.assign(Error('browser restriction'),{name}));}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../wallpaper-editor.js'),'utf8'),context);
 get('choose').onclick();assert.equal(invoked,1);await new Promise(setImmediate);
 assert.equal(tabs.length,name==='AbortError'?0:1);
 assert.match(get('status').textContent,name==='AbortError'?/已取消/:/不允许此内嵌窗口/);
});
