/* SPDX-License-Identifier: GPL-3.0-only
 * Portions adapted with reference to nightTab by zombieFox and contributors.
 * ZJUers-specific modifications by yangkao, 2026-10-15. See THIRD_PARTY_NOTICES.md.
 */
(function(global){
 'use strict';
 function initialize(view,context){
  const T=global.HomeThemeCore,app=view.querySelector('.app'),area=view.getElementById('settingsBody');
  let state=T.normalizeState(),draft=T.defaultTheme(),greeting=T.normalizeGreeting(),ready=false,busy=false,disposed=false,applySequence=0,lastFailure='',draftDirty=false;
  const thumbnails=new Map();
  const call=(action,args={})=>global.HomeExternal.call(action,args);
  const h=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
  const tab=()=>view.querySelector('.settings-tab.active')?.dataset.tab;
  const message=text=>{const e=area.querySelector('.custom-message');if(e)e.textContent=text;};
  const wallpaper=global.HomeWallpaper.initialize(view,{resource:context.resource,onDailyStatus:text=>{let status=view.querySelector('.bing-status');if(!status){status=h('output',undefined,'bing-status custom-help');view.getElementById('mainView').append(status);}status.textContent=text;status.hidden=!text;},onError:(text,meta)=>{
   busy=false;
   if(meta?.analysisError){message('自动配色失败：'+text+'。当前配色已保留。');return;}
   applyColors(T.defaultTheme());if(lastFailure===draft.id+text)return;lastFailure=draft.id+text;
   const dialog=view.getElementById('wallpaperError');dialog.querySelector('p').textContent='自定义壁纸无法读取，已使用静态后备背景与配色。请在主题设置中重新授权或选择文件；旧路径主题还需检查文件位置与扩展的文件访问权限。';dialog.hidden=false;
   view.getElementById('wallpaperErrorClose').focus();
  },onPalette:(colors,meta)=>{if(meta?.themeId&&meta.themeId!==draft.id)return;draft.colors=colors;const current=state.themes.find(t=>t.id===draft.id);if(current)current.colors=structuredClone(colors);busy=false;applyColors(draft);render();message('整套配色已生成，可继续调整并保存主题。');}});
  function applyColors(theme){
   app.classList.add('theme-applying');
   const v=theme.visuals,c=theme.colors;app.classList.toggle('theme-custom',true);
   for(const [key,value]of Object.entries(c)){app.style.setProperty('--theme-'+key,value);view.host?.style.setProperty('--theme-'+key,value);document.documentElement.style.setProperty('--home-background',c.background);}
   const vars={widgetOpacity:v.widgetOpacity+"%",menuDuration:v.menuDuration+"ms",detailDuration:v.detailDuration+"ms",focusGlow:v.focusGlow,brightness:v.brightness,blur:v.blur+'px',secondaryBlur:v.secondaryBlur+'px',gray:v.grayscale+'%',scale:v.scale/100,shade:v.shade/100,vignette:v.vignette/100,cardOpacity:v.cardOpacity/100,secondaryOpacity:v.secondaryOpacity/100,panelOpacity:v.panelOpacity/100,searchOpacity:v.searchOpacity/100,radius:v.radius+'px',border:v.border+'px',shadow:v.shadow/100,width:v.width+'px',padding:v.padding+'px',groupGap:v.groupGap+'px',cardGap:v.cardGap+'px',fontSize:v.fontSize+'px',clockSize:v.clockSize+'px',searchHeight:v.searchHeight+'px',titleSize:v.titleSize+'px'};
   for(const [key,value]of Object.entries(vars))app.style.setProperty('--visual-'+key,String(value));
   const editor=area.querySelector('.wallpaper-editor-frame');if(editor)editor.contentWindow.postMessage({type:'EDITOR_VISUALS',visuals:v,colors:c,ratio:viewport.ratio,measured:viewport.measured},new URL(editor.src).origin);
   app.style.setProperty('--visual-displayFont',`"${v.displayFont}", "Microsoft YaHei", sans-serif`);app.style.setProperty('--visual-uiFont',`"${v.uiFont}", "Microsoft YaHei", sans-serif`);
   getComputedStyle(app).color;
   app.classList.remove('theme-applying');
   for(const frame of area.querySelectorAll('.protected-settings-frame'))if(frame.getAttribute('src'))frame.contentWindow.postMessage({type:'SETTINGS_THEME',colors:c,font:v.uiFont,visuals:v},new URL(frame.src).origin);
  }
  let viewport={ratio:innerWidth/innerHeight,measured:false},viewportTimer;
  async function updateViewport(){try{const result=await call('wallpaper-viewport',{width:document.documentElement.clientWidth||innerWidth,height:innerHeight,screen:`${screen.availWidth}x${screen.availHeight}@${devicePixelRatio}`});viewport=result.measured?result:{ratio:innerWidth/innerHeight,measured:false};const frame=area.querySelector('.wallpaper-editor-frame');if(frame)frame.contentWindow.postMessage({type:'EDITOR_VIEWPORT',...viewport},new URL(frame.src).origin);}catch{/* Standalone tests and unsupported window contexts retain an explicitly uncalibrated preview. */}}
  window.addEventListener('resize',()=>{clearTimeout(viewportTimer);viewportTimer=setTimeout(updateViewport,200);});window.addEventListener('focus',updateViewport);void updateViewport();
  function newId(){return 'theme-'+crypto.randomUUID();}
  function edit(){draftDirty=true;if(draft.id==='default'){draft={...structuredClone(draft),id:newId(),muted:true,name:'默认主题副本'};}}
  async function loadDraft(analyze=false){
   const sequence=++applySequence;lastFailure='';busy=analyze;
   applyColors(draft);updateAudioButton();
   if(draft.id!=='default')await call('theme-draft',{theme:draft,session:wallpaper.sessionId});
   if(sequence!==applySequence||disposed)return;
   wallpaper.load(draft,{analyze});
  }
  function updateGreeting(){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hour12:false}).format(new Date()));view.getElementById('greeting').textContent=T.greeting(greeting,hour);}
  function row(label,control,helper){const r=h('div',undefined,'setting-row'),caption=h('div',label);if(helper)caption.append(h('small',helper));r.append(caption,control);return r;}
  function button(text,action){const b=h('button',text,'custom-button');b.type='button';b.dataset.customAction=action;return b;}
  function input(value,key,type='text'){const e=h('input',undefined,'custom-input');e.type=type;e.value=value;e.dataset.customField=key;return e;}
  function section(title){const e=h('section',undefined,'settings-section');e.append(h('h3',title,'settings-section-title'));area.append(e);return e;}
  function render(){if(view.__settingsRouter){view.__settingsRouter.render();return;}renderPage(tab());}
  function renderPage(page,append=false){
   if(!['themes','visual','greeting'].includes(page))return;
   closeThemeMenu();
   if(!append)area.replaceChildren();if(!ready){area.append(h('p','正在读取本机设置…','empty-state'));return;}
   if(page==='themes'){
    const s=section('本机主题'),grid=h('div',undefined,'theme-gallery');
    for(const theme of state.themes){
     const card=button('','use-theme');card.className='theme-tile';card.dataset.themeId=theme.id;
     card.setAttribute('aria-label',theme.name);card.setAttribute('aria-pressed',String(theme.id===state.activeId));
     card.style.setProperty('--tile-color',theme.colors.primary);card.style.backgroundColor=theme.colors.card;
     card.style.fontFamily=`"${theme.visuals.uiFont}", "Microsoft YaHei", sans-serif`;card.style.color=theme.colors.text;
     const key=JSON.stringify([theme.wallpaper,theme.id==='default'?[new Date().toDateString(),theme.colors]:null]),cached=thumbnails.get(key),thumb=h(cached?'img':'iframe',undefined,'theme-thumbnail');thumb.dataset.thumbnailKey=key;thumb.src=cached||context.resource('thumbnail.html')+'?id='+encodeURIComponent(theme.id);thumb.loading='lazy';thumb.tabIndex=-1;thumb.title=theme.name+'壁纸缩略图';thumb.setAttribute('aria-hidden','true');
     const name=h('span',theme.name,'theme-tile-name'),ring=h('span',undefined,'theme-tile-ring');
     const current=h('span',theme.id===state.activeId?'✓':'','theme-tile-current');
     card.append(thumb,name,ring,current);grid.append(card);
    }
    s.append(grid,row('编辑中的主题名称',input(draft.name,'name')));
    const actions=h('div',undefined,'custom-actions');actions.append(button('另存为新主题','new'),button('保存主题','save'),button('删除主题','delete'),button('恢复默认','default'));actions.querySelector('[data-custom-action="delete"]').disabled=draft.id==='default';s.append(actions);
    const mute=input('', 'muted', 'checkbox');mute.setAttribute('role','switch');mute.checked=draft.muted!==false;mute.setAttribute('aria-label','当前主题壁纸静音');s.append(row('当前主题壁纸静音',mute,'立即保存；新主题默认静音。'),h('p',audioBlocked?'已设置有声播放；Edge 暂时阻止自动播放。点击首页或声音按钮可重试。':'','theme-audio-status custom-help'));
    const w=section('壁纸与裁切');const editor=h('iframe',undefined,'wallpaper-editor-frame');editor.title='壁纸裁切预览';editor.src=context.resource('wallpaper-editor.html');editor.allow='autoplay';editor.onload=()=>editor.contentWindow.postMessage({type:'EDITOR_THEME',theme:draft,ratio:viewport.ratio,measured:viewport.measured},new URL(editor.src).origin);w.append(editor);
    const edge=section('Edge 配套主题');edge.append(h('p','根据当前配色生成独立主题包，解压后在 Edge 扩展页加载。首页切换主题后，浏览器配色需手动重新应用。','custom-help'),button('下载 Edge 配色主题包','edge'));
   }
   if(page==='visual'){
    const c=section('配色');if(draft.id==='default')c.append(h('p','必应默认主题配色随每日壁纸自动生成，不能手动修改。','custom-help'));const labels={background:'页面底色',primary:'主色',accent:'强调色',text:'主文字',muted:'次要文字',search:'搜索栏',card:'导航卡片',secondaryCard:'次级卡片',panel:'设置面板',border:'边框',hover:'悬停',selected:'选中',shadow:'阴影'};
    const grid=h('div',undefined,'theme-colors');for(const [key,label]of Object.entries(labels)){const e=input(draft.colors[key],'color.'+key,'color');e.setAttribute('aria-label',label);const hex=input(draft.colors[key],'color.'+key);hex.classList.add('color-hex');hex.maxLength=7;hex.pattern='#[0-9a-fA-F]{6}';hex.setAttribute('aria-label',label+'十六进制');if(draft.id==='default'){e.disabled=true;hex.disabled=true;}const pair=h('div',undefined,'color-pair');pair.append(e,hex);grid.append(row(label,pair));}c.append(grid);
    const specifications=[['背景',[['brightness','亮度',.2,1.5,.01],['blur','背景模糊',0,30,1],['secondaryBlur','次级背景模糊',0,30,1],['grayscale','灰度',0,100,1],['scale','缩放',100,150,1],['shade','遮罩强度',0,100,1],['vignette','暗角强度',0,100,1]]],['交互与小组件',[['widgetOpacity','小组件展开栏不透明度',0,100,1],['menuDuration','下拉展开动画（毫秒）',0,400,10],['detailDuration','详情切换动画（毫秒）',0,400,10],['focusGlow','输入框焦点光晕',0,60,1]]],['组件',[['cardOpacity','导航卡片不透明度',0,100,1],['searchOpacity','搜索栏不透明度',0,100,1],['secondaryOpacity','次级卡片不透明度',0,100,1],['panelOpacity','设置面板不透明度',0,100,1],['radius','圆角',0,30,1],['border','边框宽度',0,3,.5],['shadow','阴影强度',0,100,1]]],['布局',[['width','内容宽度',800,1600,10],['padding','页面边距',12,80,1],['groupGap','分组间距',10,60,1],['cardGap','卡片间距',8,40,1]]],['文字与尺寸',[['fontSize','基本字号',11,18,1],['clockSize','时间字号',24,80,1],['searchHeight','搜索栏高度',32,70,1],['titleSize','分组标题字号',12,24,1]]]];
    for(const [name,items]of specifications){const s=section(name);for(const [key,label,min,max,step]of items){const wrap=h('div',undefined,'custom-range-wrap'),e=input(draft.visuals[key],'visual.'+key,'range');e.min=min;e.max=max;e.step=step;e.setAttribute('aria-label',label);const value=input(draft.visuals[key],'visual.'+key,'number');value.min=min;value.max=max;value.step=step;value.classList.add('custom-number');value.setAttribute('aria-label',label+'数值');const reset=button('↶','visual-reset');reset.dataset.visualKey=key;reset.setAttribute('aria-label','恢复'+label+'默认值');wrap.append(e,value,reset);s.append(row(label,wrap));}}
    const f=section('字体');for(const [key,label]of [['displayFont','展示字体'],['uiFont','界面字体']]){const select=h('select',undefined,'custom-select');select.dataset.customField='visual.'+key;for(const font of ['ZJUers Josefin','Segoe UI','Noto Sans CJK SC']){const o=h('option',font);o.value=font;o.selected=draft.visuals[key]===font;select.append(o);}f.append(row(label,select,'未安装的字体使用系统后备字体。'));}f.append(button('保存当前主题','save'),h('p','调整即时预览，保存后下次打开恢复。默认主题的调整将保存为副本。','custom-help'));
   }
   if(page==='greeting'){
    const s=section('称呼与分时问候');s.append(row('称呼',input(greeting.name,'greeting.name')));for(const [key,label]of [['morning','早上'],['afternoon','下午'],['evening','晚上']])s.append(row(label,input(greeting[key],'greeting.'+key),'使用 {称呼} 插入当前称呼。'));s.append(button('保存问候','greeting-save'),button('恢复默认问候','greeting-default'));
   }
   const output=h('output',undefined,'custom-message');output.setAttribute('aria-live','polite');area.append(output);
  }
  async function persist(){const existing=state.themes.findIndex(x=>x.id===draft.id);if(existing<0&&state.themes.length>=30){message('最多保存30个主题，请先删除不需要的主题。');return;}const next=structuredClone(state);if(existing>=0)next.themes[existing]=structuredClone(draft);else next.themes.push(structuredClone(draft));next.activeId=draft.id;state=await call('themes-set',{state:next});draftDirty=false;draft=structuredClone(state.themes.find(x=>x.id===state.activeId));await loadDraft();render();message('主题已保存在本机。');}
  function downloadEdge(){const manifest=T.edgeThemeManifest(draft),text=JSON.stringify(manifest,null,2);const files={'manifest.json':text,'INSTALL.txt':'Edge 配色主题\n解压本 ZIP，在 edge://extensions 开启开发人员模式，加载解压缩的扩展并选择 manifest.json 所在文件夹。\n这是独立静态配色主题，需手动应用，不包含壁纸或账户信息。\n'};const bytes=global.HomeThemeExport.zip(files),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),a=h('a');a.href=url;a.download=global.HomeThemeExport.filename(draft.name);view.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('主题包已下载，解压后按包内说明加载。');}
  area.addEventListener('input',event=>{const e=event.target,key=e.dataset.customField;if(!key)return;
   if(key.startsWith('color.')){if(draft.id==='default')return;if(!/^#[0-9a-f]{6}$/i.test(e.value)){e.setCustomValidity('请输入六位十六进制颜色，例如 #b88bd1');e.setAttribute('aria-invalid','true');message('请输入六位十六进制颜色，例如 #b88bd1；当前配色暂未更改。');return;}e.setCustomValidity('');e.removeAttribute('aria-invalid');edit();draft.colors[key.slice(6)]=e.value.toLowerCase();e.parentElement.querySelectorAll('input').forEach(x=>{if(x!==e)x.value=e.value;});applyColors(draft);}
   else if(key.startsWith('visual.')){if(e.type==='number'&&!e.value)return;edit();const field=key.slice(7);draft.visuals[field]=['range','number'].includes(e.type)?Number(e.value):e.value;draft.visuals=T.normalizeVisuals(draft.visuals);if(e.type==='range'||e.type==='number')e.parentElement.querySelectorAll('input').forEach(control=>control.value=draft.visuals[field]);applyColors(draft);}
   else if(key.startsWith('greeting.')){greeting[key.slice(9)]=e.value;greeting=T.normalizeGreeting(greeting);updateGreeting();}
   else if(key==='name'){edit();draft.name=e.value.slice(0,80);}
  });
  area.addEventListener('change',async event=>{const key=event.target.dataset.customField;if(!key)return;try{
   if(key==='muted'){await saveMuted(event.target.checked);}
   else if(key==='theme'){draft=structuredClone(state.themes.find(x=>x.id===event.target.value)||draft);state.activeId=draft.id;state=await call('themes-set',{state});await loadDraft();render();}
   else if(key==='wallpaper.type'){edit();draft.wallpaper.type=event.target.value;render();}
   else if(key==='wallpaper.path'){edit();draft.wallpaper.path=event.target.value.trim();if(T.fileURL(draft.wallpaper.path)){await loadDraft(true);message('正在预览壁纸并生成整套配色…');}}
  }catch{message('设置读取或保存失败，请刷新首页后重试。');}});
  area.addEventListener('click',async event=>{const action=event.target.closest('[data-custom-action]')?.dataset.customAction;if(!action)return;try{
   if(action==='use-theme'){await changeTheme('select',event.target.closest('[data-theme-id]').dataset.themeId);}
   if(action==='visual-reset'){edit();const key=event.target.closest('[data-visual-key]').dataset.visualKey;draft.visuals[key]=T.defaultTheme().visuals[key];applyColors(draft);render();}
   if(action==='new'){draftDirty=true;draft={...structuredClone(draft),id:newId(),muted:true,name:draft.name+' 副本'};await loadDraft();render();message('已创建副本，点击保存主题完成保存。');}
   if(action==='save'){edit();await persist();}
   if(action==='delete'){if(draft.id==='default')return;state.themes=state.themes.filter(x=>x.id!==draft.id);state.activeId='default';state=await call('themes-set',{state});draft=structuredClone(state.themes.find(t=>t.id==='default'));await loadDraft();render();}
   if(action==='default'){state.activeId='default';state=await call('themes-set',{state});draft=structuredClone(state.themes.find(t=>t.id==='default'));await loadDraft();render();}
   if(action==='preview'){await loadDraft(true);message('正在预览并分析壁纸，请保存主题以便重启后恢复。');}
   if(action==='palette'){if(busy){message('正在分析壁纸，请稍候。');return;}edit();busy=true;await loadDraft(true);message('正在提取代表色并生成整套配色…');}
   if(action==='edge')downloadEdge();
   if(action==='greeting-save'){greeting=await call('greeting-set',{value:greeting});updateGreeting();message('问候设置已保存。');}
   if(action==='greeting-default'){greeting=await call('greeting-set',{value:T.normalizeGreeting()});updateGreeting();render();message('默认问候已恢复。');}
  }catch(error){busy=false;message(error.message||'操作失败，请重试。');}});
  const menu=h('div',undefined,'theme-context-menu preview-control');menu.hidden=true;menu.setAttribute('role','menu');app.append(menu);
  let menuThemeId='';
  function closeThemeMenu(){menu.hidden=true;}
  async function changeTheme(action,id,name){
   const next=T.manageTheme(state,action,id,name);state=await call('themes-set',{state:next});draftDirty=false;
   if(action!=='rename'||id===draft.id){draft=structuredClone(state.themes.find(x=>x.id===state.activeId));await loadDraft();}
   render();
  }
  area.addEventListener('contextmenu',event=>{
   const card=event.target.closest('.theme-tile');if(!card)return;event.preventDefault();event.stopPropagation();
   menuThemeId=card.dataset.themeId;menu.replaceChildren();
   for(const [action,label]of [['rename','重命名'],['duplicate','创建副本'],['delete','删除']]){
    const b=button(label,action);b.setAttribute('role','menuitem');b.disabled=menuThemeId==='default'&&action!=='duplicate';menu.append(b);
   }
   menu.hidden=false;menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-190))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-170))+'px';menu.querySelector('button:not(:disabled)').focus();
  });
  menu.addEventListener('click',async event=>{
   const action=event.target.dataset.customAction;if(!action)return;const id=menuThemeId;closeThemeMenu();
   try{
    if(action==='duplicate'){draft={...structuredClone(state.themes.find(x=>x.id===id)),id:newId(),muted:true,name:state.themes.find(x=>x.id===id).name+' 副本'};await persist();}
    if(action==='delete'){await changeTheme('delete',id);}
    if(action==='rename'){showRename(id);}
   }catch(error){message(error.message);}
  });
  view.addEventListener('click',event=>{if(!event.target.closest('.theme-context-menu'))closeThemeMenu();});
  area.addEventListener('scroll',closeThemeMenu,{passive:true});
  view.addEventListener('keydown',event=>{
   if(renameDialog.open&&event.key==='Escape'){event.stopImmediatePropagation();return;}
   if(menu.hidden)return;
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeThemeMenu();return;}
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();event.stopImmediatePropagation();const buttons=[...menu.querySelectorAll('button:not(:disabled)')];
    const index=buttons.indexOf(view.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;buttons[next]?.focus();
   }
  },{capture:true});
  const renameDialog=h('dialog',undefined,'theme-rename-dialog preview-control');app.append(renameDialog);
  function showRename(id){
   const theme=state.themes.find(x=>x.id===id);if(!theme||id==='default')return;
   renameDialog.replaceChildren();const form=h('form');form.method='dialog';const field=h('input',undefined,'custom-input');field.value=theme.name;field.maxLength=60;field.required=true;field.setAttribute('aria-label','新主题名称');
   const actions=h('div',undefined,'custom-actions'),save=button('保存','rename-save'),cancel=button('取消','rename-cancel');save.type='submit';cancel.onclick=()=>renameDialog.close();actions.append(save,cancel);form.append(h('h2','重命名主题'),field,actions);renameDialog.append(form);
   form.addEventListener('submit',async event=>{event.preventDefault();if(!field.value.trim()){field.setCustomValidity('请输入主题名称');field.reportValidity();return;}save.disabled=true;try{await changeTheme('rename',id,field.value);renameDialog.close();}catch(error){field.setCustomValidity(error.message);field.reportValidity();}finally{save.disabled=false;}});field.addEventListener('input',()=>field.setCustomValidity(''));renameDialog.showModal();field.focus();field.select();
  }
  view.querySelectorAll('.settings-tab').forEach(b=>b.addEventListener('click',render));
  for(const [id,parent]of [['mainFooter',view.getElementById('mainView')],['secondaryFooter',view.querySelector('.secondary-inner')]]){
   const footer=h('footer',undefined,'home-footer preview-control');footer.id=id;const base=h('a','基于 ZJUers 轻首页');base.href='https://zjuers.com/about';base.target='_blank';base.rel='noopener noreferrer';const about=button('关于','about');about.className='footer-about';footer.append(base,h('span',' · Yangkao个人定制 · '),about);parent.append(footer);about.addEventListener('click',()=>{if(!app.classList.contains('is-secondary'))context.openSecondary();context.openSettings();if(view.__settingsRouter)view.__settingsRouter.select('about');else view.querySelector('[data-tab="data"]').click();});
  }
  const dialog=h('div',undefined,'wallpaper-error preview-control');dialog.id='wallpaperError';dialog.hidden=true;dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','壁纸读取失败');const box=h('div',undefined,'wallpaper-error-box');box.append(h('h2','壁纸无法读取'),h('p'));const close=button('知道了','error-close');close.id='wallpaperErrorClose';close.onclick=()=>dialog.hidden=true;box.append(close);dialog.append(box);app.append(dialog);
  view.__customize={renderPage,isDirty:()=>draftDirty,getTheme:()=>structuredClone(draft)};
  window.addEventListener('message',event=>{if(event.data?.type!=='THEME_THUMBNAIL')return;const frame=[...area.querySelectorAll('.theme-thumbnail')].find(f=>f.tagName==='IFRAME'&&f.contentWindow===event.source&&new URL(f.src).origin===event.origin);if(!frame)return;const data=event.data.image;if(typeof data!=='string'||data.length>200000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data))return;thumbnails.set(frame.dataset.thumbnailKey,data);if(thumbnails.size>30)thumbnails.delete(thumbnails.keys().next().value);const image=h('img',undefined,'theme-thumbnail');image.alt='';image.src=data;image.setAttribute('aria-hidden','true');frame.replaceWith(image);});
  window.addEventListener('message',event=>{const frame=area.querySelector('.wallpaper-editor-frame');if(!frame||event.source!==frame.contentWindow||event.origin!==new URL(frame.src).origin)return;if(event.data?.type==='EDITOR_HEIGHT'){if(Number.isFinite(event.data.height))frame.style.height=Math.min(1600,Math.max(250,event.data.height))+'px';return;}if(event.data?.type!=='EDITOR_UPDATE')return;edit();draft.wallpaper=T.normalizeTheme({...draft,wallpaper:event.data.wallpaper}).wallpaper;if(event.data.colors)draft.colors=T.normalizeTheme({...draft,colors:event.data.colors}).colors;void loadDraft().then(()=>{applyColors(draft);if(event.data.colors){area.querySelectorAll('[data-custom-field^="color."]').forEach(e=>e.value=draft.colors[e.dataset.customField.slice(6)]);}message('壁纸已预览，请保存主题以保留更改。');}).catch(()=>message('壁纸预览失败'));});
  async function refresh(initial){const result=initial||await call('themes-get');if(disposed)return;draftDirty=false;state=result.state;greeting=result.greeting;draft=structuredClone(state.themes.find(x=>x.id===state.activeId)||T.defaultTheme());ready=true;updateGreeting();await loadDraft();render();}
  const audioButton=h('button',undefined,'theme-audio-button preview-control');audioButton.type='button';
  const audioControl=h('div',undefined,'rail-control theme-audio-control preview-control'),audioLabel=h('span','壁纸背景音乐','rail-control-detail');audioButton.classList.add('rail-control-trigger');audioControl.append(audioLabel,audioButton);const main=view.getElementById('mainView');main.append(audioControl);
  // The widget rail is created immediately after customization initializes.
  queueMicrotask(()=>view.querySelector('.widget-rail')?.append(audioControl));
  let audioBlocked=false,audioSaving=false;
  function updateAudioButton(){const image=draft.wallpaper.type!=='video';audioButton.disabled=!ready||image;const silent=draft.muted!==false||audioBlocked;audioButton.setAttribute('aria-pressed',String(!silent));const status=area.querySelector('.theme-audio-status');if(status)status.textContent=audioBlocked?'已设置有声播放；Edge 暂时阻止自动播放。点击首页或声音按钮可重试。':'';const label=image?'图片壁纸没有声音':audioBlocked?'点击开启壁纸声音':silent?'开启壁纸声音':'静音壁纸';audioButton.setAttribute('aria-label',label);audioButton.title=label;audioButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3Z"/>'+ (silent?'<path d="m16 9 6 6m0-6-6 6"/>':'<path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>')+'</svg>';}
  async function saveMuted(muted){if(audioSaving)return;audioSaving=true;const old=draft.muted;draft.muted=muted;audioBlocked=false;wallpaper.setMuted?.(muted);updateAudioButton();try{const next=structuredClone(state),i=next.themes.findIndex(t=>t.id===draft.id);if(i>=0)next.themes[i].muted=muted;else next.themes.push(structuredClone(draft));state=await call('themes-set',{state:next});const field=area.querySelector('[data-custom-field="muted"]');if(field)field.checked=muted;}catch(e){draft.muted=old;wallpaper.setMuted?.(old);updateAudioButton();message('声音设置保存失败，请重试。');}finally{audioSaving=false;}}
  audioButton.addEventListener('click',()=>void saveMuted(audioBlocked?false:draft.muted===false));
  const recoverAudio=event=>{if(!event.isTrusted||!audioBlocked||draft.muted!==false||event.target.closest?.('.theme-audio-button'))return;wallpaper.setMuted?.(false);};view.addEventListener('pointerdown',recoverAudio,{capture:true});view.addEventListener('keydown',recoverAudio,{capture:true});
  view.addEventListener('wallpaper-audio',event=>{audioBlocked=Boolean(event.detail.blocked);updateAudioButton();});
  updateAudioButton();
  const changed=notification=>{if(notification?.type==='HOME_THEME_CHANGED'){if(draftDirty){message('其他页面更新了主题；当前未保存的修改已保留。');return;}refresh().catch(()=>message('设置同步失败，请刷新。'));}};
  chrome.runtime.onMessage.addListener(changed);window.addEventListener('pagehide',()=>{disposed=true;chrome.runtime.onMessage.removeListener(changed);wallpaper.dispose();},{once:true});
  refresh(context.initialThemeSettings).catch(()=>{ready=true;draft=T.defaultTheme();applyColors(draft);wallpaper.load(draft);render();message('设置加载失败，已使用默认外观。');});
 }
 global.HomeCustomize={initialize};
})(globalThis);
