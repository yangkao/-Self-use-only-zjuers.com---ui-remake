const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../theme-core.js');
const Appearance=require('../ui/appearance.js');

test('appearance round trip retains default Bing colors without exporting local files or credentials',()=>{
 const theme=Core.defaultTheme();theme.colors.primary='#126789';theme.colors.accent='#83c9df';
 theme.wallpaper={type:'video',path:'PRIVATE_FILE',reference:'private-reference'};
 theme.password='secret';theme.token='secret';theme.visuals.uiFont='Segoe UI';
 const before=JSON.stringify(theme),encoded=Appearance.encode(theme),look=Appearance.decode(encoded);
 assert.equal(look.colors.primary,'#126789');assert.equal(look.visuals.uiFont,'Segoe UI');
 assert.deepEqual(Object.keys(look).sort(),['colors','visuals']);
 assert.doesNotMatch(encoded,/PRIVATE_FILE|private-reference|secret|password|token|wallpaper/);
 assert.equal(JSON.stringify(theme),before);
});
test('invalid appearance cannot inject CSS or introduce arbitrary properties',()=>{
 const fallback=Core.defaultTheme();
 const look=Appearance.normalize({colors:{primary:'url(https://invalid/)',accent:'#AbC123',extra:'#123456'},visuals:{uiFont:'untrusted',focusGlow:999}});
 assert.equal(look.colors.primary,fallback.colors.primary);assert.equal(look.colors.accent,'#abc123');
 assert.equal(look.colors.extra,undefined);assert.equal(look.visuals.uiFont,fallback.visuals.uiFont);
 assert.equal(look.visuals.focusGlow,60);assert.equal(Appearance.decode('not-json'),null);
 assert.equal(Appearance.decode('x'.repeat(12001)),null);
});
test('appearance application changes CSS only and can defer reveal',()=>{
 const values=new Map(),root={style:{setProperty:(k,v)=>values.set(k,v)},dataset:{}};
 const look=Appearance.apply({colors:{primary:'#13579b'}},root,{reveal:false});
 assert.equal(root.dataset.themeReady,undefined);assert.equal(values.get('--theme-primary'),'#13579b');
 assert.equal(values.get('--visual-focusGlow'),'20');assert.ok(values.get('font-family').includes('ZJUers Josefin'));
 Appearance.apply(look,root);assert.equal(root.dataset.themeReady,'true');
});
