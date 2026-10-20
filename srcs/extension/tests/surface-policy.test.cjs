const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../theme-core.js');
const P=require('../portable-core.js');

test('new configuration and new theme drafts use blend while existing themes retain current',()=>{
 assert.equal(T.defaultTheme().material,'blend');
 assert.equal(T.normalizeState().themes[0].material,'blend');
 assert.equal(T.normalizeState({}).themes[0].material,'blend');
 const oldDefault=T.defaultTheme();delete oldDefault.material;
 const oldCustom=T.normalizeTheme({id:'old',colors:{primary:'#123456'}});delete oldCustom.material;
 const state=T.normalizeState({activeId:'old',themes:[oldDefault,oldCustom]});
 assert.equal(state.activeId,'old');
 assert.deepEqual(state.themes.map(t=>t.material),['current','current']);
 assert.equal(state.themes[1].colors.primary,'#123456');
 assert.equal(T.createThemeDraft({...oldCustom,material:'liquid'},'new').material,'blend');
});

test('material normalization retains valid selections and safely resolves invalid saved values',()=>{
 for(const material of ['current','blend','liquid']){
  assert.equal(T.normalizeTheme({id:'custom',material}).material,material);
  assert.equal(T.normalizeTheme({...T.defaultTheme(),material}).material,material);
 }
 for(const material of [undefined,null,'glass','LIQUID',0,{},['liquid']]){
  assert.equal(T.normalizeTheme({id:'custom',material}).material,'current');
 }
});

test('portable material roundtrips preserve custom colors and input files',()=>{
 for(const material of ['current','blend','liquid']){
  const custom=T.normalizeTheme({id:'custom',material,colors:{primary:'#123456'}});
  const file=P.exportConfig({update1Themes:{activeId:'custom',themes:[{...T.defaultTheme(),material},custom]}});
  const before=structuredClone(file),prepared=P.prepare({},file);
  assert.deepEqual(prepared.update1Themes.themes.map(t=>t.material),[material,material]);
  assert.equal(prepared.update1Themes.themes[1].colors.primary,'#123456');
  assert.deepEqual(file,before);
 }
});

test('legacy portable files without material import as current without resetting colors',()=>{
 const custom=T.normalizeTheme({id:'custom',colors:{primary:'#123456'}});
 const file=P.exportConfig({update1Themes:{activeId:'custom',themes:[T.defaultTheme(),custom]}});
 for(const theme of file.settings.themes.themes)delete theme.material;
 const validated=P.validate(file);
 assert.deepEqual(validated.settings.themes.themes.map(t=>t.material),['current','current']);
 assert.equal(validated.settings.themes.themes[1].colors.primary,'#123456');
 assert.equal(Object.hasOwn(file.settings.themes.themes[0],'material'),false);
});

test('portable import rejects invalid material instead of coercing it',()=>{
 for(const material of [null,'glass','LIQUID','',0,{},['liquid']]){
  const file=P.exportConfig({});file.settings.themes.themes[0].material=material;
  assert.throws(()=>P.validate(file));
 }
});

test('legacy builtin migration validates material and keeps old video selection',()=>{
 const file=P.exportConfig({});
 const theme=file.settings.themes.themes[0];
 theme.wallpaper={type:'builtin',path:''};delete theme.material;
 assert.equal(P.validate(file).settings.themes.themes[0].material,'current');
 theme.material='unsupported';assert.throws(()=>P.validate(file));
 const migrated=T.normalizeState({activeId:'default',themes:[{id:'default',wallpaper:{type:'builtin',path:'old.mp4'},colors:{primary:'#123456'}}]});
 assert.equal(migrated.themes[0].material,'current');
 assert.equal(migrated.themes[1].material,'current');
 assert.equal(migrated.themes[1].colors.primary,'#123456');
});
