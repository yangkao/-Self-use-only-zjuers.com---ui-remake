const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../theme-core.js');
function frame(regions){return regions.flatMap(([n,r,g=r,b=r])=>Array.from({length:n},()=>[r,g,b,255]).flat());}
const neutral=hex=>hex.slice(1,3)===hex.slice(3,5)&&hex.slice(3,5)===hex.slice(5,7);
test('neutral wallpapers expose dark middle and bright representatives from their actual distribution',()=>{
 const frames=[frame([[400,15],[350,110],[250,230]])],c=T.paletteCandidates(frames);
 assert.ok(c.filter(x=>x.kind==='neutral').length>=3);
 assert.ok(c.some(x=>parseInt(x.color.slice(1,3),16)<30));assert.ok(c.some(x=>parseInt(x.color.slice(1,3),16)>220));
 assert.ok(c.every(x=>neutral(x.color)));
});
test('different neutral distributions yield different usable theme layers',()=>{
 const dark=T.paletteFromPixels([frame([[800,15],[200,80]])],{}),light=T.paletteFromPixels([frame([[200,160],[800,240]])],{});
 assert.notEqual(dark.background,light.background);assert.notEqual(dark.primary,light.primary);assert.notEqual(dark.card,light.card);
 for(const p of [dark,light]){assert.equal(Object.keys(p).length,13);assert.ok(Object.values(p).every(neutral));assert.notEqual(p.background,p.card);assert.notEqual(p.primary,p.text);}
});
test('a small strong accent can survive below the old half-percent area gate',()=>{
 const frames=[frame([[19920,170],[80,225,35,55]])],c=T.paletteCandidates(frames);
 assert.ok(c.some(x=>x.kind==='chromatic'&&x.color==='#e12337'));assert.ok(c.some(x=>x.kind==='neutral'));
});
test('adjacent hue bins merge across red wraparound rather than splitting evidence',()=>{
 const frames=[frame([[100,220,30,34],[100,220,34,30],[1800,160]])],colors=T.paletteCandidates(frames).filter(x=>x.kind==='chromatic');
 assert.equal(colors.length,1);assert.ok(colors[0].coverage>.09);
});
test('large weak casts cannot become saturated accents, including on chromatic backgrounds',()=>{
 const frames=[frame([[3000,100,110,113],[2000,220,40,50]])],p=T.paletteFromPixels(frames,{}),c=T.paletteCandidates(frames);
 assert.ok(c.some(x=>x.kind==='neutral'));assert.ok(c.some(x=>x.kind==='chromatic'));
 assert.ok(parseInt(p.primary.slice(1,3),16)>parseInt(p.primary.slice(3,5),16));
 const muted=T.paletteFromPixels([frame([[2000,110,135,130]])],{});
 const channels=muted.primary.slice(1).match(/../g).map(x=>parseInt(x,16));assert.ok(Math.max(...channels)-Math.min(...channels)<60);
 assert.ok(T.paletteCandidates([frame([[2000,110,135,130]])]).some(c=>c.kind==='chromatic'));
 assert.ok(!neutral(muted.primary),'a broad muted color remains softly colored instead of being forced to gray');
});
test('temporal support raises confidence while a true strong static accent remains selectable',()=>{
 const repeated=[frame([[1000,180],[60,230,30,50]]),frame([[1000,180],[60,230,30,50]])];
 const fleeting=[repeated[0],frame([[1060,180]])];
 const a=T.paletteCandidates(repeated).find(x=>x.kind==='chromatic'),b=T.paletteCandidates(fleeting).find(x=>x.kind==='chromatic');
 assert.ok(a&&b);assert.ok(a.confidence>b.confidence);
});
test('manual neutral choices change derived layers and explicit locks still win',()=>{
 const frames=[frame([[300,20],[400,110],[300,230]])];
 const a=T.paletteFromPixels(frames,{primary:'#141414'}),b=T.paletteFromPixels(frames,{primary:'#e6e6e6',lockedColors:{text:'#abcdef'}});
 assert.notEqual(a.primary,b.primary);assert.equal(b.text,'#abcdef');
});
test('default derived layers keep normal text readable across neutral distributions',()=>{
 const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 for(const value of [0,20,80,128,200,255]){const p=T.paletteFromPixels([frame([[200,value],[100,255-value]])],{});for(const bg of ['background','card','panel','secondaryCard']){assert.ok(contrast(p.text,p[bg])>=4.5);assert.ok(contrast(p.muted,p[bg])>=4.5);}}
});
