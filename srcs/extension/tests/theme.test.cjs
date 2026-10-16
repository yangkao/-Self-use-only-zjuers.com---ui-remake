const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../theme-core.js');
test('default cannot be replaced and custom path survives migration',()=>{
 const state=core.normalizeState({activeId:'mine',themes:[{id:'default',name:'bad'},{id:'mine',name:'图',wallpaper:{type:'image',path:'D:\\我的图\\a b.jpg'}}]});
 assert.equal(state.themes[0].name,'必应每日壁纸');assert.equal(state.activeId,'mine');assert.equal(state.themes[1].wallpaper.path,'D:\\我的图\\a b.jpg');
 assert.equal(core.normalizeState(null,{wallpaper:{type:'video',path:'D:\\a.mp4'},brightness:.4}).themes[1].visuals.brightness,.4);
});
test('bounds and fonts reject invalid values and states cap themes',()=>{
 const v=core.normalizeVisuals({brightness:9,blur:-5,radius:Infinity,uiFont:'evil'});
 assert.equal(v.brightness,1.5);assert.equal(v.blur,0);assert.equal(v.radius,9);assert.equal(v.uiFont,'ZJUers Josefin');
 assert.equal(core.normalizeState({themes:Array.from({length:40},(_,i)=>({id:'t'+i}))}).themes.length,30);
 assert.equal(core.normalizeTheme({colors:{text:'url(evil)'}}).colors.text,'#f1e5f4');
});
test('local file URL handles unicode and rejects remote or relative references',()=>{
 assert.equal(core.fileURL('D:\\我的图\\a b#1.jpg'),'file:///D:/%E6%88%91%E7%9A%84%E5%9B%BE/a%20b%231.jpg');
 for(const value of ['https://evil/a','file://evil/a','a.jpg','D:relative.jpg'])assert.equal(core.fileURL(value),'');
});
function luminance(hex){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
test('representative palette preserves hue across frames and readable text',()=>{
 const red=core.paletteFromPixels([[255,0,0,255,255,0,0,255,0,255,255,255],[255,0,0,255]]);
 const blue=core.paletteFromPixels([[0,0,255,255,0,0,255,255]]);
 assert.notEqual(red.accent,blue.accent);
 for(const p of [red,blue]){assert.equal(Object.keys(p).length,13);assert.ok((luminance(p.text)+.05)/(luminance(p.background)+.05)>=7);}
 assert.deepEqual(core.paletteFromPixels([]),core.defaultTheme().colors);
});
test('Edge export contains colors only and greeting substitutes plain bounded text',()=>{
 const manifest=core.edgeThemeManifest({id:'secret',wallpaper:{type:'video',path:'D:\\secret.mp4'},password:'secret'});
 assert.equal(manifest.manifest_version,3);assert.ok(manifest.theme.colors.frame);assert.ok(!JSON.stringify(manifest).includes('secret'));
 assert.equal(core.greeting({name:'小王',morning:'早安，{称呼}'},8),'早安，小王');
 assert.equal(core.normalizeGreeting({name:'x'.repeat(100)}).name.length,40);
 assert.ok(core.greeting(null,20).includes('Yangkao'));
});
test('Edge theme explicitly colors every supported browser surface with readable text',()=>{
 const palette={background:'#120e20',panel:'#211a30',secondaryCard:'#291f39',card:'#38284c',search:'#1d172c',accent:'#ddafd8',text:'#f4eaf5',muted:'#cabbd3',primary:'#cfafe0'};
 const manifest=core.edgeThemeManifest({id:'custom',colors:palette,wallpaper:{type:'image',path:'D:\\private.jpg'}});
 const colors=manifest.theme.colors;
 const fields=['background_tab','background_tab_inactive','background_tab_incognito','background_tab_incognito_inactive','bookmark_text','frame','frame_inactive','frame_incognito','frame_incognito_inactive','ntp_background','ntp_header','ntp_link','ntp_text','omnibox_background','omnibox_text','tab_background_text','tab_background_text_inactive','tab_background_text_incognito','tab_background_text_incognito_inactive','tab_text','toolbar','toolbar_button_icon','toolbar_text'];
 assert.deepEqual(Object.keys(colors).sort(),fields.sort());
 assert.equal(manifest.version,'1.1.0');
 assert.deepEqual(colors.omnibox_background,[29,23,44]);
 assert.deepEqual(colors.omnibox_text,[244,234,245]);
 assert.deepEqual(colors.toolbar_button_icon,[244,234,245]);
 assert.deepEqual(colors.background_tab,[56,40,76]);
 assert.deepEqual(colors.ntp_link,[221,175,216]);
 assert.ok(!JSON.stringify(manifest).includes('private.jpg'));
 for(const [background,foreground] of [['omnibox_background','omnibox_text'],['toolbar','toolbar_text'],['ntp_background','ntp_text'],['background_tab','tab_background_text']]){
  const lum=value=>{const [r,g,b]=colors[value].map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
  const a=lum(background),b=lum(foreground);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,background+' contrast');
 }
});
test('Edge text colors recover sufficient contrast from a malformed custom palette',()=>{
 const manifest=core.edgeThemeManifest({id:'low-contrast',colors:{background:'#202020',card:'#202020',panel:'#202020',secondaryCard:'#202020',search:'#202020',text:'#282828',muted:'#282828'}});
 const c=manifest.theme.colors;
 for(const key of ['omnibox_text','toolbar_text','toolbar_button_icon','bookmark_text','ntp_text','tab_background_text'])assert.deepEqual(c[key],[255,255,255]);
});
test('default snapshots and malformed stored state cannot alter subsequent defaults',()=>{
 const first=core.defaultTheme();first.colors.background='#ffffff';first.visuals.brightness=1;
 assert.equal(core.defaultTheme().colors.background,'#131313');
 assert.deepEqual(core.normalizeState({activeId:'missing',themes:[null,false,{},{}]}).themes.map(t=>t.id),['default','custom']);
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),context={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../theme-core.js'),'utf8'),context);
 assert.equal(context.HomeThemeCore.defaultTheme().id,'default');
});
test('legacy customized shade and blur survive without inventing a local video path',()=>{
 const state=core.normalizeState(null,{shade:40,blur:18});
 assert.equal(state.activeId,'legacy');assert.equal(state.themes[1].wallpaper.type,'bing');assert.equal(state.themes[1].wallpaper.path,'');
 assert.equal(state.themes[1].visuals.brightness,.77);assert.equal(state.themes[1].visuals.secondaryBlur,7);
 assert.equal(core.normalizeState(null,{shade:55,blur:36}).themes.length,1);
});
test('invalid original wallpaper paths remain available for correction',()=>{
 const theme=core.normalizeTheme({id:'custom',wallpaper:{type:'image',path:'https://remote.invalid/private.jpg'}});
 assert.equal(theme.wallpaper.type,'image');assert.equal(theme.wallpaper.path,'https://remote.invalid/private.jpg');
 assert.equal(core.fileURL(theme.wallpaper.path),'');
});
test('greeting preserves original eleven oclock and midnight boundaries',()=>{
 const config={morning:'morning',afternoon:'afternoon',evening:'evening'};
 assert.equal(core.greeting(config,0),'morning');assert.equal(core.greeting(config,10),'morning');
 assert.equal(core.greeting(config,11),'afternoon');assert.equal(core.greeting(config,17),'afternoon');assert.equal(core.greeting(config,18),'evening');
});
test('default theme copies retain baseline sizes and dark card surfaces',()=>{
 const theme=core.defaultTheme(),v=theme.visuals;
 for(const [key,value] of Object.entries({clockSize:24,searchHeight:40,titleSize:21,cardGap:16,groupGap:31,radius:9,cardOpacity:50,searchOpacity:0,uiFont:'ZJUers Josefin'}))assert.equal(v[key],value,key);
 assert.equal(theme.colors.card,'#292929');assert.equal(theme.colors.search,'#1f1f1f');
 const palette=core.paletteFromPixels([[255,0,0,255]]);
 assert.ok(luminance(palette.card)<.05);assert.ok(luminance(palette.search)<.05);
});
