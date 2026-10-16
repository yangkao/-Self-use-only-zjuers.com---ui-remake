(function(root){
 'use strict';
 const defaults=[
  {id:'dg-zju',title:'浙大',icon:'eagle',cards:[['dc-teaching','教学','教',['cat1']],['dc-it','信息化服务','信',['cat2']],['dc-zju','其它','浙',['cat3']]]},
  {id:'dg-academic',title:'学术',icon:'scholarship',cards:[['dc-academic','学术搜索 · 查重','学',['cat4']],['dc-learning','学习','习',['cat6']]]},
  {id:'dg-tools',title:'实用工具',icon:'工',cards:[['dc-tools','实用工具','工',['cat5','cat7']]]},
  {id:'dg-about',title:'其它 · 关于本站',icon:'其',cards:[['dc-about','其它 · 关于本站','其',['cat9']]]}
 ];
 const icons=['eagle','scholarship','教','信','浙','学','习','工','其','star','folder','globe','code','heart','schedule','assignments','exam','air','cc98','cc98Top','courses','event'];
 const categoryCard=Object.fromEntries(defaults.flatMap(g=>g.cards.flatMap(c=>c[3].map(k=>[k,c[0]]))));
 const fail=m=>{throw new Error(m);};
 const id=()=>crypto.randomUUID();
 const plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 function text(x,max=100,empty=false){if(typeof x!=='string'||x.length>max||(!empty&&!x.trim()))fail('名称或文本格式无效');return x.trim();}
 function url(x){text(x,4096);let u;try{u=new URL(x);}catch{fail('请输入完整的 http 或 https 网址');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)fail('仅允许不含账号密码的 http 或 https 网址');return u.href;}
 function source(categories){const rows=[];for(const category of Object.keys(categoryCard)){if(!Array.isArray(categories?.[category])||!categories[category].length)fail('原站栏目结构缺失：'+category);for(const a of categories[category]){if(rows.length>=1500)fail('原站导航条目过多');rows.push({category,sourceId:text(a.id||'',150,true),label:text(a.label,200),href:url(a.href),title:text(a.title||'',1000,true),target:a.target==='_self'?'_self':'_blank'});}}return rows;}
 function empty(){return {schemaVersion:1,revision:0,registry:[],hidden:[],groups:[],cards:[],links:[],orders:{},folds:{}};}
 function containers(s){return {groups:[...defaults.map(g=>({...g,custom:false})),...s.groups.map(g=>({...g,custom:true}))],cards:[...defaults.flatMap(g=>g.cards.map(c=>({id:c[0],title:c[1],icon:c[2],parent:g.id,custom:false,wide:['dc-tools','dc-about'].includes(c[0])}))),...s.cards.map(c=>({...c,custom:true}))]};}
 function fields(o,allowed){if(!plain(o)||Object.keys(o).some(k=>!allowed.includes(k)))fail('数据含有未知字段');}
 function validate(value){
  const s=structuredClone(value);fields(s,['schemaVersion','revision','registry','hidden','groups','cards','links','orders','folds']);
  if(s.schemaVersion!==1||!Number.isSafeInteger(s.revision)||s.revision<0)fail('导航数据版本无效');
  for(const k of ['registry','hidden','groups','cards','links'])if(!Array.isArray(s[k])||s[k].length>3000)fail('导航数据数量无效');
  if(!plain(s.orders)||!plain(s.folds)||Object.keys(s.orders).length>3000)fail('导航规则无效');
  const used=new Set(defaults.flatMap(g=>[g.id,...g.cards.map(c=>c[0])]));
  for(const list of [s.registry,s.groups,s.cards,s.links])for(const item of list){const key=list===s.registry?'uid':'id';if(!plain(item)||typeof item[key]!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(item[key])||used.has(item[key]))fail('导航编号重复或无效');used.add(item[key]);}
  for(const r of s.registry){fields(r,['uid','category','sourceId','label','href']);if(!categoryCard[r.category])fail('来源分类无效');text(r.sourceId,150,true);text(r.label,200);url(r.href);}
  for(const g of s.groups){fields(g,['id','title','icon']);text(g.title);if(!icons.includes(g.icon))fail('图标无效');}
  const c=containers(s),gids=new Set(c.groups.map(g=>g.id)),cids=new Set(c.cards.map(c=>c.id));
  for(const card of s.cards){fields(card,['id','title','icon','parent']);text(card.title);if(!icons.includes(card.icon)||!gids.has(card.parent))fail('卡片归属或图标无效');}
  for(const link of s.links){fields(link,['id','parent','label','href','title']);text(link.label,200);url(link.href);text(link.title,1000,true);if(!cids.has(link.parent))fail('条目引用了不存在的卡片');}
  const sourceIds=new Set(s.registry.map(r=>r.uid));if(new Set(s.hidden).size!==s.hidden.length||s.hidden.some(k=>!sourceIds.has(k)))fail('屏蔽规则无效');
  const parents=new Map([...c.groups.map(g=>[g.id,'root']),...c.cards.map(c=>[c.id,c.parent]),...s.registry.map(r=>[r.uid,categoryCard[r.category]]),...s.links.map(l=>[l.id,l.parent])]);
  for(const [parent,order]of Object.entries(s.orders)){if(parent!=='root'&&!gids.has(parent)&&!cids.has(parent))fail('排序容器无效');if(!Array.isArray(order)||order.length>3000||new Set(order).size!==order.length||order.some(k=>parents.get(k)!==parent))fail('排序引用或归属无效');}
  for(const [key,v]of Object.entries(s.folds))if(!gids.has(key)||typeof v!=='boolean')fail('折叠设置无效');
  return s;
 }
 function matchRows(old,rows){
  const matched=new Map(),used=new Set();
  // Only unique matches in both directions; ambiguous entries receive a fresh identity.
  for(const score of [r=>[r.category,r.sourceId,r.href,r.label],r=>[r.category,r.sourceId,r.href],r=>[r.category,r.href],r=>[r.category,r.sourceId,r.label],r=>[r.category,r.sourceId].filter(Boolean),r=>[r.category,r.label]]){
   const a=new Map(),b=new Map();for(const r of old)if(!used.has(r.uid)){const k=JSON.stringify(score(r));a.set(k,[...(a.get(k)||[]),r]);}rows.forEach((r,i)=>{if(!matched.has(i)){const k=JSON.stringify(score(r));b.set(k,[...(b.get(k)||[]),i]);}});
   for(const [k,items]of b)if(items.length===1&&a.get(k)?.length===1){const r=a.get(k)[0];matched.set(items[0],r.uid);used.add(r.uid);}
  }return matched;
 }
 function reconcile(value,categories){
  const first=!value,s=value?validate(value):empty(),rows=source(categories),matches=matchRows(s.registry,rows);
  rows.forEach((r,i)=>{const uid=matches.get(i)||id(),entry={uid,category:r.category,sourceId:r.sourceId,href:r.href,label:r.label},index=s.registry.findIndex(x=>x.uid===uid);if(index<0)s.registry.push(entry);else s.registry[index]=entry;
   if(first&&((r.category==='cat6'&&!['mooc','zhs','xxqg'].includes(r.sourceId))||(['cat5','cat7'].includes(r.category)&&['bdfy','ggfy','txwd','bdwk'].includes(r.sourceId))))s.hidden.push(uid);
  });
  if(first)s.links=[{id:id(),parent:'dc-tools',label:'刘明野工具箱',href:'https://tools.liumingye.cn/#/',title:''},{id:id(),parent:'dc-tools',label:'Tuna',href:'https://mirrors.tuna.tsinghua.edu.cn/',title:''}];
  return validate(s);
 }
 function ordered(list,order=[]){const rank=new Map(order.map((id,i)=>[id,i]));return [...list].sort((a,b)=>(rank.get(a.id)??1e9)-(rank.get(b.id)??1e9));}
 function groups(s,categories,showHidden=false){
  const rows=source(categories),matches=matchRows(s.registry,rows),all=containers(s);
  const links=rows.map((r,i)=>({...r,id:matches.get(i),parent:categoryCard[r.category],custom:false,hidden:s.hidden.includes(matches.get(i))})).filter(l=>l.id&&(showHidden||!l.hidden));
  links.push(...s.links.map(l=>({...l,custom:true,target:'_blank'})));
  return ordered(all.groups,s.orders.root).map(g=>({...g,cards:ordered(all.cards.filter(c=>c.parent===g.id),s.orders[g.id]).map(c=>({...c,links:ordered(links.filter(l=>l.parent===c.id),s.orders[c.id])}))}));
 }
 function apply(value,op,categories){
  const s=validate(value),all=containers(s);if(!plain(op))fail('操作无效');
  if(op.type==='fold'){if(!all.groups.some(g=>g.id===op.id)||typeof op.value!=='boolean')fail('折叠操作无效');s.folds[op.id]=op.value;return s;}
  if(op.type==='expand'){s.folds={};return s;}
  if(op.type==='hide'){if(!s.registry.some(r=>r.uid===op.id)||typeof op.hidden!=='boolean')fail('只能屏蔽原站条目');s.hidden=s.hidden.filter(k=>k!==op.id);if(op.hidden)s.hidden.push(op.id);return s;}
  const kind=op.kind;if(!['group','card','link'].includes(kind))fail('编辑对象无效');const list=s[{group:'groups',card:'cards',link:'links'}[kind]];
  const current=list.find(x=>x.id===op.id),known=kind==='group'?all.groups:kind==='card'?all.cards:[...s.links,...s.registry.map(r=>({id:r.uid,parent:categoryCard[r.category]}))];
  const item=known.find(x=>x.id===op.id);
  const validParent=parent=>kind==='group'?parent==='root':kind==='card'?all.groups.some(g=>g.id===parent):all.cards.some(c=>c.id===parent);
  if(op.type==='add'||op.type==='edit'){
   if(op.type==='edit'&&!current)fail('默认内容不可改名或修改');
   let next;if(kind==='link')next={id:current?.id||id(),parent:current?.parent||op.parent,label:text(op.label,200),href:url(op.href),title:text(op.title||'',1000,true)};
   else{next={id:current?.id||id(),title:text(op.title),icon:op.icon};if(!icons.includes(next.icon))fail('请选择图标');if(kind==='card')next.parent=current?.parent||op.parent;}
   if(kind!=='group'&&!validParent(next.parent))fail('目标容器不存在');
   if(current)list.splice(list.indexOf(current),1,next);else list.push(next);
  }else if(op.type==='move'){
   if(!item)fail('条目不存在');const parent=op.parent||(kind==='group'?'root':item.parent),old=kind==='group'?'root':item.parent;
   if(!validParent(parent))fail('目标容器不存在');if(!current&&parent!==old)fail('默认分类关系固定，不能移出所属容器');
   if(current&&kind!=='group')current.parent=parent;
   for(const order of Object.values(s.orders)){const i=order.indexOf(op.id);if(i>=0)order.splice(i,1);}
   const rendered=groups(s,categories,true),siblings=kind==='group'?rendered:kind==='card'?rendered.find(g=>g.id===parent).cards:rendered.flatMap(g=>g.cards).find(c=>c.id===parent).links;
   const order=siblings.map(x=>x.id).filter(k=>k!==op.id);if(op.before&&(!order.includes(op.before)))fail('排序位置无效');order.splice(op.before?order.indexOf(op.before):order.length,0,op.id);s.orders[parent]=order;
  }else if(op.type==='delete'){
   if(!current)fail('默认栏目、卡片和原站条目不可删除');
   const children=kind==='group'?s.cards.filter(c=>c.parent===op.id):kind==='card'?s.links.filter(l=>l.parent===op.id):[];
   if(children.length){const targets=kind==='group'?all.groups:all.cards;if(op.target===op.id||!targets.some(x=>x.id===op.target))fail('请先选择子内容迁移目标');for(const child of children)child.parent=op.target;}
   list.splice(list.indexOf(current),1);delete s.orders[op.id];delete s.folds[op.id];for(const order of Object.values(s.orders)){const i=order.indexOf(op.id);if(i>=0)order.splice(i,1);}
  }else fail('不支持的操作');
  return validate(s);
 }
 const api={defaults,icons,categoryCard,empty,validate,reconcile,groups,apply,source,containers};root.HomeNavigation=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
