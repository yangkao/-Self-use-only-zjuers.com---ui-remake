const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.className='';this.hidden=false;this.text='';this.classList={contains:n=>this.className.split(' ').includes(n),add:n=>this.classList.toggle(n,true),toggle:(n,v)=>{this.className=this.className.split(' ').filter(x=>x!==n).concat(v?[n]:[]).join(' ');}};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 set textContent(v){this.text=v;this.children=[];}get textContent(){return this.text+this.children.map(x=>x.textContent).join('');}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}addEventListener(){}focus(){}
 matches(s){if(s.startsWith('.'))return this.classList.contains(s.slice(1));return false;}
 querySelectorAll(s){const result=[];for(const c of this.children){if(s.split(',').some(x=>c.matches(x.trim())))result.push(c);result.push(...c.querySelectorAll(s));}return result;}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
test('stale revision after leaving edit mode recovers and folds on the latest state',async()=>{
 const root=new Element(),app=new Element(),nav=new Element(),main=new Element();app.className='app';root.append(app);app.append(nav,main);root.getElementById=id=>id==='navigation'?nav:main;
 let current={revision:1,folds:{}},writes=0,reads=0;
 const groups=[{id:'dg-zju',title:'浙大',icon:'eagle',cards:[]}];
 const chrome={runtime:{onMessage:{addListener(){}},sendMessage:async m=>{
  if(m.action==='read'){reads++;return {ok:true,value:{state:structuredClone(current),groups}};}
  if(m.revision!==current.revision)return {ok:false,code:'NAV_CONFLICT',error:'另一页面已更新导航，请关闭编辑窗口后重试'};
  writes++;current={revision:current.revision+1,folds:{...current.folds,[m.op.id]:m.op.value}};return {ok:true,value:{state:structuredClone(current),groups}};
 }}};
 const ctx=vm.createContext({chrome,document:{createElement:tag=>new Element(tag)},console});vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/navigation.js'),'utf8'),ctx);
 ctx.HomeNavigationUI.initialize(root,{navigationState:structuredClone(current),groups,categories:{},prefs:{remember:true}},{iconSvg:()=>''});
 const toggle=root.querySelector('.nav-edit-toggle');toggle.onclick();toggle.onclick();
 assert.equal(toggle.getAttribute('aria-pressed'),'false');assert.equal(nav.querySelector('.collapse-button').disabled,false);
 // A newer background state exists, while this page missed its notification.
 current.revision=2;nav.querySelector('.collapse-button').onclick();await new Promise(setImmediate);
 assert.equal(writes,1,'fold must recover instead of remaining stuck on the obsolete revision');assert.equal(reads,1);assert.equal(nav.querySelector('.nav-section').classList.contains('is-collapsed'),true);assert.equal(root.querySelector('.nav-edit-notice').textContent,'');
 nav.querySelector('.collapse-button').onclick();await new Promise(setImmediate);assert.equal(writes,2);assert.equal(nav.querySelector('.nav-section').classList.contains('is-collapsed'),false);
});
