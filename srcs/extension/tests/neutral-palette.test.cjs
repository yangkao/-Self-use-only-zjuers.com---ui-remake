const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../theme-core.js');
test('valid grayscale imagery generates a complete neutral palette, including black and white frames',()=>{
 for(const pixels of [[0,0,0,255],[255,255,255,255],[30,30,30,255,200,200,200,255],[100,104,101,255]]){
  const result=core.paletteFromPixels([pixels]);assert.deepEqual(Object.keys(result).sort(),Object.keys(core.defaultTheme().colors).sort());assert.equal(result.primary,'#b8b8b8');
  for(const value of Object.values(result)){assert.match(value,/^#[0-9a-f]{6}$/);assert.equal(value.slice(1,3),value.slice(3,5));assert.equal(value.slice(3,5),value.slice(5,7));}
 }
});
test('empty, transparent and invalid pixels keep the no-data fallback',()=>{
 for(const frames of [[],[[255,255,255,0]],[[NaN,0,0,255]],[[0,0,0,NaN]]])assert.deepEqual(core.paletteFromPixels(frames),core.defaultTheme().colors);
});
test('chromatic wallpaper still receives hue-based colors',()=>{const color=core.paletteFromPixels([[255,0,0,255]]).primary;assert.notEqual(color.slice(1,3),color.slice(3,5));});
