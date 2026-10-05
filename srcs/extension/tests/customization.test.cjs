const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const T=require('../theme-core.js');
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.listeners={};this.className='';this.style={setProperty(){}};this.classList={add:(x)=>this.className+=' '+x,toggle(){},contains:x=>this.className.split(' ').includes(x)};}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 async emit(type,event){for(const fn of this.listeners[type]||[])await fn(event);}
 focus(){}select(){}showModal(){this.open=true;}close(){this.open=false;}
 matches(selector){
  if(selector==='button:not(:disabled)')return this.tagName==='BUTTON'&&!this.disabled;
  if(selector.startsWith('.'))return selector.slice(1).split('.').every(c=>this.classList.contains(c));
  const match=selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
  if(match){const key=match[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return key in this.dataset&&(match[2]===undefined||this.dataset[key]===match[2]);}
  return this.tagName.toLowerCase()===selector;
 }
 closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
 querySelectorAll(selector){const out=[];for(const child of this.children){if(child.matches(selector))out.push(child);out.push(...child.querySelectorAll(selector));}return out;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
async function setup(){
 const view=new Element(),app=new Element(),area=new Element(),main=new Element(),secondary=new Element(),greeting=new Element(),tab=new Element('button');
 app.className='app';secondary.className='secondary-inner';tab.className='settings-tab active';tab.dataset.tab='themes';view.append(app,tab);app.append(area,main,secondary,greeting);
 view.getElementById=id=>({settingsBody:area,mainView:main,greeting})[id]||view.querySelectorAll('div').find(x=>x.id===id);
 let saved=T.normalizeState({activeId:'one',themes:[{id:'one',name:'One'},{id:'two',name:'Two'}]});const writes=[],loads=[];
 const context=vm.createContext({HomeThemeCore:T,structuredClone,Intl,Date,crypto:require('node:crypto').webcrypto,setTimeout,console,innerWidth:1280,innerHeight:900,
  document:{createElement:tag=>new Element(tag)},window:{addEventListener(){}},chrome:{runtime:{onMessage:{addListener(){},removeListener(){}}}},
  HomeExternal:{call:async(action,args)=>{if(action==='themes-get')return {state:structuredClone(saved),greeting:T.normalizeGreeting()};if(action==='themes-set'){saved=T.normalizeState(args.state);writes.push(structuredClone(saved));return structuredClone(saved);}return {}; }},
  HomeWallpaper:{initialize:()=>({sessionId:'a'.repeat(32),load:(theme)=>loads.push(theme.id),dispose(){}})}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/customization.js'),'utf8'),context);
 context.HomeCustomize.initialize(view,{resource:p=>'chrome-extension://test/'+p,openSecondary(){},openSettings(){}});
 await new Promise(setImmediate);return {view,area,tab,writes,loads};
}
test('theme gallery initializes and selecting a tile persists the selected theme',async()=>{
 const h=await setup();const tiles=h.area.querySelectorAll('.theme-tile');assert.equal(tiles.length,3);
 assert.equal(tiles[1].attributes['aria-pressed'],'true');assert.match(tiles[1].querySelector('iframe').src,/thumbnail.html\?id=one$/);
 await h.area.emit('click',{target:tiles[2]});assert.equal(h.writes.at(-1).activeId,'two');assert.equal(h.loads.at(-1),'two');
 assert.equal(h.area.querySelectorAll('.theme-tile')[2].attributes['aria-pressed'],'true');
});
test('default context menu protects delete/rename and duplicating saves a new theme',async()=>{
 const h=await setup(),tile=h.area.querySelector('.theme-tile');
 await h.area.emit('contextmenu',{target:tile,preventDefault(){},stopPropagation(){},clientX:1200,clientY:850});
 const menu=h.view.querySelector('.theme-context-menu');assert.equal(menu.hidden,false);
 assert.equal(menu.querySelector('[data-custom-action="rename"]').disabled,true);
 assert.equal(menu.querySelector('[data-custom-action="delete"]').disabled,true);
 await menu.emit('click',{target:menu.querySelector('[data-custom-action="duplicate"]')});
 assert.equal(h.writes.at(-1).themes.length,4);assert.notEqual(h.writes.at(-1).activeId,'default');
});
