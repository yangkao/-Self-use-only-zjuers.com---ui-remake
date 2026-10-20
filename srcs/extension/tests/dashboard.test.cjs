const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

// Minimal DOM implements the operations used by the dashboard, not its rendering logic.
class Node {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.className='';this.text='';this.scrollTop=0;this.classList={add:(...names)=>{this.className=[...new Set(this.className.split(' ').concat(names))].join(' ');},contains:name=>this.className.split(' ').includes(name),toggle:(name,on)=>{this.className=this.className.split(' ').filter(x=>x!==name).concat(on?[name]:[]).join(' ');}};}
 append(...nodes){for(const node of nodes){const n=typeof node==='string'?Object.assign(new Node('#text'),{text:node}):node;n.parent=this;this.children.push(n);}}
 prepend(...nodes){for(const n of nodes.reverse()){n.parent=this;this.children.unshift(n);}}
 replaceChildren(...nodes){this.children=[];this.text='';this.append(...nodes);}
 set textContent(value){this.children=[];this.text=String(value);}
 get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}
 get childNodes(){return this.children;}get firstChild(){return this.children[0];}get lastElementChild(){return this.children.at(-1);}
 setAttribute(k,v){this.attributes[k]=v;}addEventListener(){}dispatchEvent(){}focus(){}
 after(n){const a=this.parent.children;n.parent=this.parent;a.splice(a.indexOf(this)+1,0,n);}
 matches(selector){if(selector.startsWith('[data-')){const key=selector.slice(6,-1).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return key in this.dataset;}if(selector.startsWith('.'))return selector.slice(1).split('.').every(x=>this.classList.contains(x));return this.tagName===selector;}
 querySelectorAll(selector){const result=[];const visit=node=>{for(const child of node.children){if(child.matches(selector))result.push(child);visit(child);}};visit(this);return result;}
 querySelector(selector){const parts=selector.split(' ');if(parts.length>1){for(const node of this.querySelectorAll(parts[0])){const found=node.querySelector(parts.slice(1).join(' '));if(found)return found;}return null;}return this.querySelectorAll(selector)[0]||null;}
}
test('complete dashboard initializes calendar, real cards and live settings together',async()=>{
 const make=(tag,cls)=>Object.assign(new Node(tag),{className:cls||''});
 const events={};const view=new Node();view.addEventListener=(name,fn)=>(events[name]??=[]).push(fn);const app=make('div','app'),settings=make('div');view.append(app,settings);
 for(const name of ['weather','schedule','exam','assignments']){const card=make('article',`${name}-card`);card.append(make('span','eyebrow'));app.append(card);}
 const heading=make('div','secondary-heading');heading.append(make('h1'));app.append(heading);
 const tab=make('button','settings-tab active');tab.dataset.tab='data';view.append(tab);
 view.getElementById=id=>id==='settingsBody'?settings:null;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
 const state={config:{weatherConfigured:true,campusConfigured:true,location:{name:'杭州'}},entries:{now:{status:'ready',data:{temperature:19,text:'雾',humidity:80,visibility:2,attributions:['https://example.org/weather']}},rain:{status:'ready',data:{summary:'间歇性降雨还将持续110分钟'}},courses:{status:'ready',data:{items:[{title:'真实课程',date:today,period:'第1节',place:'紫金港东一'}]}},exams:{status:'ready',data:{items:[{title:'真实考试',date:'2099-10-10'}]}},assignments:{status:'ready',data:{items:[{title:'真实作业'}]}},quote:{status:'ready',data:{text:'实际名句',author:'作者',from:'作品'}}}};
 const context=vm.createContext({CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},module:{exports:{}},console,URL,Intl,Date,Promise,document:{hidden:false,createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag),addEventListener(){}},window:{addEventListener(){}},setTimeout:()=>1,clearTimeout(){},chrome:{runtime:{getManifest:()=>({version:'1.0.0'}),getURL:p=>'chrome-extension://test/'+p,sendMessage:async()=>({ok:true,value:state})}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/icons.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/external.js'),'utf8'),context);
 context.module.exports.initialize(view);await new Promise(setImmediate);
 assert.doesNotMatch(view.querySelector('.weather-card').textContent,/19°/,'hidden secondary defers content construction');
 app.classList.add('is-secondary');for(const fn of events['home-secondary-open'])fn();await new Promise(setImmediate);
 const first=view.querySelector('.weather-card').querySelector('.live-content').firstChild;
 for(const fn of events['home-secondary-open'])fn();await new Promise(setImmediate);
 assert.equal(view.querySelector('.weather-card').querySelector('.live-content').firstChild,first,'same data preserves existing content nodes');
 state.entries.assignments.data.items.push({title:'新增作业'});
 for(const fn of events['home-secondary-open'])fn();await new Promise(setImmediate);
 assert.equal(view.querySelector('.weather-card').querySelector('.live-content').firstChild,first,'assignment changes must not rebuild weather');
 assert.match(view.querySelector('.assignments-card').textContent,/新增作业/);
 assert.ok(view.querySelector('.calendar-toggle'));assert.ok(view.querySelector('.calendar-panel'));
 assert.match(view.querySelector('.weather-card').textContent,/19°/);
 assert.match(view.querySelector('.weather-card').textContent,/湿度 80%/);
 assert.match(view.querySelector('.assignments-card').textContent,/真实作业/);
 assert.match(settings.textContent,/正式版/);assert.doesNotMatch(settings.textContent,/MVP|示例|演示/);
 assert.match(view.querySelector('.quote-meta').textContent,/作者 · 《作品》/);
 assert.equal(view.querySelector('.quote-meta').parent===view.querySelector('h1'),false);
 assert.equal(view.querySelector('.quote-meta').parent,view.querySelector('h1').parent);
 assert.ok(view.querySelector('.schedule-card').querySelector('time'));
 assert.match(view.querySelector('.weather-bottom').textContent,/间歇降雨约110分钟/);
 assert.doesNotMatch(view.querySelector('.weather-card').textContent,/来源说明/);
 const examButton=view.querySelector('.exam-card').querySelector('button');examButton.onclick();
 assert.match(view.querySelector('.exam-card').textContent,/真实考试/);
 assert.ok(view.querySelector('.exam-card').querySelector('.date-block'));
});
