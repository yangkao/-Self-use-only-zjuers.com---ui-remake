const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('legacy dashboard heading decoration leaves independently initialized CC98 cards alone',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../ui/script.js'),'utf8');const start=source.indexOf("root.querySelectorAll('.info-card"),end=source.indexOf('\nlet clockTimer;',start);assert(start>=0&&end>start);
 const headings=[],cards=['weather','schedule','exam','assignments','cc98'].map(kind=>{const heading=kind==='cc98'?null:{dataset:{},insertAdjacentHTML(position,markup){assert.equal(position,'afterbegin');headings.push({kind,markup});}};return {kind,classList:{contains:name=>name===kind+'-card'},querySelector:()=>heading,heading};});
 const root={querySelectorAll(selector){return selector==='.info-card'?cards:cards.filter(c=>selector.includes('.'+c.kind+'-card'));}};
 assert.doesNotThrow(()=>vm.runInNewContext(source.slice(start,end),{root,iconSvg:key=>'<svg data-kind="'+key+'"></svg>'}));
 assert.equal(headings.length,4);assert.deepEqual(headings.map(h=>h.kind),['weather','schedule','exam','assignments']);assert.equal(cards[4].heading,null);assert.equal(cards[1].heading.dataset.sourceLink,'schedule');
});
