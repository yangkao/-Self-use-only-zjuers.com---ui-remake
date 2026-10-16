/* SPDX-License-Identifier: GPL-3.0-only
 * Portions adapted with reference to nightTab by zombieFox and contributors.
 * ZJUers-specific modifications by yangkao, 2026-10-15. See THIRD_PARTY_NOTICES.md.
 */
(function(global){
 'use strict';
 function initialize(root,context){
  const area=root.getElementById('settingsBody'),nav=root.querySelector('.settings-nav'),content=root.querySelector('.settings-content');let current='home',rendering=false,opened=false,mounted=false,closeTimer;const retained=new Map();
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const groups={home:['首页','HOME'],theme:['主题与外观','APPEARANCE'],sources:['信息源','SOURCES'],data:['数据','DATA'],about:['关于','ABOUT']};
  nav.querySelectorAll('.settings-tab').forEach(e=>e.remove());
  const list=make('div',undefined,'settings-tree');nav.querySelector('.settings-nav-foot').before(list);
  const entries={};
  for(const [key,[name]]of Object.entries(groups)){
   const group=make('div',undefined,'settings-tree-group'),button=make('button',name,'settings-category'),children=make('div',undefined,'settings-subsections'),inner=make('div');button.type='button';button.dataset.category=key;button.setAttribute('aria-expanded','false');button.onclick=()=>{if(current===key){group.classList.toggle('expanded');button.setAttribute('aria-expanded',String(group.classList.contains('expanded')));}else select(key);};children.append(inner);group.append(button,children);list.append(group);entries[key]={group,button,inner};
  }
  function section(title){const s=make('section',undefined,'settings-section');s.append(make('h3',title,'settings-section-title'));area.append(s);return s;}
  function visibleSections(){return [...area.querySelectorAll('.settings-section')].filter(s=>!s.hidden).sort((a,b)=>(Number(a.style.order)||0)-(Number(b.style.order)||0));}
  function action(label,fn){const b=make('button',label,'custom-button');b.type='button';b.onclick=fn;return b;}
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){loadFrame(item.target);observer.unobserve(item.target);}},{root:content,rootMargin:'120px'}):null;
  function loadFrame(f){if(!f.isConnected||!f.dataset.page||f.getAttribute('src'))return;f.src=context.resource(f.dataset.page);}
  function frame(section,page){
   const order=['weather','campus','webvpn','cc98'].findIndex(name=>page.endsWith('section='+name));section.style.order=String(Math.max(0,order));
   const old=retained.get(page);if(old){old.style.order=section.style.order;section.remove();old.hidden=false;return old.querySelector('iframe');}
   const f=make('iframe',undefined,'protected-settings-frame');f.title=section.querySelector('h3').textContent;f.dataset.page=page;f.onload=()=>{if(f.getAttribute('src'))sendTheme(f);};section.append(f);if(observer)observer.observe(f);else loadFrame(f);return f;
  }
  function clearContent(){root.__widgets?.releaseSettings();
   for(const node of [...area.children]){
    const f=node.querySelector?.('.protected-settings-frame');
    if(f&&(f.dataset.dirty==='true'||f.dataset.busy==='true')){node.hidden=true;retained.set(f.dataset.page,node);}
    else {if(f){observer?.unobserve(f);retained.delete(f.dataset.page);}node.remove();}
   }
  }
  function sendTheme(f){const t=root.__customize.getTheme();f.contentWindow.postMessage({type:'SETTINGS_THEME',colors:t.colors,font:t.visuals.uiFont,visuals:t.visuals},new URL(f.src).origin);}
  function render(){if(!opened)return;if(rendering)return;mounted=true;rendering=true;const scroll=content.scrollTop;try{
   clearContent();root.getElementById('settingsTitle').textContent=groups[current][0];root.getElementById('settingsKicker').textContent=groups[current][1];
   if(current==='home'){
    root.__settingsBase.appearance();const s=section('主界面编辑');s.append(action('编辑主界面',()=>root.__settingsBase.editNavigation()));root.__widgets?.renderSettings(section('首页小组件'));root.__customize.renderPage('greeting',true);
   }else if(current==='theme'){root.__customize.renderPage('themes',true);root.__customize.renderPage('visual',true);const edge=[...area.querySelectorAll('.settings-section')].find(s=>s.querySelector('h3')?.textContent==='Edge 配套主题');if(edge)area.append(edge);}
   else if(current==='sources'){
    frame(section('和风天气'),'account.html?section=weather');frame(section('浙大统一身份认证'),'account.html?section=campus');frame(section('WebVPN'),'account.html?section=webvpn');
    frame(section('CC98'),'account.html?section=cc98');
   }else if(current==='data'){
    frame(section('首页配置与恢复副本'),'data.html?embedded=1');const s=section('缓存与重置'),status=make('output');status.setAttribute('aria-live','polite');s.append(action('清除信息缓存',async()=>{try{await HomeExternal.call('clear-cache');status.textContent='缓存已清除，账户配置保留。';}catch(e){status.textContent=e.message;}}),action('重置搜索与界面偏好',()=>{root.__settingsBase.reset();status.textContent='搜索与普通界面偏好已重置；主题和导航规则保留。';}),status);
   }else{
    const s=section('ZJUers 个人首页');s.append(make('p','正式版 · 0.4.0'));const links=[['页面基础：ZJUers 轻首页','https://zjuers.com/'],['设计参考：nightTab','https://github.com/zombieFox/nightTab'],['校内接入参考：Celechron','https://github.com/Celechron/Celechron'],['天气：和风天气','https://www.qweather.com/'],['名句：一言','https://hitokoto.cn/'],['权限与来源说明',context.resource('sources.html')]];for(const [name,url]of links){const row=make('p'),a=make('a',name);a.href=url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);s.append(row);}s.append(make('p','在 ZJUers 轻首页及轻首页美化基础上调整导航、主题与交互，加入次级界面和外部信息。','custom-help'));
   }
   const entry=entries[current];entry.inner.replaceChildren();visibleSections().forEach((s,i)=>{s.id='settings-section-'+current+'-'+i;const b=make('button',s.querySelector('h3')?.textContent||'设置');b.type='button';b.onclick=()=>s.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});entry.inner.append(b);});
   content.scrollTop=scroll;updateSection();
  }finally{rendering=false;}}
  function select(key){if(!groups[key])return;current=key;for(const [id,e]of Object.entries(entries)){e.group.classList.toggle('expanded',id===key);e.button.classList.toggle('active',id===key);e.button.setAttribute('aria-expanded',String(id===key));}render();content.scrollTop=0;}
  function updateSection(){const sections=visibleSections();if(!sections.length)return;const threshold=content.getBoundingClientRect().top+35;let index=0;sections.forEach((s,i)=>{if(s.getBoundingClientRect().top<=threshold)index=i;});entries[current].inner.querySelectorAll('button').forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');});}
  let scrollFrame;content.addEventListener('scroll',()=>{cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(updateSection);},{passive:true});
  window.addEventListener('message',event=>{const f=[...area.querySelectorAll('.protected-settings-frame')].find(e=>e.contentWindow===event.source&&new URL(e.src).origin===event.origin);if(!f)return;if(event.data?.type==='SETTINGS_STATE'){f.dataset.dirty=String(event.data.dirty===true);f.dataset.busy=String(event.data.busy===true);return;}if(event.data?.type==='SETTINGS_HEIGHT'&&Number.isFinite(event.data.height))f.style.height=Math.min(3000,Math.max(100,event.data.height))+'px';if(event.data?.type==='SETTINGS_ESCAPE')root.getElementById('settingsClose').click();});
  function open(){clearTimeout(closeTimer);opened=true;if(!mounted)render();}
  function close(){opened=false;closeTimer=setTimeout(()=>{if(opened)return;if(root.__customize.isDirty?.())return;clearContent();mounted=false;},400);}
  root.__settingsRouter={render,select,open,close};select('home');
 }
 global.HomeSettings={initialize};
})(globalThis);
