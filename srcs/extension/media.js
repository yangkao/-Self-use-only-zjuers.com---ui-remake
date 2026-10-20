(function () {
  'use strict';
  const allowedOrigin = 'https://zjuers.com';
  const host = document.getElementById('media');
  let generation = 0, active = null, sessionToken = '', objectURL = '', latestRequest = -1, cancelers = [];
  let audioRequest=null,pendingMuted=true,playback=null,playbackTimer=null;
  let analysisController=null;
  let activeTheme=null,activeRequest=null,surfaceLayout=null,glass=null,glassSource=null,glassThemeKey='',surfaceVersion=0,vendorPromise=null;
  function glassLibrary(){
    if(globalThis.ZJGGooseSurface)return Promise.resolve();
    if(!vendorPromise)vendorPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=chrome.runtime.getURL('vendor/goose-glass.js');script.onload=()=>resolve();script.onerror=()=>{vendorPromise=null;script.remove();reject(Error('玻璃渲染器加载失败'));};document.head.append(script);});
    return vendorPromise;
  }
  function releaseGlass(){surfaceVersion++;glass?.destroy();glass=null;glassSource=null;glassThemeKey='';}
  async function syncSurface(){
    const run=++surfaceVersion,layout=surfaceLayout,request=activeRequest;
    if(!layout||!request)return;
    if(layout.material!=='liquid'){
      releaseGlass();reply(request,'surface',{effective:layout.material==='blend'?'blend':'current',reason:''});return;
    }
    if(!active)return;
    try{
      await glassLibrary();if(run!==surfaceVersion||request!==activeRequest||!active)return;
      if(!glass){glass=HomeGlassMedia.create({container:document.body,onStatus:state=>{if(activeRequest===request)reply(request,'surface',{effective:state.effective,reason:state.reason||''});}});}
      const nextTheme={...activeTheme,colors:layout.theme?.colors||activeTheme.colors,visuals:layout.theme?.visuals||activeTheme.visuals};
      const themeKey=JSON.stringify([nextTheme.visuals,nextTheme.colors,nextTheme.wallpaper]);
      glass.setLayout({...layout,visible:layout.visible!==false&&!document.hidden});
      if(glassSource!==active){glassSource=active;glass.setSource(active,nextTheme);glassThemeKey=themeKey;}
      else if(glassThemeKey!==themeKey){glassThemeKey=themeKey;glass.setTheme(nextTheme);}
    }catch(error){if(run!==surfaceVersion)return;releaseGlass();reply(request,'surface',{effective:'blend',reason:'请切换材质重试。'});}
  }
  async function play(node,request){node.muted=request.muted!==false;if(document.hidden){node.pause();return;}try{await node.play();reply(request,'audio',{blocked:false});}catch(error){if(error.name!=='NotAllowedError'||node.muted)throw error;node.muted=true;await node.play();reply(request,'audio',{blocked:true});}}
  function clean() {
    releaseGlass();
    analysisController?.abort();analysisController=null;
    clearInterval(playbackTimer);playbackTimer=null;playback?.dispose();playback=null;
    cancelers.splice(0).forEach(cancel => cancel());
    host.querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    host.replaceChildren(); active = null;audioRequest=null;if(objectURL){URL.revokeObjectURL(objectURL);objectURL='';}
  }
  function reply(request, status, extra = {}) {
    parent.postMessage({ type: 'WALLPAPER_STATUS', token: request.token, requestId: request.requestId, status, ...extra }, allowedOrigin);
  }
  function waitFor(node, success, failure, timeout = 7000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => { clearTimeout(timer); node.removeEventListener(success, good); node.removeEventListener(failure, bad); const index = cancelers.indexOf(cancel); if (index >= 0) cancelers.splice(index, 1); };
      const finish = error => { if (settled) return; settled = true; cleanup(); error ? reject(error) : resolve(); };
      const good = () => finish(); const bad = () => finish(new Error('media'));
      const cancel = () => finish(new Error('canceled'));
      const timer = setTimeout(bad, timeout);
      cancelers.push(cancel); node.addEventListener(success, good, { once: true }); node.addEventListener(failure, bad, { once: true });
    });
  }
  async function loadDaily(request,serial,theme){
    let shown=false;
    const automatic=request.themeId==='default';
    async function show(meta){
      const url=meta?await HomeBing.url(meta):chrome.runtime.getURL('assets/fallback.svg');
      if(serial!==generation){if(url.startsWith('blob:'))URL.revokeObjectURL(url);return;}
      const img=document.createElement('img'),ready=waitFor(img,'load','error');img.src=url;
      try{await ready;if(serial!==generation)return;let colors=automatic?meta?.colors:null;
        if(automatic&&!colors){const canvas=document.createElement('canvas');canvas.width=96;canvas.height=54;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,96,54);colors=HomeThemeCore.paletteFromPixels([ctx.getImageData(0,0,96,54).data]);if(meta)meta=await HomeBing.call('commit',{id:meta.id,colors});}
        if(serial!==generation)return;
        if(objectURL)URL.revokeObjectURL(objectURL);objectURL=url.startsWith('blob:')?url:'';host.replaceChildren(img);active=img;shown=true;
        if(automatic)reply(request,'palette',{colors});reply(request,'ready');void syncSurface();
        if(!automatic&&request.analyze){
          try{const colors=await analyze(url,'image',serial,theme,request);if(serial===generation)reply(request,'palette',{colors});}
          catch(_){if(serial===generation)reply(request,'palette',{message:'取色失败，保留原配色'});}
        }
      }finally{if(url.startsWith('blob:')&&objectURL!==url)URL.revokeObjectURL(url);}
    }
    const cached=await HomeBing.call('peek').catch(()=>null);
    if(cached)await show(cached).catch(()=>{});
    try{const latest=await HomeBing.call('prepare');if(serial!==generation)return;if(!shown||latest.id!==cached?.id)await show(latest);reply(request,'daily-state',{message:''});}
    catch(error){if(serial!==generation)return;if(!shown)await show(null);reply(request,'daily-state',{message:shown&&cached?'必应壁纸更新失败，正在使用缓存图片':'必应壁纸无法连接，正在使用静态后备背景'});}
  }
  async function analyze(url, type, serial, theme, request) {
    const controller = new AbortController();analysisController=controller;
    const node = document.createElement(type === 'video' ? 'video' : 'img');
    if (type === 'video') { node.muted = true; node.preload = 'auto'; node.playsInline = true; }
    try {
      const ready = waitFor(node, type === 'video' ? 'loadeddata' : 'load', 'error'); node.src = url; await ready;
      if (serial !== generation || controller.signal.aborted) throw new Error('canceled');
      const options={...theme.paletteSettings,crop:theme.wallpaper.crop,ratio:request.ratio,zoom:(theme.visuals?.scale??100)/100};
      const frames=await HomePaletteSampling.collectPalettePixels(node,options,controller.signal);
      if (serial !== generation || controller.signal.aborted) throw new Error('canceled');
      return HomeThemeCore.paletteFromPixels(frames,{...theme.paletteSettings,lockedColors:theme.lockedColors});
    } finally {
      if (type === 'video') node.pause(); node.removeAttribute('src'); if (type === 'video') node.load();
      if(analysisController===controller)analysisController=null;
    }
  }
  async function load(request) {
    const serial = ++generation;pendingMuted=request.muted!==false; clean(); let reported = false;
    const failed = () => { if (serial !== generation || reported) return; reported = true; clean(); reply(request, 'error', { message: '本机壁纸无法读取' }); };
    try {
      const [saved, session] = await Promise.all([
        chrome.storage.local.get('update1Themes'),
        chrome.storage.session.get('update1ThemeDrafts')
      ]);
      if (serial !== generation) return;
      const draft = session.update1ThemeDrafts?.[request.token]?.theme;
      const theme = draft?.id === request.themeId ? draft : saved.update1Themes?.themes?.find(item => item.id === request.themeId);
      activeTheme=theme||HomeThemeCore.defaultTheme();activeRequest=request;
      const builtin = request.themeId === 'default' || ['bing','builtin'].includes(theme?.wallpaper?.type);
      if (builtin) {
        await loadDaily(request,serial,theme);return;
      }
      if(theme?.wallpaper?.type==='solid'){
        if(!/^#[a-f0-9]{6}$/i.test(theme.wallpaper.color))throw new Error('color');
        const node=document.createElement('div');node.style.cssText='position:absolute;inset:0;pointer-events:none';node.style.backgroundColor=theme.wallpaper.color;
        host.replaceChildren(node);active=node;reply(request,'ready');void syncSurface();
        if(request.analyze)reply(request,'palette',{colors:HomeThemeCore.paletteFromSolid(theme.wallpaper.color,{...theme.paletteSettings,lockedColors:theme.lockedColors})});
        return;
      }
      if (!theme || !['image', 'video'].includes(theme.wallpaper?.type)) throw new Error('theme');
      const url = await HomeFileHandles.url(theme.wallpaper);
      if (serial !== generation){if(url.startsWith('blob:'))URL.revokeObjectURL(url);return;}if(url.startsWith('blob:'))objectURL=url;
      const type = theme.wallpaper.type;
      const node = document.createElement(type === 'video' ? 'video' : 'img');
      if (type === 'video') { node.muted = request.muted!==false; node.loop = true; node.autoplay = false; node.playsInline = true; node.preload = 'metadata'; }
      node.style.objectPosition=`${theme.wallpaper.crop?.x??50}% ${theme.wallpaper.crop?.y??50}%`;
      const ready = waitFor(node, type === 'video' ? 'loadeddata' : 'load', 'error');
      node.addEventListener('error', failed); host.append(node); active = node; node.src = url; await ready;
      if (serial !== generation) return;
      if (type === 'video'){audioRequest={...request,muted:pendingMuted};playback=HomeMediaPlayback.create(node,{visible:()=>!document.hidden,play:()=>play(node,audioRequest),onFailure:()=>reply(request,'playback',{message:'视频恢复播放失败，请点击声音控件重试或刷新页面'})});await playback.sync();if(!document.hidden)playbackTimer=setInterval(()=>void playback?.check(),2000);}
      if (serial !== generation) return;
      reply(request, 'ready');void syncSurface();
      if (request.analyze) {
        try { const colors = await analyze(url, type, serial, theme, request); if (serial === generation && !reported) reply(request, 'palette', { colors }); }
        catch (_) { if (serial === generation && !reported) reply(request, 'palette', { message: '取色失败，保留原配色' }); }
      }
    } catch (_) { failed(); }
  }
  window.addEventListener('message', event => {
    const request = event.data;
    if(event.source===parent&&event.origin===allowedOrigin&&request?.type==='WALLPAPER_SURFACE'&&request.token===sessionToken&&request.requestId===latestRequest){
      if(!['current','blend','liquid'].includes(request.material)||!Array.isArray(request.panels)||request.panels.length>100)return;
      const panels=request.panels.filter(p=>p&&[p.x,p.y,p.w,p.h,p.radius,p.opacity].every(Number.isFinite)&&p.w>0&&p.h>0&&p.w<20000&&p.h<20000).map(p=>({...p,radius:Math.max(0,Math.min(1000,p.radius)),opacity:Math.max(0,Math.min(1,p.opacity)),tint:Array.isArray(p.tint)&&p.tint.length===3?p.tint.map(v=>Math.max(0,Math.min(1,Number(v)||0))):[.1,.1,.1]}));
      surfaceLayout={material:request.material,panels,visible:request.visible===true,width:Math.max(1,Math.min(10000,Number(request.width)||innerWidth)),height:Math.max(1,Math.min(10000,Number(request.height)||innerHeight)),secondary:request.secondary===true,theme:{visuals:HomeThemeCore.normalizeVisuals(request.theme?.visuals),colors:HomeThemeCore.normalizeTheme({id:'surface',colors:request.theme?.colors}).colors}};
      void syncSurface();return;
    }
    if(event.source===parent&&event.origin===allowedOrigin&&request?.type==='WALLPAPER_AUDIO'&&request.token===sessionToken&&request.requestId===latestRequest&&typeof request.muted==='boolean'){
      pendingMuted=request.muted;if(active?.tagName==='VIDEO'&&audioRequest){audioRequest={...audioRequest,muted:request.muted};void play(active,audioRequest).catch(()=>reply(audioRequest,'audio',{blocked:true}));}return;
    }
    if (event.source !== parent || event.origin !== allowedOrigin || !request || request.type !== 'WALLPAPER_LOAD' ||
      typeof request.token !== 'string' || !/^[a-f0-9]{32}$/.test(request.token) || !Number.isSafeInteger(request.requestId) ||
      typeof request.themeId !== 'string' || typeof request.analyze !== 'boolean') return;
    if (sessionToken && request.token !== sessionToken) return;
    if (request.requestId <= latestRequest) return;
    sessionToken = request.token; latestRequest = request.requestId; load(request);
  });
  document.addEventListener('visibilitychange',()=>{void syncSurface();clearInterval(playbackTimer);playbackTimer=null;void playback?.sync();if(!document.hidden&&playback)playbackTimer=setInterval(()=>void playback?.check(),2000);});
  window.addEventListener('pagehide', () => { generation++; clean(); });
  parent.postMessage({ type: 'WALLPAPER_READY' }, allowedOrigin);
})();
