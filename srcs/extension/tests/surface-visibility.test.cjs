const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../ui/glass-surface.js'),'utf8');
class Element{constructor(parent=null){this.parentElement=parent;this.inert=false;this.css={display:'block',visibility:'visible',opacity:'1',overflowX:'visible',overflowY:'visible'};this.rect={left:0,top:0,right:600,bottom:400,width:600,height:400};}}
const surfaceRect=new Function('Element','innerWidth','innerHeight',code.slice(code.indexOf(' function surfaceRect('),code.indexOf(' function create('))+';return surfaceRect;')(Element,1000,800);
const measure=e=>({css:e.css,rect:e.rect});
test('settings interaction lock retains visible background glass',()=>{
 const background=new Element(),card=new Element(background),before=surfaceRect(card,measure);
 background.inert=true;assert.deepEqual(surfaceRect(card,measure),before);
 background.inert=false;assert.deepEqual(surfaceRect(card,measure),before);
});
test('real visual hiding and collapsed clipping still remove glass',()=>{
 const parent=new Element(),card=new Element(parent);
 parent.css.opacity='0';assert.equal(surfaceRect(card,measure),null);parent.css.opacity='1';
 parent.css.visibility='hidden';assert.equal(surfaceRect(card,measure),null);parent.css.visibility='visible';
 parent.css.overflowY='hidden';parent.rect.bottom=0;assert.equal(surfaceRect(card,measure),null);
});
