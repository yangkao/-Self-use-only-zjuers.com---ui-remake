const {test}=require('node:test');const assert=require('node:assert/strict');
const T=require('../theme-core.js'),P=require('../portable-core.js');
test('new themes mute by default; default and custom audio choices survive normalization',()=>{
 assert.equal(T.defaultTheme().muted,true);assert.equal(T.normalizeTheme({id:'new'}).muted,true);
 const s=T.normalizeState({activeId:'one',themes:[{id:'default',muted:false},{id:'one',muted:false}]});
 assert.deepEqual(s.themes.map(t=>t.muted),[true,false]);assert.deepEqual(T.normalizeState(s),s);
 assert.equal(T.manageTheme(s,'select','default').themes[0].muted,true);
});
test('portable audio roundtrip preserves choices and upgrades older files as muted',()=>{
 const c=P.exportConfig({update1Themes:{themes:[{id:'default',muted:false},{id:'one',muted:false}]}});
 assert.deepEqual(P.validate(c).settings.themes.themes.map(t=>t.muted),[true,false]);
 c.settings.themes.themes.forEach(t=>delete t.muted);
 assert.deepEqual(P.validate(c).settings.themes.themes.map(t=>t.muted),[true,true]);
});
