const test=require('node:test');
const assert=require('node:assert/strict');
const {render}=require('../ui/cc98-forum.js');
class Node {
 constructor(tag,text='',className=''){this.tag=tag;this.textContent=text??'';this.className=className;this.children=[];this.attrs={};this.dataset={};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,fn){this['on'+k]=fn;}
}
const H={el:(...v)=>new Node(...v),button:(label,fn,cls)=>Object.assign(new Node('button',label,cls),{onclick:fn}),link:(label,url,cls)=>Object.assign(new Node('a',label,cls),{href:url}),icon:kind=>new Node('svg',kind),time:v=>v?'北京时间 '+v:'未知',forum:'https://www.cc98.org/'};
const walk=n=>[n,...n.children.flatMap(walk)];
const text=n=>walk(n).map(x=>x.textContent).join(' ');
const actions={mode(){},refresh(){},more(){},previous(){},openDirectory(){},closeDirectory(){},searchDirectory(){},selectBoard(){},retry(){}};
test('previous batch is above posts and next batch remains below; cached directory fills old rows',()=>{
 const root=new Node('main');let previous=0;render(root,{mode:'new',canPrevious:true,directoryEntry:{data:{items:[{boards:[{id:'9',name:'Known board'}]}]}},entry:{status:'ready',data:{items:[{id:'1',title:'First post',boardId:'9'}],hasMore:true}}},{...actions,previous(){previous++;}},H);
 const nodes=walk(root),back=nodes.find(n=>n.textContent==='加载上一批'),post=nodes.find(n=>n.className==='cc98-post'),more=nodes.find(n=>n.textContent==='加载更多');
 assert(back);assert(nodes.indexOf(back)<nodes.indexOf(post));assert(nodes.indexOf(more)>nodes.indexOf(post));back.onclick();assert.equal(previous,1);assert.match(text(root),/Known board/);
});
test('literal titles and every metadata field survive stale loading without author images',()=>{
 const root=new Node('main');render(root,{mode:'top',loading:true,entry:{status:'error',error:'untrusted internal error',code:'AUTH_REQUIRED',data:{items:[{id:'1',title:'<img src=x>',authorName:'A',time:'2026',lastPostTime:'2027',hitCount:0}]}}},actions,H);
 const all=walk(root);assert(all.some(n=>n.tag==='a'&&n.textContent==='<img src=x>'));assert(!all.some(n=>n.tag==='img'));assert.match(text(root),/浏览 0/);assert.match(text(root),/未知版面/);assert.match(text(root),/最后回复/);assert.match(text(root),/登录/);assert(!text(root).includes('untrusted internal error'));assert(all.some(n=>n.textContent==='重试'));
 assert(all.some(n=>n.attrs['aria-label']==='刷新论坛'));
});
test('directory is lazy, searchable and selects board objects from compact sections',()=>{
 const root=new Node('main');let selected,search;
 const state={mode:'board',directorySearch:'学',directoryEntry:{status:'ready',data:{items:[{name:'学习区',boards:[{id:'2',name:'课程学习'},{id:'3',name:'闲聊'}]}]}}};
 render(root,state,actions,H);assert(!text(root).includes('课程学习'));
 render(root,{...state,directoryOpen:true},{...actions,selectBoard:b=>selected=b,searchDirectory:q=>search=q},H);
 const all=walk(root),input=all.find(n=>n.tag==='input');assert.equal(input.value,'学');input.oninput({target:{value:'课'}});assert.equal(search,'课');all.find(n=>n.className==='cc98-board-option'&&n.textContent==='课程学习').onclick();assert.deepEqual(selected,{id:'2',name:'课程学习'});
});
test('released cache has explicit reload and new pagination distinguishes cap from empty end',()=>{
 const root=new Node('main');render(root,{mode:'new',entry:{status:'error',code:'CACHE_RELEASED'}},actions,H);assert.match(text(root),/重新获取/);assert(!text(root).includes('暂无帖子'));
 render(root,{mode:'new',canPrevious:true,entry:{status:'ready',data:{items:[],limitReached:true,hasMore:false}}},actions,H);assert.match(text(root),/小水怡情，可不要沉迷哟。/);assert(walk(root).some(n=>n.textContent==='加载上一批'));
 render(root,{mode:'new',entry:{status:'ready',data:{items:[],hasMore:false}}},actions,H);assert.match(text(root),/暂无帖子/);assert(!text(root).includes('小水怡情'));
});
