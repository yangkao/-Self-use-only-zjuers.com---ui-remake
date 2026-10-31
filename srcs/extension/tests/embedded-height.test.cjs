const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('protected settings report the complete padded content once, without a second offset',()=>{
 const messages=[],observers=[],classes=new Set(),main={getBoundingClientRect:()=>({height:448.1})};
 const context={parent:{postMessage:(data,origin)=>messages.push({data,origin})},window:{addEventListener(){}},document:{documentElement:{classList:{add:name=>classes.add(name)}},addEventListener(){},querySelector:()=>main,fonts:{ready:{then:fn=>fn()}}},ResizeObserver:class{constructor(fn){observers.push(fn);}observe(node){assert.equal(node,main);}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../protected-frame.js'),'utf8'),context);
 assert(classes.has('embedded'));assert.equal(messages[0].data.height,449);assert.equal(messages[0].origin,'https://zjuers.com');
 observers[0]();assert.equal(messages[1].data.height,449);
});

for(const kind of ['account','data','editor'])test(`demo ${kind} height includes both viewport gutters`,()=>{
 const demoFile=['../../demo/frame.js','../../../demo/frame.js'].map(rel=>path.join(__dirname,rel)).find(file=>fs.existsSync(file));
 assert(demoFile,'demo source must be present in development and public source layouts');
 const source=fs.readFileSync(demoFile,'utf8'),start=source.indexOf(' const sendHeight='),end=source.indexOf(' function colors',start),messages=[];
 const context={kind,post:data=>messages.push(data),document:{documentElement:{},body:{getBoundingClientRect:()=>({height:400.2})}},getComputedStyle:()=>({paddingTop:'24px',paddingBottom:'24px'})};
 vm.runInNewContext(source.slice(start,end)+';sendHeight();',context);
 assert.equal(messages[0].height,449);assert.equal(messages[0].type,kind==='editor'?'EDITOR_HEIGHT':'SETTINGS_HEIGHT');
});
