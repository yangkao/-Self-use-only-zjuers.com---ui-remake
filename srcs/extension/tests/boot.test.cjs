const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function fixture(){let state,timer,cleared=false,removed=false;const doc={documentElement:{setAttribute:(_,v)=>state=v},getElementById:()=>({remove:()=>removed=true}),body:{prepend(){}},createElement:()=>({style:{}})};
 const ctx=vm.createContext({document:doc,AbortController,setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>cleared=true});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../boot.js'),'utf8'),ctx);
 return {ctx,state:()=>state,timer:()=>timer(),cleared:()=>cleared,removed:()=>removed};}
test('ready shows personal interface and cancels guard',()=>{const f=fixture();assert.equal(f.state(),'loading');f.ctx.HomeBoot.ready();assert.equal(f.state(),'ready');assert(f.cleared());});
test('guard timeout restores source and cancels unfinished mount',()=>{const f=fixture();f.timer();assert.equal(f.state(),'failed');assert(f.ctx.HomeBoot.controller.signal.aborted);assert(f.removed());});
