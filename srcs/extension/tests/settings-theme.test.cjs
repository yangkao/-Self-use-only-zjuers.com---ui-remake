const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../theme-core.js'),F=require('../file-handles.js');
test('file reference and crop survive normalization without copying media',()=>{
 const theme=T.normalizeTheme({id:'custom',wallpaper:{type:'image',reference:'local-id',name:'wallpaper.png',crop:{x:70,y:12},bytes:'forbidden'}});
 assert.equal(theme.wallpaper.reference,'local-id');assert.deepEqual(theme.wallpaper.crop,{x:70,y:12});assert(!('bytes'in theme.wallpaper));assert.deepEqual(T.normalizeTheme(theme),theme);
});
test('cover crop uses viewport aspect ratio and clamped persisted position',()=>{
 assert.deepEqual(F.crop(2000,1000,1,{x:100,y:50}),[1000,0,1000,1000]);
 assert.deepEqual(F.crop(1000,2000,1,{x:50,y:0}),[0,0,1000,1000]);
 assert.deepEqual(T.normalizeTheme({id:'x',wallpaper:{crop:{x:150,y:-50}}}).wallpaper.crop,{x:100,y:0});
});
test('Edge scheme C omits button_background while keeping toolbar icon color',()=>{
 const c=T.edgeThemeManifest(T.defaultTheme()).theme.colors;assert(!Object.hasOwn(c,'button_background'));assert.equal(c.toolbar_button_icon.length,3);
});
