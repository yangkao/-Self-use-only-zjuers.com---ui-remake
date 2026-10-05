const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../theme-core.js');
const example=()=>T.normalizeState({activeId:'a',themes:[{id:'a',name:'A'},{id:'b',name:'B'}]});
test('theme selection and rename preserve other themes and do not mutate source',()=>{
 const state=example();const selected=T.manageTheme(state,'select','b');
 assert.equal(selected.activeId,'b');assert.equal(state.activeId,'a');
 const renamed=T.manageTheme(selected,'rename','a','New name');
 assert.equal(renamed.themes.find(x=>x.id==='a').name,'New name');
 assert.equal(renamed.activeId,'b');assert.equal(state.themes[1].name,'A');
});
test('default is protected, deletion falls back only for the active theme',()=>{
 const state=example();assert.equal(T.manageTheme(state,'delete','b').activeId,'a');
 assert.equal(T.manageTheme(state,'delete','a').activeId,'default');
 assert.throws(()=>T.manageTheme(state,'delete','default'));
 assert.throws(()=>T.manageTheme(state,'rename','default','Changed'));
 assert.throws(()=>T.manageTheme(state,'rename','a','  '));
 assert.throws(()=>T.manageTheme(state,'select','missing'));
});
