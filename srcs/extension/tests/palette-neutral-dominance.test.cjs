const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const T=require('../theme-core.js');
function pixels(grayCount,colors){const data=[];for(let i=0;i<grayCount;i++)data.push(180,180,180,255);for(const color of colors)data.push(...color,255);return [data];}
test('tiny weak chroma does not turn a visually monochrome video into a colored theme',()=>{
 const frames=pixels(9990,Array.from({length:10},()=>[90,110,113]));
 assert.ok(T.paletteCandidates(frames).every(c=>c.kind==='neutral'));
 const palette=T.paletteFromPixels(frames,{});for(const color of Object.values(palette))assert.equal(color.slice(1,3),color.slice(3,5));
});
test('representative colored regions remain available while isolated noise is excluded',()=>{
 const frames=pixels(9800,[...Array.from({length:195},()=>[200,90,130]),...Array.from({length:5},()=>[0,255,255])]);
 const candidates=T.paletteCandidates(frames).filter(c=>c.kind==='chromatic');assert.equal(candidates.length,1);assert.equal(candidates[0].color,'#c85a82');
 assert.notEqual(T.paletteFromPixels(frames,{}).primary,'#b8b8b8');
});
test('explicit primary remains authoritative even when the media is almost monochrome',()=>{
 const frames=pixels(10000,[]);assert.notEqual(T.paletteFromPixels(frames,{primary:'#ff0000'}).primary,'#b8b8b8');
 assert.equal(T.paletteFromPixels(frames,{lockedColors:{accent:'#abcdef'}}).accent,'#abcdef');
});
test('local Bad Apple evidence uses a neutral palette without changing persisted colors',{skip:!fs.existsSync(require('node:path').resolve('temp/update3-palette-investigation/frame-0.rgba'))},()=>{
 const dir=require('node:path').resolve('temp/update3-palette-investigation');
 const frames=Array.from({length:8},(_,i)=>fs.readFileSync(dir+'/frame-'+i+'.rgba'));
 assert.ok(T.paletteCandidates(frames).every(c=>c.kind==='neutral'));const colors=Object.values(T.paletteFromPixels(frames,{}));assert.ok(colors.every(c=>c.slice(1,3)===c.slice(3,5)&&c.slice(3,5)===c.slice(5,7)));
});
