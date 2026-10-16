(function () {
  'use strict';
  const allowedOrigin = 'https://zjuers.com';
  const host = document.getElementById('media');
  let generation = 0, active = null, sessionToken = '', objectURL = '', latestRequest = -1, cancelers = [];
  let audioRequest=null,pendingMuted=true,playback=null,playbackTimer=null;
  async function play(node,request){node.muted=request.muted!==false;if(document.hidden){node.pause();return;}try{await node.play();reply(request,'audio',{blocked:false});}catch(error){if(error.name!=='NotAllowedError'||node.muted)throw error;node.muted=true;await node.play();reply(request,'audio',{blocked:true});}}
  function clean() {
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
  async function loadDaily(request,serial){
    let shown=false;
    async function show(meta){
      const url=meta?await HomeBing.url(meta):chrome.runtime.getURL('assets/fallback.svg');
      if(serial!==generation){if(url.startsWith('blob:'))URL.revokeObjectURL(url);return;}
      const img=document.createElement('img'),ready=waitFor(img,'load','error');img.src=url;
      try{await ready;if(serial!==generation)return;let colors=meta?.colors;
        if(!colors){const canvas=document.createElement('canvas');canvas.width=96;canvas.height=54;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,96,54);colors=HomeThemeCore.paletteFromPixels([ctx.getImageData(0,0,96,54).data]);if(meta)meta=await HomeBing.call('commit',{id:meta.id,colors});}
        if(serial!==generation)return;
        if(objectURL)URL.revokeObjectURL(objectURL);objectURL=url.startsWith('blob:')?url:'';host.replaceChildren(img);active=img;shown=true;
        reply(request,'palette',{colors});reply(request,'ready');
      }finally{if(url.startsWith('blob:')&&objectURL!==url)URL.revokeObjectURL(url);}
    }
    const cached=await HomeBing.call('peek').catch(()=>null);
    if(cached)await show(cached).catch(()=>{});
    try{const latest=await HomeBing.call('prepare');if(serial!==generation)return;if(!shown||latest.id!==cached?.id)await show(latest);reply(request,'daily-state',{message:''});}
    catch(error){if(serial!==generation)return;if(!shown)await show(null);reply(request,'daily-state',{message:shown&&cached?'必应壁纸更新失败，正在使用缓存图片':'必应壁纸无法连接，正在使用静态后备背景'});}
  }
  async function analyze(url, type, serial) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const frames = [];
    const node = document.createElement(type === 'video' ? 'video' : 'img');
    if (type === 'video') { node.muted = true; node.preload = 'auto'; node.playsInline = true; }
    try {
      const ready = waitFor(node, type === 'video' ? 'loadeddata' : 'load', 'error'); node.src = url; await ready;
      const fractions = type === 'video' && Number.isFinite(node.duration) && node.duration > 0 ? [0, .25, .55, .8] : [0];
      for (const fraction of fractions) {
        if (serial !== generation) throw new Error('canceled');
        if (fraction > 0) { const seek = waitFor(node, 'seeked', 'error', 2500); node.currentTime = Math.min(node.duration - .01, node.duration * fraction); await seek; }
        context.drawImage(node, 0, 0, 32, 32); frames.push(context.getImageData(0, 0, 32, 32).data);
      }
      if(!frames.some(frame=>frame.some((value,index)=>index%4===3&&value>=128)))throw new Error('empty-frame');
      return HomeThemeCore.paletteFromPixels(frames);
    } finally {
      if (type === 'video') node.pause(); node.removeAttribute('src'); if (type === 'video') node.load();
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
      const builtin = request.themeId === 'default' || ['bing','builtin'].includes(theme?.wallpaper?.type);
      if (builtin) {
        await loadDaily(request,serial);return;
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
      reply(request, 'ready');
      if (request.analyze) {
        try { const colors = await analyze(url, type, serial); if (serial === generation && !reported) reply(request, 'palette', { colors }); }
        catch (_) { if (serial === generation && !reported) reply(request, 'palette', { message: '取色失败，保留原配色' }); }
      }
    } catch (_) { failed(); }
  }
  window.addEventListener('message', event => {
    const request = event.data;
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
  document.addEventListener('visibilitychange',()=>{clearInterval(playbackTimer);playbackTimer=null;void playback?.sync();if(!document.hidden&&playback)playbackTimer=setInterval(()=>void playback?.check(),2000);});
  window.addEventListener('pagehide', () => { generation++; clean(); });
  parent.postMessage({ type: 'WALLPAPER_READY' }, allowedOrigin);
})();
