const {test}=require('node:test');
const assert=require('node:assert/strict');
const {navigationComplete,waitForDom}=require('../startup.js');
test('last heading alone cannot indicate that all navigation links have been parsed',()=>{
  const doc={getElementById:()=>({closest:()=>({querySelector:()=>({})})}),querySelector:()=>null};
  assert.equal(navigationComplete(doc),false);
  doc.querySelector=()=>({});assert.equal(navigationComplete(doc),true);
});
test('waits for DOM progress and releases observer when ready',async()=>{
  let callback,disconnected=false,ready=false;
  class Observer {constructor(fn){callback=fn;}observe(){}disconnect(){disconnected=true;}}
  const doc={readyState:'loading',addEventListener(){},removeEventListener(){}};
  let settled=false;const pending=waitForDom(()=>ready,doc,Observer).then(()=>settled=true);
  await Promise.resolve();assert.equal(settled,false);
  ready=true;callback();await pending;assert.equal(disconnected,true);
});
test('missing structure after parsing fails instead of waiting forever',async()=>{
  await assert.rejects(waitForDom(()=>false,{readyState:'complete'},class {}),/原站结构/);
});
