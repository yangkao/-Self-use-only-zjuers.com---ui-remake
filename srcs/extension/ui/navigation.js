/* SPDX-License-Identifier: GPL-3.0-only
 * Portions adapted with reference to nightTab by zombieFox and contributors.
 * ZJUers-specific modifications by yangkao, 2026-10-15. See THIRD_PARTY_NOTICES.md.
 */
(function(global){
 'use strict';
 const extraIcons={star:'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',folder:'M3 6h7l2 3h9v12H3Z',globe:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M2 12h20M12 2c-6 5-6 15 0 20 6-5 6-15 0-20',code:'m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',heart:'M12 21 3 12C-2 4 8 0 12 7c4-7 14-3 9 5Z'};
 const iconNames={eagle:'求是鹰',scholarship:'书本',教:'教学',信:'电脑',浙:'校园',学:'学术',习:'学习',工:'工具',其:'信息',star:'星标',folder:'文件夹',globe:'地球',code:'代码',heart:'心形',schedule:'日历',assignments:'作业',exam:'考试',air:'空气质量',cc98:'CC98未读',cc98Top:'CC98十大',courses:'课程',event:'重要事件'};
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function initialize(root,context,hooks){
  const nav=root.getElementById('navigation'),app=root.querySelector('.app');let state=context.navigationState,groups=context.groups,editing=false,busy=false,drag=null,formOrigin=null,renderKey='';
  const bar=make('div',undefined,'nav-edit-bar preview-control'),toggle=make('button','编辑主界面','nav-edit-toggle'),add=make('button','＋ 一级栏目','nav-edit-add'),notice=make('output','','nav-edit-notice');
  toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.3 14.1 6.2 17.8 9.9 6.7 21H3ZM15.2 5.1l1.9-1.9a1 1 0 0 1 1.4 0l2.3 2.3a1 1 0 0 1 0 1.4l-1.9 1.9Z"/></svg>';
  toggle.title='编辑主界面';toggle.setAttribute('aria-label',toggle.title);add.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';add.title='新增一级栏目';add.setAttribute('aria-label',add.title);
  toggle.type=add.type='button';toggle.setAttribute('aria-pressed','false');add.inert=true;notice.setAttribute('role','status');const editDetail=make('div',undefined,'nav-edit-detail'),editLabel=make('button','编辑主界面','nav-edit-label');editLabel.type='button';editLabel.onclick=()=>toggle.click();editDetail.append(editLabel,add);bar.append(editDetail,toggle,notice);root.getElementById('mainView').append(bar);
  const menu=make('div',undefined,'nav-editor-menu preview-control');menu.hidden=true;menu.setAttribute('role','menu');app.append(menu);
  const overlay=make('div',undefined,'nav-editor-overlay preview-control');overlay.hidden=true;
  const form=make('form',undefined,'nav-editor-dialog');form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.setAttribute('aria-labelledby','nav-dialog-title');overlay.append(form);app.append(overlay);
  const icon=key=>extraIcons[key]?`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${extraIcons[key]}"/></svg>`:hooks.iconSvg(key);
  const labelKind={group:'栏目',card:'卡片',link:'条目'};
  async function call(action,args={}){const result=await chrome.runtime.sendMessage({type:'HOME_NAV',action,categories:context.categories,...args});if(!result?.ok)throw Object.assign(Error(result?.error||'扩展未响应，请刷新页面'),{code:result?.code});return result.value;}
  async function refresh(){try{const result=await call('read');state=result.state;groups=result.groups;render();}catch(e){notice.textContent=e.message;}}
  async function apply(op,revision=state.revision){if(busy)return false;const silent=op.type==='fold'||op.type==='expand';busy=true;notice.textContent=silent?'':'正在保存…';try{let result;try{result=await call('apply',{op,revision});}catch(error){if(error.code!=='NAV_CONFLICT')throw error;const latest=await call('read');state=latest.state;groups=latest.groups;render();if(!silent)throw error;result=await call('apply',{op,revision:state.revision});}state=result.state;groups=result.groups;render();notice.textContent=silent?'':'已保存';return true;}catch(e){notice.textContent=e.message;return false;}finally{busy=false;}}
  function data(el,kind,id){el.dataset.navKind=kind;el.dataset.navId=id;}
  function find(kind,id){return kind==='group'?groups.find(g=>g.id===id):kind==='card'?groups.flatMap(g=>g.cards).find(c=>c.id===id):groups.flatMap(g=>g.cards).flatMap(c=>c.links).find(l=>l.id===id);}
  const controlPaths={plus:'M12 5v14M5 12h14',up:'m6 15 6-6 6 6',down:'m6 9 6 6 6-6',left:'m15 6-6 6 6 6',right:'m9 6 6 6-6 6',drag:'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',edit:'m4 16 11-11 4 4L8 20H4Zm9-9 4 4',remove:'m6 6 12 12M18 6 6 18',move:'M4 12h16m-5-5 5 5-5 5',more:'M5 12h.01M12 12h.01M19 12h.01'};
  function controls(kind,item){
   const wrap=make('span',undefined,'nav-inline-controls'),row=make('span',undefined,'nav-control-row');wrap.append(row);wrap.inert=!editing;
   function button(glyph,label,fn,cls=''){const b=make('button',undefined,cls);b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${controlPaths[glyph]}"/></svg>`;b.onclick=e=>{e.stopPropagation();formOrigin=b;fn?.(b);};row.append(b);return b;}
   button('plus',kind==='group'?'新增卡片':'新增条目',()=>openForm('add',kind==='group'?'card':'link',null,item.id));
   const siblings=kind==='group'?groups:find('group',item.parent).cards,index=siblings.findIndex(x=>x.id===item.id);
   const step=direction=>void apply({type:'move',kind,id:item.id,parent:kind==='group'?'root':item.parent,before:direction<0?siblings[index-1]?.id:siblings[index+2]?.id});
   button(kind==='group'?'up':'left',kind==='group'?'上移栏目':'前移卡片',()=>step(-1)).disabled=index===0;
   const handle=button('drag','拖动排序；点击选择位置',()=>openForm('move',kind,item.id));data(handle,kind,item.id);handle.dataset.dragHandle='true';handle.draggable=editing;
   button(kind==='group'?'down':'right',kind==='group'?'下移栏目':'后移卡片',()=>step(1)).disabled=index===siblings.length-1;
   if(item.custom){button('edit','编辑'+labelKind[kind],()=>openForm('edit',kind,item.id),'nav-secondary-action');if(kind==='card')button('move','移动到其他栏目',()=>openForm('move',kind,item.id),'nav-secondary-action');button('remove','删除'+labelKind[kind],()=>openForm('delete',kind,item.id),'nav-secondary-action');}
   if(kind==='card'&&item.custom)button('more','更多操作',b=>{const rect=b.getBoundingClientRect();showMenu(kind,item.id,rect.left,rect.bottom,b);},'nav-more-action');
   return wrap;
  }
  function syncMode(){
   nav.classList.toggle('is-editing',editing);bar.classList.toggle('is-editing',editing);add.inert=!editing;
   nav.querySelectorAll('.nav-inline-controls').forEach(e=>e.inert=!editing);
   nav.querySelectorAll('.section-header,.card-title,[data-drag-handle],a[data-nav-kind]').forEach(e=>e.draggable=editing);
   for(const section of nav.querySelectorAll('.nav-section')){const collapsed=!editing&&context.prefs.remember&&state.folds[section.dataset.navId]===true;section.classList.toggle('is-collapsed',collapsed);section.querySelector('.collapse-region').inert=collapsed;const b=section.querySelector('.collapse-button');b.disabled=editing;b.setAttribute('aria-expanded',String(!collapsed));b.setAttribute('aria-label',(collapsed?'展开':'折叠')+section.querySelector('.section-title').textContent);}
  }
  function render(){
   const key=JSON.stringify(groups);
   if(key===renderKey){syncMode();return;}
   renderKey=key;
   nav.replaceChildren();nav.classList.toggle('is-editing',editing);
   for(const group of groups){
    const section=make('section',undefined,'nav-section');data(section,'group',group.id);if(group.custom)section.classList.add('nav-custom');
    const header=make('div',undefined,'section-header');data(header,'group',group.id);header.draggable=editing;
    const glyph=make('span',undefined,'section-heading-icon');glyph.innerHTML=icon(group.icon);header.append(glyph,make('span',group.title,'section-title'),controls('group',group),make('span',undefined,'section-line'));
    const fold=make('button',undefined,'collapse-button preview-control');fold.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';fold.type='button';const collapsed=!editing&&context.prefs.remember&&state.folds[group.id]===true;
    fold.setAttribute('aria-label',(collapsed?'展开':'折叠')+group.title);fold.setAttribute('aria-expanded',String(!collapsed));fold.disabled=editing;
    fold.onclick=()=>void apply({type:'fold',id:group.id,value:!state.folds[group.id]});header.append(fold);
    const region=make('div',undefined,'collapse-region'),inner=make('div',undefined,'collapse-inner'),grid=make('div',undefined,'cards-grid '+(group.cards.length===2?'two':group.cards.length===1?'one':''));
    region.inert=collapsed;section.classList.toggle('is-collapsed',collapsed);inner.append(grid);region.append(inner);section.append(header,region);
    for(const card of group.cards){
     const article=make('article',undefined,'nav-card preview-control'+(card.wide?' wide':'')+(card.custom?' nav-custom':''));data(article,'card',card.id);article.setAttribute('aria-label',card.title);
     {const heading=make('h2',undefined,'card-title'+(card.wide?' nav-edit-heading':''));heading.draggable=editing;data(heading,'card',card.id);const svg=make('span',undefined,'card-icon');svg.innerHTML=icon(card.icon);heading.append(svg,make('span',card.title,'nav-card-label'),controls('card',card));article.append(heading);}
     const links=make('div',undefined,'link-grid');
     for(const item of card.links){const a=make('a',item.label,(item.custom?'nav-custom ':'')+(item.hidden?'nav-hidden':''));data(a,'link',item.id);a.href=item.href;a.target=item.target||'_blank';a.rel='noopener noreferrer';a.draggable=editing;
      if(item.title){a.dataset.tip=item.title;a.setAttribute('aria-description',item.title);}a.onclick=e=>{if(!editing)return;e.preventDefault();showMenu('link',item.id,e.clientX,e.clientY,a);};links.append(a);
     }
     if(!links.childElementCount)links.append(make('span',editing?'右键卡片添加条目':'暂无条目','nav-empty'));article.append(links);grid.append(article);
    }
    if(!group.cards.length)grid.append(make('p','右键栏目添加卡片','nav-empty'));nav.append(section);
   }
   syncMode();
  }
  function closeMenu(){menu.hidden=true;}
  function closeForm(){overlay.hidden=true;form.replaceChildren();formOrigin?.focus?.();}
  function menuAction(label,fn){const b=make('button',label);b.type='button';b.setAttribute('role','menuitem');b.onclick=()=>{closeMenu();fn();};menu.append(b);}
  function showMenu(kind,id,x,y,origin){
   const item=find(kind,id);if(!item)return;formOrigin=origin;menu.replaceChildren();menu.append(make('span',(item.custom?'自定义':'默认')+labelKind[kind],'nav-menu-caption'));
   if(kind==='group')menuAction('添加卡片',()=>openForm('add','card',null,id));
   if(kind==='card')menuAction('添加条目',()=>openForm('add','link',null,id));
   if(item.custom){menuAction('编辑'+labelKind[kind],()=>openForm('edit',kind,id));menuAction('删除'+labelKind[kind],()=>openForm('delete',kind,id));}
   if(kind==='link'&&!item.custom)menuAction(item.hidden?'恢复显示':'屏蔽条目',()=>void apply({type:'hide',id,hidden:!item.hidden}));
   menuAction('移动 / 排序',()=>openForm('move',kind,id));
   menu.hidden=false;menu.style.left=Math.max(8,Math.min(x||innerWidth/2,innerWidth-menu.offsetWidth-12))+'px';menu.style.top=Math.max(8,Math.min(y||innerHeight/2,innerHeight-menu.offsetHeight-12))+'px';menu.querySelector('button')?.focus();
  }
  function field(label,control){const wrap=make('label',label,'nav-form-field');wrap.append(control);form.append(wrap);return control;}
  function input(name,value='',required=true){const el=make('input');el.name=name;el.value=value;el.required=required;el.maxLength=name==='href'?4096:name==='tooltip'?1000:200;return el;}
  function select(name,options,value){const el=make('select');el.name=name;for(const [id,label]of options){const o=make('option',label);o.value=id;el.append(o);}if(value!==undefined)el.value=value;return el;}
  function iconPicker(value){
   const wrap=make('div',undefined,'nav-icon-picker'),caption=make('span','图标','nav-form-field'),input=make('input'),trigger=make('button',undefined,'nav-icon-trigger'),grid=make('div',undefined,'nav-icon-grid');input.type='hidden';input.name='icon';input.value=value;trigger.type='button';trigger.setAttribute('aria-label','选择图标');trigger.setAttribute('aria-expanded','false');grid.setAttribute('role','radiogroup');grid.setAttribute('aria-label','导航图标');grid.hidden=true;
   const draw=()=>{trigger.innerHTML=icon(input.value)+'<svg class="nav-picker-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>';trigger.title='当前图标：'+iconNames[input.value];for(const b of grid.children){b.setAttribute('aria-checked',String(b.dataset.icon===input.value));b.tabIndex=b.dataset.icon===input.value?0:-1;}};
   const close=()=>{grid.hidden=true;trigger.setAttribute('aria-expanded','false');};
   trigger.onclick=()=>{grid.hidden=!grid.hidden;trigger.setAttribute('aria-expanded',String(!grid.hidden));if(!grid.hidden)grid.querySelector('[aria-checked=true]')?.focus();};
   for(const [key,label]of Object.entries(iconNames)){const b=make('button');b.type='button';b.dataset.icon=key;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('role','radio');b.innerHTML=icon(key);b.onclick=()=>{input.value=key;draw();close();trigger.focus();};grid.append(b);}
   grid.addEventListener('keydown',e=>{const items=[...grid.children],index=items.indexOf(root.activeElement),columns=Math.max(1,Math.round(grid.clientWidth/items[0].getBoundingClientRect().width));let next;if(e.key==='ArrowRight')next=index+1;if(e.key==='ArrowLeft')next=index-1;if(e.key==='ArrowDown')next=index+columns;if(e.key==='ArrowUp')next=index-columns;if(e.key==='Home')next=0;if(e.key==='End')next=items.length-1;if(next!==undefined){e.preventDefault();items[(next+items.length)%items.length].focus();}});
   draw();wrap.append(caption,input,trigger,grid);form.append(wrap);
  }
  function openForm(type,kind,id,parent){
   closeMenu();const item=id?find(kind,id):null,revision=state.revision;form.replaceChildren();overlay.hidden=false;
   const title=make('h2',({add:'添加',edit:'编辑',delete:'删除',move:'移动 / 排序'})[type]+labelKind[kind]);title.id='nav-dialog-title';form.append(title);
   const error=make('output','','nav-form-error');error.setAttribute('role','alert');
   if(type==='add'||type==='edit'){
    field(kind==='link'?'名称':'标题',input(kind==='link'?'label':'title',item?.label||item?.title||''));
    if(kind==='link'){const u=input('href',item?.href||'');u.type='url';u.placeholder='https://';field('网址',u);field('悬停文字（留空不显示）',input('tooltip',item?.title||'',false));}
    else iconPicker(item?.icon||'folder');
   }
   if(type==='move'){
    const targets=kind==='group'?[['root','全部栏目']]:kind==='card'?groups.map(g=>[g.id,g.title]):groups.flatMap(g=>g.cards.map(c=>[c.id,g.title+' / '+c.title]));
    const dest=field('所在位置',select('parent',targets,kind==='group'?'root':item.parent));if(!item.custom||kind==='group')dest.disabled=true;
    const before=field('排在以下内容之前',select('before',[]));
    const update=()=>{const rows=kind==='group'?groups:kind==='card'?find('group',dest.value).cards:find('card',dest.value).links;before.replaceChildren();for(const [value,label]of [['','末尾'],...rows.filter(x=>x.id!==id).map(x=>[x.id,x.title||x.label])]){const o=make('option',label);o.value=value;before.append(o);}};dest.onchange=update;update();
   }
   if(type==='delete'){
    const children=kind==='group'?item.cards:kind==='card'?item.links:[];form.append(make('p','删除“'+(item.title||item.label)+'”'+(children.length?'前，请选择其内容的迁移位置。':'。')));
    if(children.length){const rows=kind==='group'?groups:groups.flatMap(g=>g.cards);const dest=field('迁移到',select('target',[['','请选择目标'],...rows.filter(x=>x.id!==id).map(x=>[x.id,x.title])]));dest.required=true;}
   }
   const actions=make('div',undefined,'nav-form-actions'),cancel=make('button','取消'),save=make('button',type==='delete'?'删除并保存':'保存');cancel.type='button';cancel.onclick=closeForm;save.type='submit';actions.append(cancel,save);form.append(error,actions);
   form.onsubmit=async event=>{event.preventDefault();save.disabled=true;const values=Object.fromEntries(new FormData(form)),op={type,kind,id,parent,...values};
    if(type==='add'||type==='edit'){if(kind==='link'){op.title=values.tooltip;delete op.tooltip;}}
    if(type==='move')op.parent=form.elements.parent.value;
    if(await apply(op,revision))closeForm();else{error.textContent=notice.textContent;save.disabled=false;}
   };
   form.querySelector('input,select,button')?.focus();
  }
  toggle.onclick=()=>{editing=!editing;toggle.title=editing?'完成编辑':'编辑主界面';toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-pressed',String(editing));notice.textContent='';closeMenu();render();};
  menu.addEventListener('keydown',event=>{const items=[...menu.querySelectorAll('button')],index=items.indexOf(root.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});
  add.onclick=()=>{formOrigin=add;openForm('add','group');};
  nav.addEventListener('contextmenu',event=>{if(!editing)return;const target=event.target.closest('[data-nav-kind]');if(!target)return;event.preventDefault();event.stopPropagation();showMenu(target.dataset.navKind,target.dataset.navId,event.clientX,event.clientY,target);});
  root.addEventListener('pointerdown',event=>{if(!menu.hidden&&!event.target.closest('.nav-editor-menu'))closeMenu();});
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeForm();});
  root.addEventListener('keydown',event=>{if(overlay.hidden&&menu.hidden)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();const grid=form.querySelector('.nav-icon-grid:not([hidden])');if(grid){grid.hidden=true;const trigger=form.querySelector('.nav-icon-trigger');trigger.setAttribute('aria-expanded','false');trigger.focus();return;}closeMenu();closeForm();}if(event.key==='Tab'&&!overlay.hidden){const focus=[...form.querySelectorAll('input,select,button')].filter(e=>!e.disabled&&e.type!=='hidden'&&!e.closest('[hidden]'));if(event.shiftKey&&root.activeElement===focus[0]){event.preventDefault();focus.at(-1).focus();}else if(!event.shiftKey&&root.activeElement===focus.at(-1)){event.preventDefault();focus[0].focus();}}},true);
  nav.addEventListener('dragstart',event=>{if(!editing)return;const el=event.target.closest('[draggable="true"][data-nav-kind]');if(!el)return;drag={kind:el.dataset.navKind,id:el.dataset.navId};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain','zjuers-navigation');el.classList.add('nav-dragging');closeMenu();});
  const clearDrop=()=>nav.querySelectorAll('.nav-drop-before,.nav-drop-inside').forEach(e=>e.classList.remove('nav-drop-before','nav-drop-inside'));
  nav.addEventListener('dragover',event=>{if(!drag)return;clearDrop();const target=event.target.closest(`[data-nav-kind="${drag.kind}"]`),container=event.target.closest(`[data-nav-kind="${drag.kind==='link'?'card':'group'}"]`),source=find(drag.kind,drag.id),parent=target?(drag.kind==='group'?'root':find(drag.kind,target.dataset.navId)?.parent):container?.dataset.navId;
   if(!parent||target?.dataset.navId===drag.id||(!source.custom&&drag.kind!=='group'&&source.parent!==parent)){event.dataTransfer.dropEffect='none';return;}event.preventDefault();event.dataTransfer.dropEffect='move';(target||container)?.classList.add(target?'nav-drop-before':'nav-drop-inside');});
  nav.addEventListener('drop',event=>{if(!drag)return;event.preventDefault();event.stopPropagation();const target=event.target.closest(`[data-nav-kind="${drag.kind}"]`);let parent,before;
   if(target){before=target.dataset.navId;if(before===drag.id)return;const item=find(drag.kind,before);parent=drag.kind==='group'?'root':item.parent;}
   else if(drag.kind==='link')parent=event.target.closest('[data-nav-kind="card"]')?.dataset.navId;
   else if(drag.kind==='card')parent=event.target.closest('[data-nav-kind="group"]')?.dataset.navId;
   if(parent)void apply({type:'move',...drag,parent,before});
  });
  nav.addEventListener('dragleave',event=>{if(!nav.contains(event.relatedTarget))clearDrop();});
  nav.addEventListener('dragend',()=>{clearDrop();drag=null;nav.querySelectorAll('.nav-dragging').forEach(e=>e.classList.remove('nav-dragging'));});
  chrome.runtime.onMessage.addListener(message=>{if(message.type==='HOME_NAV_CHANGED')void refresh();if(message.type==='HOME_CONFIG_CHANGED')location.reload();});
  render();return {get editing(){return editing;},expandAll(){void apply({type:'expand'});}};
 }
 global.HomeNavigationUI={initialize};
})(globalThis);
