/* SPDX-License-Identifier: GPL-3.0-only */
(async()=>{
 try{
  await HomeDemo.prepareWallpaper();
  const resource=HomeDemo.resource,host=document.createElement('div');host.id='zjuers-personal-host';const root=host.attachShadow({mode:'open'});host.style.visibility='hidden';document.body.prepend(host);
  const sheets=['style','controls','customization','details','widgets','navigation',...(globalThis.HomeSurface?['surfaces']:[]),...(globalThis.HomeCC98?['cc98']:[])];
  const styles=Promise.all(sheets.map(name=>new Promise((resolve,reject)=>{const e=document.createElement('link');e.rel='stylesheet';e.href=resource('ui/'+name+'.css');e.onload=resolve;e.onerror=reject;root.append(e);})));const overlay=document.createElement('style');overlay.textContent='.demo-wallpaper{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.app{min-height:100vh}';root.append(overlay);
  const [html,categories,initial]=await Promise.all([fetch(resource('ui/template.html')).then(r=>r.text()),fetch('navigation.json').then(r=>r.json()),HomeExternal.call('themes-get'),styles]);
  const template=document.createElement('template');template.innerHTML=html;root.append(template.content.cloneNode(true));root.querySelectorAll('img').forEach(i=>i.src=resource('ui/media/zjuers.png'));
  const nav=await chrome.runtime.sendMessage({type:'HOME_NAV',action:'read',categories});if(!nav.ok)throw Error(nav.error);
  const prefs=await HomeExternal.call('preferences-get');initializeHome(root,{groups:nav.value.groups,guideInfo:{href:'https://zjuers.com/welcome/',title:'原站新生宝典'},prefs,resource,categories,navigationState:nav.value.state,initialThemeSettings:initial});
  getComputedStyle(root.querySelector('.app')).color;host.dataset.themeReady='true';host.style.visibility='visible';HomeExternal.initialize(root);
  document.getElementById('demoClock').textContent=HomeDemo.clockMode()==='example'?'切换真实时间':'切换日间示例';document.getElementById('demoClock').onclick=()=>HomeDemo.switchClock();document.getElementById('demoReset').onclick=()=>{if(confirm('恢复演示默认设置？只清除这个演示网站中的设置。'))HomeDemo.reset();};
  document.getElementById('demoHelp').onclick=()=>document.getElementById('demoHelpDialog').showModal();document.getElementById('demoHelpClose').onclick=()=>document.getElementById('demoHelpDialog').close();
  HomeDemo.notify(HomeDemo.clockMode()==='example'?'全部信息为示例 · 日间演示时刻从09:20开始走时':'全部信息为示例 · 当前使用真实时间');
  if(HomeDemo.wallpaperWarning)HomeDemo.notify(HomeDemo.wallpaperWarning+' 全部信息为示例。');
  root.addEventListener('click',event=>{const a=event.composedPath().find(n=>n?.tagName==='A'&&n.href);if(!a)return;const url=HomeDemoBackend.forumResourceURL(HomeDemo.base,a.href);if(url){event.preventDefault();event.stopImmediatePropagation();window.open(url,'_blank','noopener,noreferrer');}},true);
  document.documentElement.dataset.demoReady='true';
 }catch(e){document.getElementById('demoNotice').textContent='演示加载失败：'+e.message+'。请通过HTTP服务打开，或刷新后重试。';console.error(e);}
})();
