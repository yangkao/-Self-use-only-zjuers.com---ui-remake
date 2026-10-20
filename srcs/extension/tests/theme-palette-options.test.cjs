const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../theme-core.js'),P=require('../portable-core.js');
const red=[[255,0,0,255,255,0,0,255,0,0,255,255]];
test('new drafts inherit the current default snapshot without sharing objects or retaining default identity',()=>{
 const source=T.defaultTheme();source.colors.background='#123456';source.colors.accent='#abcdef';source.visuals.radius=17;
 const draft=T.createThemeDraft(source,'new-theme','我的主题');
 assert.equal(draft.id,'new-theme');assert.equal(draft.name,'我的主题');assert.equal(draft.muted,true);
 assert.deepEqual(draft.wallpaper,{type:'solid',path:'',color:'#123456'});assert.equal(draft.colors.accent,'#abcdef');assert.equal(draft.visuals.radius,17);
 draft.colors.accent='#000000';assert.equal(source.colors.accent,'#abcdef');
 assert.notEqual(T.createThemeDraft(source,'default').id,'default');
 assert.equal(T.createThemeDraft(source,'unnamed').name,'新主题');
});
test('range end zero retains the media-end sentinel after normalization and portable roundtrip',()=>{
 const settings=T.normalizePaletteSettings({mode:'range',start:7,end:0});
 assert.equal(settings.start,7);assert.equal(settings.end,0);
 const file=P.exportConfig({update1Themes:{themes:[{id:'range',paletteSettings:settings}]}});
 assert.equal(P.validate(file).settings.themes.themes[1].paletteSettings.end,0);
});
test('solid themes preserve independent background and palette settings while invalid fields normalize',()=>{
 const theme=T.normalizeTheme({id:'solid',wallpaper:{type:'solid',color:'#AABBCC',path:'private',reference:'private'},colors:{background:'#112233'},paletteSettings:{mode:'range',frameCount:16,start:7,end:3,time:5,region:'full',saturation:2,background:.1,accent:.5,primary:'#ABCDEF'},lockedColors:{text:'#FEDCBA',unknown:'#000000',card:'invalid'}});
 assert.deepEqual(theme.wallpaper,{type:'solid',path:'',color:'#aabbcc'});assert.equal(theme.colors.background,'#112233');
 assert.deepEqual(theme.lockedColors,{text:'#fedcba'});assert.equal(theme.paletteSettings.end,7);assert.equal(theme.paletteSettings.primary,'#abcdef');
 const invalid=T.normalizePaletteSettings({mode:'evil',frameCount:9,start:-4,time:Infinity,region:'evil',saturation:NaN,background:Infinity,accent:-3,primary:'red'});
 assert.deepEqual(invalid,{mode:'uniform',frameCount:8,start:0,end:0,time:0,region:'crop',saturation:1,background:0,accent:0,primary:''});
});
test('candidate colors retain separated hues and manual primary plus adjustments produce preview colors',()=>{
 const candidates=T.paletteCandidates(red);assert.equal(candidates[0].color,'#ff0000');assert.ok(candidates.some(c=>c.color==='#0000ff'));
 assert.deepEqual(T.paletteFromPixels(red,{}),T.paletteFromPixels(red));
 assert.notEqual(T.paletteFromPixels(red,{primary:'#0000ff'}).accent,T.paletteFromPixels(red).accent);
 const adjusted=T.paletteFromPixels(red,{saturation:0,background:.1,accent:.5});assert.equal(adjusted.primary.slice(1,3),adjusted.primary.slice(3,5));assert.notEqual(adjusted.background,T.paletteFromPixels(red).background);
 const locked=T.paletteFromPixels(red,{primary:'#0000ff',lockedColors:{accent:'#123456',text:'#abcdef'}});assert.equal(locked.accent,'#123456');assert.equal(locked.text,'#abcdef');
 assert.notEqual(T.paletteFromSolid('#00ff00').accent,T.paletteFromSolid('#ff0000').accent);
 assert.equal(T.paletteFromSolid('#000000').primary,'#b8b8b8');assert.deepEqual(T.paletteCandidates([]),[]);
});
test('portable old exports gain compatible defaults and new nonsecret theme parameters roundtrip',()=>{
 const file=P.exportConfig({update1Themes:{activeId:'solid',themes:[{id:'solid',wallpaper:{type:'solid',color:'#cc8800'},paletteSettings:{mode:'frame',time:12,frameCount:4},lockedColors:{text:'#abcdef'}}]}});
 const theme=P.validate(file).settings.themes.themes[1];assert.equal(theme.wallpaper.color,'#cc8800');assert.equal(theme.paletteSettings.time,12);assert.equal(theme.lockedColors.text,'#abcdef');
 for(const t of file.settings.themes.themes){delete t.paletteSettings;delete t.lockedColors;}
 assert.doesNotThrow(()=>P.validate(file));
 file.settings.themes.themes[1].paletteSettings={mode:'evil'};assert.throws(()=>P.validate(file));
});
test('generated preview colors survive reopening independently of manual edits and locks',()=>{
 const t=T.normalizeTheme({id:'custom',colors:{accent:'#123456'},generatedColors:{accent:'#abcdef',text:'#fedcba',evil:'#000000',card:'bad'},lockedColors:{accent:'#123456'}});
 assert.deepEqual(t.generatedColors,{accent:'#abcdef',text:'#fedcba'});assert.equal(t.colors.accent,'#123456');
 const file=P.exportConfig({update1Themes:{themes:[t]}});assert.deepEqual(P.validate(file).settings.themes.themes[1].generatedColors,{accent:'#abcdef',text:'#fedcba'});
 assert.equal(Object.hasOwn(T.normalizeTheme({id:'old'}),'generatedColors'),false);
});
test('portable builtin migration still accepts old files and rejects malformed added settings',()=>{
 const file=P.exportConfig({});const theme=file.settings.themes.themes[0];theme.wallpaper.type='builtin';delete theme.paletteSettings;delete theme.lockedColors;
 assert.doesNotThrow(()=>P.validate(file));
 theme.paletteSettings={mode:'bad'};assert.throws(()=>P.validate(file));
});
