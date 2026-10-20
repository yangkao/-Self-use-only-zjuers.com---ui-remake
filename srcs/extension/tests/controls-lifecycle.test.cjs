const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// A small DOM boundary for the real controls script; no browser packages are required.
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.nodeType=1;this.children=[];this.attributes={};this.listeners=new Map();this.style={};this.hidden=false;this.disabled=false;this.text='';this.offsetWidth=210;this.offsetHeight=100;this.scrollHeight=100;this.classList={contains:n=>this.className.split(' ').includes(n),add:n=>this.classList.toggle(n,true),remove:n=>this.classList.toggle(n,false),toggle:(n,on)=>{this.className=this.className.split(' ').filter(x=>x&&x!==n).concat(on?[n]:[]).join(' ');}};}
 get className(){return this.getAttribute('class')||'';}set className(v){this.setAttribute('class',v);}
 get id(){return this.getAttribute('id')||'';}set id(v){this.setAttribute('id',v);}
 get tabIndex(){return Number(this.getAttribute('tabindex')??0);}set tabIndex(v){this.setAttribute('tabindex',v);}
 get parentElement(){return this.parentNode;}get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}get firstChild(){return this.children[0];}
 get isConnected(){return this.connected||Boolean(this.parentNode?.isConnected);}
 append(...nodes){for(const n of nodes){n.remove();this.children.push(n);n.parentNode=this;}}
 insertBefore(n,next){n.remove();const i=this.children.indexOf(next);this.children.splice(i<0?this.children.length:i,0,n);n.parentNode=this;}
 before(n){this.parentNode.insertBefore(n,this);}remove(){if(this.parentNode){const p=this.parentNode;p.children.splice(p.children.indexOf(this),1);this.parentNode=null;}}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
 addEventListener(k,fn){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(fn);}removeEventListener(k,fn){this.listeners.get(k)?.delete(fn);}
 dispatchEvent(e){e.target??=this;e.preventDefault??=()=>{};e.stopImmediatePropagation??=()=>{};this['on'+e.type]?.(e);for(const fn of [...this.listeners.get(e.type)||[]])fn(e);return true;}
 get listenerCount(){return [...this.listeners.values()].reduce((n,s)=>n+s.size,0);}
 get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}set textContent(v){this.text=v;this.children=[];}
 matches(s){if(s==='select')return this.tagName==='SELECT';if(s==='.app')return this.classList.contains('app');if(s.startsWith('link'))return this.tagName==='LINK';if(s.startsWith('button'))return this.tagName==='BUTTON'&&(!s.includes(':not')||!this.disabled);if(s.startsWith('[aria-selected'))return this.getAttribute('aria-selected')==='true'&&!this.disabled;return false;}
 querySelectorAll(s){return this.children.flatMap(n=>[...(s.split(',').some(x=>n.matches(x))?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}
 closest(s){return this.matches(s)?this:this.parentNode?.closest(s)||null;}contains(n){return n===this||this.children.some(c=>c.contains(n));}
 focus(){this.focused=true;}scrollIntoView(){}getBoundingClientRect(){return {width:150,left:20,top:50,bottom:80};}
}
function fixture(){
 const root=new Element(),app=new Element(),window=new Element(),timers=new Map(),observers=[];root.connected=true;app.className='app';root.append(app);let timerId=0;
 const document={body:app,head:new Element(),createElement:tag=>new Element(tag)};
 const context=vm.createContext({document,window,location:{protocol:'test:'},chrome:{runtime:{getURL:p=>p}},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),getComputedStyle:()=>({getPropertyValue:()=> '180'}),matchMedia:()=>({matches:false}),innerWidth:1000,innerHeight:700,Event:class{constructor(type){this.type=type;}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/controls.js'),'utf8'),context);
 const menu=()=>{const parent=new Element(),button=new Element('button'),menu=new Element(),option=new Element('button'),after=new Element();menu.id='menu';menu.className='original';menu.hidden=false;menu.setAttribute('aria-label','Original menu');menu.style.left='7px';button.setAttribute('role','button');button.setAttribute('aria-expanded','mixed');option.tabIndex=3;menu.append(option);parent.append(button,menu,after);app.append(parent);return {parent,button,menu,option,after};};
 return {root,app,window,timers,observers,api:context.HomeControls,menu};
}
test('initialize reuses a refreshable controller and destroy removes owned resources before rebuilding',()=>{
 const f=fixture(),c=f.api.initialize(f.root);assert.equal(typeof c?.destroy,'function');assert.equal(typeof c.refresh,'function');assert.equal(f.api.initialize(f.root),c);c.refresh();c.refresh();assert.equal(f.observers.filter(o=>o.active).length,1);
 c.destroy();c.destroy();c.refresh();assert.equal(f.root.listenerCount,0);assert.equal(f.window.listenerCount,0);assert.equal(f.observers.some(o=>o.active),false);assert.equal(f.timers.size,0);assert.equal(f.root.querySelector('link'),null);
 const rebuilt=f.api.initialize(f.root);assert.notEqual(rebuilt,c);rebuilt.destroy();
});
test('bindMenu deduplicates handlers and local close never closes another menu',()=>{
 const f=fixture(),a=f.menu(),b=f.menu();let selected=0;const first=f.api.bindMenu(f.root,{...a,onSelect:()=>selected++});const again=f.api.bindMenu(f.root,{...a,onSelect:()=>selected++});assert.equal(again,first);a.button.dispatchEvent({type:'click'});assert.equal(a.button.getAttribute('aria-expanded'),'true');
 a.menu.dispatchEvent({type:'click',target:a.option});assert.equal(selected,1);const other=f.api.bindMenu(f.root,{...b,onSelect:()=>{}});other.open();first.close();assert.equal(b.button.getAttribute('aria-expanded'),'true');f.api.initialize(f.root).destroy();
});
for(const closing of [false,true])for(const whole of [false,true])test(`${whole?'controller':'local'} destroy restores existing menu DOM and attributes while ${closing?'closing':'open'}`,()=>{
 const f=fixture(),m=f.menu(),local=f.api.bindMenu(f.root,{...m,onSelect:()=>{}}),owner=whole?f.api.initialize(f.root):local;local.open();if(closing)local.close();owner.destroy();owner.destroy();
 assert.equal(m.menu.parentNode,m.parent);assert.equal(m.menu.nextSibling,m.after);assert.equal(m.menu.className,'original');assert.equal(m.menu.hidden,false);assert.equal(m.menu.getAttribute('aria-label'),'Original menu');assert.equal(m.menu.getAttribute('role'),null);assert.equal(m.menu.style.left,'7px');assert.equal(m.button.getAttribute('role'),'button');assert.equal(m.button.getAttribute('aria-expanded'),'mixed');assert.equal(m.option.tabIndex,3);assert.equal(m.option.getAttribute('role'),null);assert.equal(m.button.listenerCount+m.menu.listenerCount,0);assert.equal(f.timers.size,0);f.api.initialize(f.root).destroy();
});
test('refresh discovers added selects once and destroy preserves preexisting stylesheet and absent attributes',()=>{
 const f=fixture(),style=new Element('link');f.root.append(style);const c=f.api.initialize(f.root),select=new Element('select');select.options=[];select.selectedOptions=[];f.app.append(select);c.refresh();c.refresh();assert.equal(f.root.querySelectorAll('button').length,1);c.destroy();assert.equal(select.parentNode,f.app);assert.equal(select.getAttribute('class'),null);assert.equal(select.getAttribute('tabindex'),null);assert.equal(f.root.querySelector('link'),style);
});
test('destroying one binding leaves another open and permits binding the original button again',()=>{
 const f=fixture(),a=f.menu(),b=f.menu(),local=f.api.bindMenu(f.root,{...a,onSelect:()=>{}}),other=f.api.bindMenu(f.root,{...b,onSelect:()=>{}});other.open();local.destroy();local.open();local.close();assert.equal(b.button.getAttribute('aria-expanded'),'true');const rebuilt=f.api.bindMenu(f.root,{...a,onSelect:()=>{}});assert.notEqual(rebuilt,local);rebuilt.open();assert.equal(a.button.getAttribute('aria-expanded'),'true');f.api.initialize(f.root).destroy();assert.equal(f.timers.size,0);
});
test('pagehide releases open menus and stale observer callbacks cannot rebuild controls',()=>{
 const f=fixture(),m=f.menu();f.api.bindMenu(f.root,{...m,onSelect:()=>{}}).open();f.window.dispatchEvent({type:'pagehide'});const select=new Element('select');select.options=[];select.selectedOptions=[];f.app.append(select);f.observers[0].fn([{type:'childList',target:f.app,removedNodes:[],addedNodes:[select]}]);assert.equal(select.parentNode,f.app);assert.equal(f.root.listenerCount+f.window.listenerCount,0);assert.equal(f.timers.size,0);assert.equal(m.menu.parentNode,m.parent);assert.equal(m.menu.className,'original');
});
test('persisted pagehide retains business menu bindings for BFCache restore and a later departure cleans up',()=>{
 const f=fixture(),m=f.menu();let selected=0;const local=f.api.bindMenu(f.root,{...m,onSelect:()=>selected++}),controller=f.api.initialize(f.root);local.open();f.window.dispatchEvent({type:'pagehide',persisted:true});assert.equal(m.button.getAttribute('aria-expanded'),'false');assert.equal(f.api.initialize(f.root),controller);
 m.button.dispatchEvent({type:'click'});assert.equal(m.button.getAttribute('aria-expanded'),'true');m.menu.dispatchEvent({type:'click',target:m.option});assert.equal(selected,1);f.window.dispatchEvent({type:'pagehide',persisted:false});assert.equal(f.root.listenerCount+f.window.listenerCount,0);assert.equal(m.button.listenerCount+m.menu.listenerCount,0);assert.equal(f.timers.size,0);assert.equal(f.observers.some(o=>o.active),false);assert.equal(m.menu.parentNode,m.parent);assert.equal(m.menu.className,'original');
});
test('destroy unwraps selects, cancels dynamic closing menus and restores native focus attributes',()=>{
 const f=fixture(),select=new Element('select'),option=new Element('option');select.tabIndex=4;select.className='native-original';option.textContent='One';select.options=[option];select.selectedOptions=[option];select.selectedIndex=0;select.append(option);f.app.append(select);const c=f.api.initialize(f.root),button=f.root.querySelector('button');button.dispatchEvent({type:'click'});f.root.dispatchEvent({type:'keydown',key:'Escape'});assert.equal(f.timers.size,1);c.destroy();assert.equal(select.parentNode,f.app);assert.equal(select.tabIndex,4);assert.equal(select.className,'native-original');assert.equal(select.listenerCount,0);assert.equal(f.root.querySelector('button'),null);assert.equal(f.timers.size,0);f.api.initialize(f.root).destroy();
});
