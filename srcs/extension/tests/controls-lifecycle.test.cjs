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
 addEventListener(k,fn,options){const key=(options===true||options?.capture)?k+':capture':k;if(!this.listeners.has(key))this.listeners.set(key,new Set());this.listeners.get(key).add(fn);}removeEventListener(k,fn,options){this.listeners.get((options===true||options?.capture)?k+':capture':k)?.delete(fn);}
 dispatchEvent(e){e.target??=this;e.preventDefault??=()=>{};let stopped=false;const stop=e.stopImmediatePropagation;e.stopImmediatePropagation=()=>{stopped=true;stop?.();};for(const fn of [...this.listeners.get(e.type+':capture')||[]]){fn(e);if(stopped)return true;}this['on'+e.type]?.(e);if(!stopped)for(const fn of [...this.listeners.get(e.type)||[]]){fn(e);if(stopped)break;}return true;}
 get listenerCount(){return [...this.listeners.values()].reduce((n,s)=>n+s.size,0);}
 get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}set textContent(v){this.text=v;this.children=[];}
 matches(s){if(s==='select')return this.tagName==='SELECT';if(s==='input[type=number]')return this.tagName==='INPUT'&&this.type==='number';if(s===':disabled')return this.disabled||Boolean(this.parentNode?.matches(':disabled'));if(s.startsWith('.'))return this.classList.contains(s.slice(1));if(s.startsWith('link'))return this.tagName==='LINK';if(s.startsWith('button'))return this.tagName==='BUTTON'&&(!s.includes(':not')||!this.disabled);if(s.startsWith('[aria-selected'))return this.getAttribute('aria-selected')==='true'&&!this.disabled;return false;}
 querySelectorAll(s){return this.children.flatMap(n=>[...(s.split(',').some(x=>n.matches(x))?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}
 closest(s){return this.matches(s)?this:this.parentNode?.closest(s)||null;}contains(n){return n===this||this.children.some(c=>c.contains(n));}
 focus(){this.focused=true;}scrollIntoView(){}getBoundingClientRect(){return {width:150,left:20,top:50,bottom:80};}
}
function fixture(){
 const root=new Element(),app=new Element(),window=new Element(),timers=new Map(),observers=[];root.connected=true;app.className='app';root.append(app);let timerId=0;
 const document={body:app,head:new Element(),createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag)};
 const context=vm.createContext({document,window,location:{protocol:'test:'},chrome:{runtime:{getURL:p=>p}},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}},requestAnimationFrame:fn=>{timers.set(++timerId,fn);return timerId;},cancelAnimationFrame:id=>timers.delete(id),setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),getComputedStyle:()=>({getPropertyValue:()=> '180'}),matchMedia:()=>({matches:false}),innerWidth:1000,innerHeight:700,Event:class{constructor(type){this.type=type;}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/controls.js'),'utf8'),context);
 const menu=()=>{const parent=new Element(),button=new Element('button'),menu=new Element(),option=new Element('button'),after=new Element();menu.id='menu';menu.className='original';menu.hidden=false;menu.setAttribute('aria-label','Original menu');menu.style.left='7px';button.setAttribute('role','button');button.setAttribute('aria-expanded','mixed');option.tabIndex=3;menu.append(option);parent.append(button,menu,after);app.append(parent);return {parent,button,menu,option,after};};
 return {root,app,window,timers,observers,api:context.HomeControls,menu};
}
test('expanded content releases its ink clip only after the original animation completes',async()=>{
 const f=fixture(),api=f.api.initialize(f.root),slot=new Element(),clip=new Element();f.app.append(slot);slot.append(clip);
 let finish;slot.getAnimations=()=>[{finished:new Promise(r=>finish=r)}];
 api.expansionInk(slot,clip,true);const jobs=[...f.timers.values()];f.timers.clear();jobs.forEach(fn=>fn());
 assert.equal(clip.classList.contains('home-ink-unclipped'),false);finish();await new Promise(setImmediate);
 assert.equal(clip.classList.contains('home-ink-unclipped'),true);api.expansionInk(slot,clip,false);
 assert.equal(clip.classList.contains('home-ink-unclipped'),false);api.destroy();
});
test('closing or destroying before expansion finishes cannot release stale content',async()=>{
 const f=fixture(),api=f.api.initialize(f.root),slot=new Element(),clip=new Element();f.app.append(slot);slot.append(clip);
 let finish;slot.getAnimations=()=>[{finished:new Promise(r=>finish=r)}];
 api.expansionInk(slot,clip,true);const jobs=[...f.timers.values()];f.timers.clear();jobs.forEach(fn=>fn());
 api.expansionInk(slot,clip,false);finish();await new Promise(setImmediate);
 assert.equal(clip.classList.contains('home-ink-unclipped'),false);
 api.expansionInk(slot,clip,true);assert.equal(f.timers.size,1);api.destroy();assert.equal(f.timers.size,0);
});
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

function numberInput(f,options={}){const input=new Element('input');Object.assign(input,{type:'number',value:'5',step:'1',min:'1',max:'20',readOnly:false},options);input.id='limit';input.className='compact-number';input.setAttribute('aria-label','最大条目数');f.app.append(input);return input;}

test('number enhancement preserves the original editable input and delegates stepping with one input/change pair',()=>{
 const f=fixture(),input=numberInput(f),events=[],calls=[];input.addEventListener('input',()=>events.push('input'));input.onchange=()=>events.push('change');input.stepUp=()=>{calls.push('up');input.value='6';};input.stepDown=()=>{calls.push('down');input.value='5';};
 const c=f.api.initialize(f.root),wrap=input.parentNode,buttons=wrap.querySelectorAll('button');assert.equal(wrap.className,'ui-number');assert.equal(wrap.children[0],input);assert.equal(input.id,'limit');assert.equal(input.className,'compact-number');assert.equal(input.type,'number');assert.equal(input.step,'1');assert.equal(buttons.length,2);assert.equal(buttons[0].type,'button');
 assert.equal(buttons[0].children[0].tagName,'SVG');assert.match(buttons[0].getAttribute('aria-label'),/增加/);buttons[0].dispatchEvent({type:'click'});assert.equal(input.value,'6');assert.deepEqual(calls,['up']);assert.deepEqual(events,['input','change']);buttons[1].dispatchEvent({type:'click'});assert.equal(input.value,'5');assert.deepEqual(calls,['up','down']);assert.deepEqual(events,['input','change','input','change']);
 c.destroy();assert.equal(input.parentNode,f.app);assert.equal(input.className,'compact-number');assert.equal(input.id,'limit');assert.equal(input.onchange instanceof Function,true);assert.equal(buttons.reduce((n,b)=>n+b.listenerCount,0),0);
});

test('number buttons respect native disabled/readOnly state and unchanged bounds never emit a save',()=>{
 const f=fixture(),input=numberInput(f),events=[];input.stepUp=()=>{};input.onchange=()=>events.push('save');const c=f.api.initialize(f.root),[up,down]=input.parentNode.querySelectorAll('button');up.dispatchEvent({type:'click'});assert.deepEqual(events,[]);
 for(const state of ['disabled','readOnly']){input[state]=true;f.observers[0].fn([{type:'attributes',target:input,attributeName:state==='readOnly'?'readonly':state}]);assert.equal(up.disabled,true);assert.equal(down.disabled,true);assert.equal(input.parentNode.classList.contains(state==='readOnly'?'is-readonly':'is-disabled'),true);input.stepUp=()=>{throw Error('disabled input stepped');};up.dispatchEvent({type:'click'});input[state]=false;c.refresh();assert.equal(up.disabled,false);}
 assert.deepEqual(events,[]);c.destroy();
});

for(const step of ['any','ANY'])test(`step ${step} uses a bounded unit increment without changing the input step attribute`,()=>{
 const f=fixture(),input=numberInput(f,{step,value:'1.25',min:'0',max:'2'}),events=[];input.stepUp=input.stepDown=()=>{throw Error('native stepUp is invalid for any');};input.onchange=()=>events.push(input.value);const c=f.api.initialize(f.root),[up,down]=input.parentNode.querySelectorAll('button');up.dispatchEvent({type:'click'});assert.equal(input.value,'2');up.dispatchEvent({type:'click'});down.dispatchEvent({type:'click'});assert.equal(input.value,'1');assert.equal(input.step,step);assert.deepEqual(events,['2','1']);c.destroy();
});

test('step any never rounds a precise max into an out-of-range value',()=>{
 const f=fixture(),input=numberInput(f,{step:'any',value:'0',min:'0',max:'0.1234567890123456'}),c=f.api.initialize(f.root);input.parentNode.querySelector('button').dispatchEvent({type:'click'});assert.equal(input.value,'0.1234567890123456');c.destroy();
});

test('shared observer enhances added numbers once and releases detached wrappers and stale handlers',()=>{
 const f=fixture(),c=f.api.initialize(f.root),input=numberInput(f);input.stepUp=()=>{input.value='6';};const notify=records=>f.observers[0].fn(records);notify([{type:'childList',target:f.app,addedNodes:[input],removedNodes:[]}]);const wrap=input.parentNode,buttons=wrap.querySelectorAll('button');c.refresh();assert.equal(input.parentNode,wrap);assert.equal(f.observers.length,1);assert.equal(buttons.length,2);
 const parent=wrap.parentNode;wrap.remove();notify([{type:'childList',target:parent,addedNodes:[],removedNodes:[wrap]}]);assert.equal(input.parentNode,null);assert.equal(buttons.reduce((n,b)=>n+b.listenerCount,0),0);buttons[0].dispatchEvent({type:'click'});assert.equal(input.value,'5');
 f.app.append(input);c.refresh();assert.equal(input.parentNode.className,'ui-number');input.type='text';notify([{type:'attributes',target:input,attributeName:'type'}]);assert.equal(input.parentNode,f.app);c.destroy();assert.equal(f.observers.some(o=>o.active),false);assert.equal(f.root.listenerCount+f.window.listenerCount,0);
});

test('number stepping submits once when blur later emits the same trusted native change',()=>{
 const f=fixture(),input=numberInput(f),saves=[];input.onchange=()=>saves.push('original:'+input.value);input.addEventListener('change',()=>saves.push('listener:'+input.value));input.stepUp=()=>{input.value=String(Number(input.value)+1);};const c=f.api.initialize(f.root);input.parentNode.querySelector('button').dispatchEvent({type:'click'});assert.deepEqual(saves,['original:6','listener:6']);
 input.dispatchEvent({type:'change',isTrusted:true});assert.deepEqual(saves,['original:6','listener:6']);
 // A changed value must always reach existing business handlers, even without
 // an intervening input event (for example another native commit path).
 input.parentNode.querySelector('button').dispatchEvent({type:'click'});input.value='8';input.dispatchEvent({type:'change',isTrusted:true});assert.deepEqual(saves,['original:6','listener:6','original:7','listener:7','original:8','listener:8']);c.destroy();
});

test('a real number edit after stepping still commits when it returns to the previously submitted value',()=>{
 const f=fixture(),input=numberInput(f),saves=[];input.onchange=()=>saves.push(input.value);input.stepUp=()=>{input.value='6';};const c=f.api.initialize(f.root);input.parentNode.querySelector('button').dispatchEvent({type:'click'});input.value='7';input.dispatchEvent({type:'input',isTrusted:true});input.value='6';input.dispatchEvent({type:'input',isTrusted:true});input.dispatchEvent({type:'change',isTrusted:true});assert.deepEqual(saves,['6','6']);c.destroy();
});

test('destroy releases number commit listeners and preserves the existing native change handler',()=>{
 const f=fixture(),input=numberInput(f),saves=[];const original=()=>saves.push(input.value);input.onchange=original;input.stepUp=()=>{input.value='6';};const c=f.api.initialize(f.root);assert.equal(input.listenerCount,2);input.parentNode.querySelector('button').dispatchEvent({type:'click'});c.destroy();assert.equal(input.listenerCount,0);assert.equal(input.onchange,original);input.dispatchEvent({type:'change',isTrusted:true});assert.deepEqual(saves,['6','6']);
});
