const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 class Element{
  constructor(){this.children=[];this.dataset={};this.className='';this.value='';this.writes=0;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  set textContent(v){this.value=v;this.writes++;}get textContent(){return this.children.length?this.children.map(n=>n.textContent).join(''):this.value;}
 }
 const clock=new Element(),source=fs.readFileSync(require('node:path').join(__dirname,'../ui/script.js'),'utf8');
 const start=source.indexOf('function renderClock('),end=source.indexOf('function updateClock()',start);
 assert(start>=0,'clock renderer must be available');
 const render=vm.runInNewContext(source.slice(start,end)+';renderClock',{root:{getElementById:()=>clock},document:{createElement:()=>new Element()}});
 return {clock,render};
}
test('clock keeps natural two-digit fields and separator nodes across rollover',()=>{
 const {clock,render}=setup();render({hour:'09',minute:'59',second:'59'},true);
 const fields=[...clock.children],digits=fields.filter(x=>x.className==='clock-field');
 assert.equal(clock.textContent,'09:59:59');assert.equal(digits.length,3);assert(digits.every(x=>x.children.length===0));
 render({hour:'10',minute:'00',second:'00'},true);assert.equal(clock.textContent,'10:00:00');assert.deepEqual(clock.children,fields);
 const writes=digits.map(n=>n.writes);render({hour:'10',minute:'00',second:'00'},true);assert.deepEqual(digits.map(n=>n.writes),writes);
 render({hour:'10',minute:'00',second:'01'},true);assert.equal(digits.at(-1).writes,writes.at(-1)+1);assert.equal(digits.at(-2).writes,writes.at(-2));
});
test('minute/second mode changes build the correct number of fixed fields',()=>{
 const {clock,render}=setup(),v={hour:'08',minute:'01',second:'02'};render(v,false);assert.equal(clock.textContent,'08:01');assert.equal(clock.children.length,3);
 render(v,true);assert.equal(clock.textContent,'08:01:02');assert.equal(clock.children.length,5);
 render(v,false);assert.equal(clock.textContent,'08:01');assert.equal(clock.children.length,3);
});
