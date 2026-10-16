const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const T=require('../theme-core.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../thumbnail.js'),'utf8');
async function run({permission=true,type='video',id='one'}={}){
 const events=[],elements=[],storageWrites=[];
 const body={style:{},replaceChildren(node){this.node=node;}};
 const context=vm.createContext({HomeThemeCore:T,URL,location:{href:'chrome-extension://test/thumbnail.html?id='+id},setTimeout,clearTimeout,
  parent:{postMessage(){}},window:{addEventListener(){}},chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p},extension:{isAllowedFileSchemeAccess:fn=>fn(permission)},storage:{local:{get:async()=>({update1Themes:{themes:[T.normalizeTheme({id:'one',wallpaper:{type,path:'D:\\wallpaper.mp4'}})]}}),set:async patch=>storageWrites.push(patch)}}},
  document:{body,createElement(tag){
   const listeners={};const node={tagName:tag.toUpperCase(),videoWidth:1920,videoHeight:1080,naturalWidth:1920,naturalHeight:1080,
    addEventListener(name,fn){listeners[name]=fn;},pause(){events.push('pause');},removeAttribute(){events.push('release-src');},load(){events.push('load');},
    getContext(){return {drawImage(){events.push('draw');}};},toDataURL(){return 'data:image/jpeg;base64,preview';}};
   Object.defineProperty(node,'src',{get(){return node.url;},set(value){node.url=value;if(tag==='video'||tag==='img')queueMicrotask(()=>listeners[tag==='video'?'loadeddata':'load']?.());}});
   elements.push(node);return node;
  }}});
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../file-handles.js'),'utf8'),context);
 await vm.runInContext(source,context);return {body,events,elements,storageWrites};
}
test('video thumbnail uses a transient static frame and releases the video without persisting pixels',async()=>{
 const result=await run();assert.equal(result.body.node.tagName,'IMG');
 assert.match(result.body.node.url,/^data:image\/jpeg/);assert.deepEqual(result.events,['draw','pause','release-src','load']);
 assert.equal(result.storageWrites.length,0);assert.equal(result.elements[0].autoplay,undefined);
});
test('denied file access gives a placeholder without attempting to open the local file',async()=>{
 const result=await run({permission:false});assert.equal(result.body.node.textContent,'壁纸不可用');assert.equal(result.elements.some(x=>x.tagName==='VIDEO'),false);
});
test('builtin thumbnails work without file access permission',async()=>{
 const result=await run({permission:false,id:'default'});assert.equal(result.body.node.tagName,'IMG');assert.match(result.elements[0].url,/chrome-extension:\/\/test\/assets\/fallback.svg/);
});
