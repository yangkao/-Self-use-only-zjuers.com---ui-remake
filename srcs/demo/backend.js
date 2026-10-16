/* SPDX-License-Identifier: GPL-3.0-only. Web demo local adapter; no credential APIs. */
(function(root){
 'use strict';
 const node=typeof module!=='undefined',load=name=>require('../extension/'+name+'.js');
 const N=node?load('navigation-core'):root.HomeNavigation,T=node?load('theme-core'):root.HomeThemeCore,H=node?load('core'):root.HomeCore,E=node?load('external-core'):root.ExternalCore,W=node?load('widget-core'):root.HomeWidgetsCore,D=node?require('./data.js'):root.HomeDemoData;
 function resourceURL(base,path){const index=path.search(/[?#]/),name=index<0?path:path.slice(0,index),suffix=index<0?'':path.slice(index),mapping={'account.html':'frames/account.html','data.html':'frames/data.html','wallpaper-editor.html':'frames/editor.html','thumbnail.html':'frames/thumbnail.html'};return new URL((mapping[name]||'app/'+name)+suffix,base).href;}
 function create({storage,now=Date.now,baseURL='https://example.invalid/demo/',onChange=()=>{}}){
  const prefix='zjuers-demo-v1:',drafts=new Map();let queue=Promise.resolve(),snapshotDay='',snapshot;
  const get=(key,fallback)=>{try{const value=storage.getItem(prefix+key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}};
  const set=(key,value)=>storage.setItem(prefix+key,JSON.stringify(value));
  function themeState(){const state=T.normalizeState(get('themes',null));if(!get('searchOpacity20',false)){for(const theme of state.themes)theme.visuals.searchOpacity=20;set('themes',state);set('searchOpacity20',true);}state.themes[0].colors=get('bingPalette',null)||T.paletteFromPixels([[40,95,100,255],[65,123,125,255],[28,50,65,255]]);return state;}
  function widgets(){let saved=get('widgets',null);if(!saved){saved=W.defaults();saved.instances.push({id:'demo-cc98-top',kind:'cc98Top',enabled:true,config:{}});set('widgets',saved);}const state=W.validate(saved),runtime=get('runtime',{});for(const i of state.instances){const c=W.clock(i,runtime[i.id],now());if(c.done&&!runtime[i.id]?.completedAt&&runtime[i.id]?.running)runtime[i.id]={...runtime[i.id],running:false,elapsed:W.duration(i),completedAt:now(),notified:true};}set('runtime',runtime);return {state,runtime};}
  function full(){const key=D.dayOf(now());if(key!==snapshotDay){snapshotDay=key;snapshot=D.create(now(),baseURL);}return structuredClone(snapshot);}
  function notify(type){queueMicrotask(()=>onChange({type}));}
  async function handle(m){
   if(m.type==='HOME_UI_STATUS')return {};
   if(m.type==='HOME_NAV'){
    let state=N.reconcile(get('navigation',null),m.categories);
    if(m.action==='apply'){if(m.revision!==state.revision)throw Object.assign(Error('另一演示页已更新导航，请重试'),{code:'NAV_CONFLICT'});state=N.apply(state,m.op,m.categories);state.revision++;}
    else if(m.action!=='read')throw Error('未知导航操作');
    set('navigation',state);if(m.action==='apply')notify('HOME_NAV_CHANGED');return {state,groups:N.groups(state,m.categories,true)};
   }
   if(m.type==='HOME_WIDGETS'){
    const old=widgets();if(m.action==='save'){const next=W.validate(m.state),ids=new Set(next.instances.map(i=>i.id));set('widgets',next);set('runtime',Object.fromEntries(Object.entries(old.runtime).filter(([id])=>ids.has(id))));notify('HOME_WIDGETS_CHANGED');}
    else if(m.action==='timer'){const i=old.state.instances.find(i=>i.id===m.id);if(!i)throw Error('组件不存在');old.runtime[i.id]=W.operate(i,old.runtime[i.id]||{},m.operation,now());set('runtime',old.runtime);notify('HOME_WIDGETS_CHANGED');}
    else if(m.action!=='read')throw Error('未知组件操作');return widgets();
   }
   if(m.type!=='HOME_EXTERNAL')throw Error('演示不提供此扩展功能');
   const action=m.action;
   if(action==='preferences-get')return H.preferences(get('preferences',{}));
   if(action==='preferences-set'){const p=H.preferences(m.value);set('preferences',p);return p;}
   if(action==='themes-get')return {state:themeState(),greeting:T.normalizeGreeting(get('greeting',{}))};
   if(action==='themes-set'){const next=T.normalizeState(m.state);set('themes',next);return themeState();}
   if(action==='greeting-set'){const value=T.normalizeGreeting(m.value);set('greeting',value);return value;}
   if(action==='theme-draft'){drafts.set(m.session,T.normalizeTheme(m.theme));return {};}
   if(action==='wallpaper-viewport')return {ratio:m.width/m.height,measured:true};
   if(action==='snapshot'||action==='refresh'||action==='clear-cache'){if(action==='clear-cache'){snapshotDay='';}return {...E.project(full(),m.projection||'full',m.date,now()),example:true};}
   if(action==='weather-details')return full();
   if(action==='semester-details'){const state=full();if(m.date&&E.academicTerm(m.date)!==state.entries.courses.data.academicTerm)state.entries.courses=D.create(Date.parse(m.date+'T09:20:00+08:00'),baseURL).entries.courses;return state;}
   if(action==='open-account')return {demo:true};
   throw Error('在线演示不收集凭据，也不提供配置导入导出。请安装扩展后使用此功能。');
  }
  function send(message){const run=queue.catch(()=>{}).then(()=>handle(message));queue=run;return run.then(value=>({ok:true,value}),error=>({ok:false,error:error.message,code:error.code}));}
  return {send,get,set,themeState,drafts,full};
 }
 const api={create,resourceURL};root.HomeDemoBackend=api;if(node)module.exports=api;
})(globalThis);
