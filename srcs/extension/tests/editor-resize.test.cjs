const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('editor resize observer defers and coalesces layout writes and unchanged height messages',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../wallpaper-editor.js'),'utf8'),start=source.indexOf(' let previewFrame='),end=source.indexOf(" window.addEventListener('message'",start);assert(start>=0&&end>start);
 let writes=0,stored='',height=400;const frame=[],messages=[],observers=[],box={clientWidth:640,style:{get height(){return stored;},set height(v){stored=v;writes++;}}};
 const context={ratio:16/9,$:id=>id==='preview'?box:{},requestAnimationFrame:fn=>{frame.push(fn);return frame.length;},parent:{postMessage:m=>messages.push(m)},document:{body:{getBoundingClientRect:()=>({height})}},ResizeObserver:class{constructor(fn){observers.push(fn);}observe(){}}};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';globalThis.reportHeight=queueEditorHeight;',context);
 const flush=()=>{while(frame.length)frame.shift()();};observers[0]();observers[0]();assert.equal(writes,0);assert.equal(frame.length,1);flush();assert.equal(stored,'360px');assert.equal(writes,1);
 observers[0]();flush();assert.equal(writes,1);context.reportHeight();context.reportHeight();flush();assert.equal(messages.length,1);assert.equal(messages[0].height,408);context.reportHeight();flush();assert.equal(messages.length,1);height=401.2;context.reportHeight();flush();assert.equal(messages[1].height,410);
});
