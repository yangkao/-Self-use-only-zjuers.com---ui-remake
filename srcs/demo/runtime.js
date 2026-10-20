/* SPDX-License-Identifier: GPL-3.0-only. Standalone web runtime; not loaded by the extension. */
(()=>{
 'use strict';
 const base=new URL('./',location.href),listeners=new Set(),media=new Map(),RealDate=Date;let dailyURL=new URL('wallpaper.svg',base).href;
 let stored=localStorage.getItem('zjuers-demo-v1:clock');let clock;
 try{clock=JSON.parse(stored);}catch{}
 if(!clock){const day=new Date(RealDate.now()+8*3600000).toISOString().slice(0,10);clock={real:false,offset:RealDate.parse(day+'T09:20:00+08:00')-RealDate.now()};localStorage.setItem('zjuers-demo-v1:clock',JSON.stringify(clock));}
 const now=()=>RealDate.now()+(clock.real?0:clock.offset);
 const realFetch=globalThis.fetch.bind(globalThis);
 globalThis.fetch=(input,options)=>{const url=typeof input==='string'||input instanceof URL?String(input):input.url;if(!HomeDemoBackend.networkAllowed(base.href,url))return Promise.reject(Error('Demo network policy blocked this request'));return realFetch(input,options);};
 const resource=path=>HomeDemoBackend.resourceURL(base,path);
 const backend=HomeDemoBackend.create({storage:localStorage,now,baseURL:base.href,onChange:m=>{for(const f of listeners)f(m);}});
 const shared={base:base.href,now,resource,backend,media,
  clockMode(){return clock.real?'real':'example';},
  switchClock(){clock={real:!clock.real,offset:RealDate.parse(new Date(RealDate.now()+8*3600000).toISOString().slice(0,10)+'T09:20:00+08:00')-RealDate.now()};localStorage.setItem('zjuers-demo-v1:clock',JSON.stringify(clock));backend.set('runtime',{});location.reload();},
  reset(){for(const key of Object.keys(localStorage))if(key.startsWith('zjuers-demo-v1:'))localStorage.removeItem(key);location.reload();},
  addFile(file){const reference='demo-media-'+crypto.randomUUID();media.set(reference,URL.createObjectURL(file));return {type:file.type.startsWith('video/')?'video':'image',path:'',reference,name:file.name,crop:{x:50,y:50}};},
  mediaURL(w){return w?.type==='solid'&&/^#[0-9a-f]{6}$/i.test(w.color)?'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><path fill="'+w.color+'" d="M0 0h320v180H0z"/></svg>'):media.get(w?.reference)||dailyURL;},
  async prepareWallpaper(){
   try{
    const response=await fetch(new URL('bing.json',base),{cache:'no-cache',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('metadata');const info=await response.json(),url=new URL(info.url);if(url.protocol!=='https:'||!['cn.bing.com','www.bing.com'].includes(url.hostname)||url.pathname!=='/th')throw Error('image URL');
    const img=new Image();img.crossOrigin='anonymous';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('image timeout')),8000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('image load'));};img.src=url.href;});
    const canvas=document.createElement('canvas');canvas.width=96;canvas.height=54;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,96,54);const palette=HomeThemeCore.paletteFromPixels([ctx.getImageData(0,0,96,54).data]);backend.set('bingPalette',palette);dailyURL=url.href;shared.bing={...info,loaded:true};const credit=document.getElementById('demoCredit');credit.textContent='必应壁纸 · '+info.date+' · '+info.copyright;credit.href=info.url;credit.hidden=false;
   }catch(e){backend.set('bingPalette',null);shared.bing={loaded:false,error:e.message};shared.wallpaperWarning='必应壁纸加载失败，已使用演示壁纸。';}
  },
  theme(){return backend.themeState();},
  notify(message){document.getElementById('demoNotice').textContent=message;}
 };
 globalThis.HomeDemo=shared;
 // Only this ordinary webpage gets the compatibility object; no extension can be accessed.
 globalThis.chrome={runtime:{getURL:resource,getManifest:()=>({name:'ZJUers 个人首页 · Demo',version:'__DEMO_VERSION__'}),sendMessage:m=>backend.send(m),onMessage:{addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f)}},storage:{local:{get:async keys=>{const all={update1Themes:backend.themeState(),preferences:backend.get('preferences',{})};return Object.fromEntries((Array.isArray(keys)?keys:Object.keys(all)).filter(k=>k in all).map(k=>[k,all[k]]));}}}};
 window.addEventListener('storage',e=>{if(e.key?.startsWith('zjuers-demo-v1:'))for(const f of listeners)f({type:e.key.endsWith('navigation')?'HOME_NAV_CHANGED':e.key.endsWith('themes')?'HOME_THEME_CHANGED':'HOME_WIDGETS_CHANGED'});});
 window.addEventListener('pagehide',()=>{for(const url of media.values())URL.revokeObjectURL(url);},{once:true});
 // Fixed wallpaper is the public demo background, with matching generated colors.
 const original=HomeThemeCore.defaultTheme;
 HomeThemeCore.defaultTheme=()=>{const theme=original();return {...theme,visuals:{...theme.visuals,searchOpacity:30},colors:backend.themeState().themes[0].colors};};
})();
