const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'../srcs/extension'),T=require(path.join(base,'theme-core.js')),P=require(path.join(base,'portable-core.js'));
test('a clean install has only the Bing theme and carries no configured sources',()=>{
 const s=T.normalizeState();assert.equal(s.activeId,'default');assert.equal(s.themes.length,1);assert.equal(s.themes[0].wallpaper.type,'bing');assert.equal(s.themes[0].wallpaper.path,'');
 const exported=P.exportConfig({});assert.equal(exported.settings.preferences.engine,'Bing');assert.equal(exported.settings.preferences.rotateLogo,false);assert.equal(exported.settings.weather.host,'');assert.equal(exported.settings.weather.location,null);assert.equal(exported.settings.navigation,null);
});
test('old builtin references without a saved location cannot invent an author-specific local path',()=>{
 const s=T.normalizeState({activeId:'default',themes:[{id:'default',wallpaper:{type:'builtin',path:''}}]});assert.equal(s.activeId,'default');assert.equal(s.themes.length,1);assert.equal(s.themes[0].wallpaper.type,'bing');
});
test('saved local references remain local user data during upgrade',()=>{
 const wallpaper={type:'builtin',path:'C:/example/wallpaper.mp4',reference:'example-file',name:'wallpaper.mp4'};
 const s=T.normalizeState({activeId:'default',themes:[{id:'default',wallpaper,muted:false,colors:{primary:'#abcdef'}}]});const active=s.themes.find(t=>t.id===s.activeId);
 assert.equal(active.wallpaper.type,'video');assert.equal(active.wallpaper.path,wallpaper.path);assert.equal(active.wallpaper.reference,wallpaper.reference);assert.equal(active.muted,false);assert.equal(active.colors.primary,'#abcdef');
});
test('formal package has no legacy external migration channel',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));assert.match(m.version,/^\d+\.\d+\.\d+$/);assert.equal(m.externally_connectable,undefined);assert.equal(m.options_page,'account.html');assert.equal(fs.existsSync(path.join(base,'migration.js')),false);
});
test('public desktop source carries no development review forms or migration imports',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));if(m.version!=='1.0.0')return;
 for(const name of ['migration.html','migration.js','cc98-preview.html','ui/components-preview.html'])assert.equal(fs.existsSync(path.join(base,name)),false,name);
 assert.doesNotMatch(fs.readFileSync(path.join(base,'background.js'),'utf8'),/importScripts\('migration.js'\)/);
 assert.doesNotMatch(fs.readFileSync(path.join(base,'account.html'),'utf8'),/cc98-preview/);
 assert.doesNotMatch(fs.readFileSync(path.join(base,'external-background.js'),'utf8'),/cc98-preview/);
});
