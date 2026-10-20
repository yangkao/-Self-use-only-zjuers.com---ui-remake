const test=require('node:test');
const assert=require('node:assert/strict');
const {render}=require('../ui/cc98-personal.js');
global.HomeCC98UICore=require('../ui/cc98-ui-core.js');
class Node {
 constructor(tag,text='',className=''){this.tag=tag;this.textContent=text??'';this.className=className;this.children=[];this.attrs={};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,fn){this['on'+k]=fn;}
 querySelector(selector){const cls=selector.startsWith('.')?selector.slice(1):null;return walk(this).slice(1).find(n=>cls?n.className.split(' ').includes(cls):n.tag===selector)||null;}
}
const H={el:(...args)=>new Node(...args),button:(text,onclick,className)=>Object.assign(new Node('button',text,className),{onclick}),link:(text,href,className)=>Object.assign(new Node('a',text,className),{href}),icon:kind=>new Node('svg',kind),time:v=>v||'未知',forum:'https://www.cc98.org/'};
const walk=n=>[n,...n.children.flatMap(walk)];
const text=n=>walk(n).map(n=>n.textContent).join(' ');
test('avatar requests only known WebVPN media paths and retries a failure after explicit profile refresh',()=>{
 const root=new Node('main'),state={tab:'profile',profileEntry:{status:'ready',updatedAt:1,data:{profile:{id:'1',portraitUrl:'https://file.cc98.org/a.png'}}}};
 render(root,state,{},H);const img=walk(root).find(n=>n.tag==='img');assert.equal(new URL(img.src).origin,'https://webvpn.zju.edu.cn');assert(img.src.includes('f6fe4d9969336b09264686be9f/a.png'));img.onerror();
 render(root,state,{},H);assert(!walk(root).some(n=>n.tag==='img'));state.profileEntry.updatedAt=2;render(root,state,{},H);assert(walk(root).some(n=>n.tag==='img'));
});
test('profile uses literal signature, six approved metrics and safe non-looping avatar fallback',()=>{
 const root=new Node('main');const state={tab:'profile',profileEntry:{status:'ready',data:{profile:{name:'本人',id:'1',portraitUrl:'https://file.cc98.org/a.png',signature:'<img onerror=alert(1)>',wealth:0}}}};
 render(root,state,{},H);let nodes=walk(root);assert.equal(nodes.filter(n=>n.className==='cc98-metric').length,6);assert(!text(root).includes('补签卡'));assert(!text(root).includes('用户 ID'));assert(text(root).includes('<img onerror=alert(1)>'));const image=nodes.find(n=>n.tag==='img');assert(image);image.onerror();assert(!walk(root).some(n=>n.tag==='img'));assert(walk(root).some(n=>n.tag==='svg'));
 state.profileEntry.data.profile.portraitUrl='https://file.cc98.org.evil.invalid/a';render(root,state,{},H);assert(!walk(root).some(n=>n.tag==='img'));
});
test('contacts enter read-only conversation; messages remain literal and raw errors stay hidden',()=>{
 const root=new Node('main');let peer;
 render(root,{tab:'messages',category:'contacts',entry:{status:'ready',data:{items:[{userId:'7',name:'测试联系人',time:'2026',lastContent:'<b>预览</b>'}]}}},{peer:p=>peer=p},H);
 walk(root).find(n=>n.textContent==='测试联系人').onclick();assert.deepEqual(peer,{id:'7',name:'测试联系人'});
 render(root,{tab:'messages',category:'contacts',peer,entry:{status:'error',code:'AUTH_REQUIRED',error:'secret',stale:true,data:{items:[{senderId:'7',content:'<script>正文</script>'}]}}},{},H);
 const nodes=walk(root);assert(text(root).includes('<script>正文</script>'));assert(text(root).includes('返回联系人'));assert(!text(root).includes('secret'));assert(!nodes.some(n=>['input','textarea'].includes(n.tag)));assert(!nodes.some(n=>/发送|已读/.test(n.textContent)&&n.tag==='button'));assert(nodes.some(n=>n.textContent==='重试'));
});
test('calendar starts Monday, uses actual leap-month days and noninteractive status cells',()=>{
 const root=new Node('main');let selected,delta;
 render(root,{tab:'signin',year:2024,month:2,signinEntry:{status:'ready',data:{hasSignedInToday:false,lastSignInCount:0,lastReward:0}},monthEntry:{status:'ready',data:{year:2024,month:2,items:[{year:2024,month:2,day:3,useCard:true,reward:0}]}}},{selectMonth:(...v)=>selected=v,month:d=>delta=d},H);
 const nodes=walk(root),grid=nodes.find(n=>n.className==='cc98-month-grid');assert.equal(grid.children.length,7+3+29);assert(!walk(grid).some(n=>n.tag==='button'));assert(text(grid).includes('补签'));assert(text(grid).includes('奖励 0'));assert(nodes.some(n=>n.href==='https://www.cc98.org/signin'));
 nodes.find(n=>n.textContent==='上个月').onclick();assert.equal(delta,-1);const input=nodes.find(n=>n.tag==='input');input.value='2024-03';input.onchange();assert.deepEqual(selected,[2024,3]);
});
test('missing cache, loading, error and successful empty lists have distinct feedback',()=>{
 const root=new Node('main');render(root,{tab:'messages'}, {},H);assert(text(root).includes('尚未获取'));assert(!text(root).includes('暂无此类消息'));
 render(root,{tab:'messages',loading:true},{},H);assert(text(root).includes('正在加载'));assert(!text(root).includes('尚未获取'));
 render(root,{tab:'messages',entry:{status:'error',code:'CACHE_RELEASED'}},{},H);assert(text(root).includes('重新获取'));
 render(root,{tab:'messages',entry:{status:'ready',data:{items:[]}}},{},H);assert(text(root).includes('暂无此类消息'));
});
test('personal navigation has group semantics and month controls respect provider year bounds',()=>{
 const root=new Node('main');let selected;
 render(root,{tab:'signin',year:2000,month:1},{selectMonth:(...args)=>selected=args},H);
 let nodes=walk(root);assert(nodes.some(n=>n.attrs.role==='group'&&n.attrs['aria-label']==='个人内容分类'));assert(!nodes.some(n=>n.attrs.role==='tab'||n.attrs.role==='tablist'));assert(nodes.some(n=>n.textContent==='签到'&&n.attrs['aria-pressed']==='true'));
 assert.equal(nodes.find(n=>n.textContent==='上个月').disabled,true);let input=nodes.find(n=>n.tag==='input');assert.equal(input.min,'2000-01');assert.equal(input.max,'2100-12');input.value='1999-12';input.onchange();assert.equal(selected,undefined);input.value='2101-01';input.onchange();assert.equal(selected,undefined);
 input.value='2100-12';input.onchange();assert.deepEqual(selected,[2100,12]);render(root,{tab:'signin',year:2100,month:12},{},H);nodes=walk(root);assert.equal(nodes.find(n=>n.textContent==='下个月').disabled,true);
});
test('pending avatar stays eager with a visible fallback and survives unrelated profile paints',()=>{
 const root=new Node('main'),state={tab:'profile',profileEntry:{status:'ready',updatedAt:123,data:{profile:{id:'1',name:'本人',portraitUrl:'https://file.cc98.org/a.png'}}}};
 render(root,state,{},H);let nodes=walk(root),box=nodes.find(n=>n.className==='cc98-avatar'),image=box.children.find(n=>n.tag==='img');assert.equal(image.loading,'eager');assert.equal(image.hidden,true);assert(box.children.some(n=>n.tag==='svg'));assert.equal(box.attrs['data-avatar-state'],'loading');
 render(root,state,{},H);assert.equal(walk(root).find(n=>n.className==='cc98-avatar'),box);assert.equal(box.children.find(n=>n.tag==='img'),image);
 image.naturalWidth=80;image.onload();assert.equal(image.hidden,false);assert.equal(box.children.length,1);assert.equal(box.attrs['data-avatar-state'],'ready');
 state.profileEntry.data.profile.id='2';render(root,state,{},H);assert.notEqual(walk(root).find(n=>n.className==='cc98-avatar'),box);
});
test('one compact refresh icon shares the update row instead of taking its own line',()=>{
 const root=new Node('main');let refreshed=0;render(root,{tab:'profile',profileEntry:{status:'ready',updatedAt:'2026-10-20 15:00',data:{profile:{id:'1',name:'本人'}}}},{refresh:()=>refreshed++},H);
 const nodes=walk(root),row=nodes.find(n=>n.className==='cc98-update-row'),refresh=row.children.find(n=>n.tag==='button');assert(row.children.some(n=>n.tag==='span'&&n.textContent.includes('更新于')));assert.equal(refresh.textContent,'');assert.equal(refresh.attrs['aria-label'],'刷新个人内容');assert(refresh.children.some(n=>n.tag==='svg'&&n.textContent==='refresh'));refresh.onclick();assert.equal(refreshed,1);assert.equal(nodes.filter(n=>n.attrs['aria-label']==='刷新个人内容').length,1);
});
