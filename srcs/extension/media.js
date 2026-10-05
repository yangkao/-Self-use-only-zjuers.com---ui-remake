(function () {
  'use strict';
  const allowedOrigin = 'https://zjuers.com';
  const host = document.getElementById('media');
  let generation = 0, active = null, sessionToken = '', latestRequest = -1, cancelers = [];
  function clean() {
    cancelers.splice(0).forEach(cancel => cancel());
    host.querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    host.replaceChildren(); active = null;
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
      return HomeThemeCore.paletteFromPixels(frames);
    } finally {
      if (type === 'video') node.pause(); node.removeAttribute('src'); if (type === 'video') node.load();
    }
  }
  async function load(request) {
    const serial = ++generation; clean(); let reported = false;
    const failed = () => { if (serial !== generation || reported) return; reported = true; clean(); reply(request, 'error', { message: '本机壁纸无法读取' }); };
    try {
      const [saved, session] = await Promise.all([
        chrome.storage.local.get('update1Themes'),
        chrome.storage.session.get('update1ThemeDrafts')
      ]);
      if (serial !== generation) return;
      const draft = session.update1ThemeDrafts?.[request.token]?.theme;
      const theme = draft?.id === request.themeId ? draft : saved.update1Themes?.themes?.find(item => item.id === request.themeId);
      const builtin = request.themeId === 'default' || theme?.wallpaper?.type === 'builtin';
      if (builtin) {
        if (!request.analyze) return;
        reply(request, 'ready');
        try {
          const colors = await analyze(chrome.runtime.getURL('assets/wallpaper.mp4'), 'video', serial);
          if (serial === generation) reply(request, 'palette', { colors });
        } catch (_) { if (serial === generation) reply(request, 'palette', { message: '取色失败，保留原配色' }); }
        return;
      }
      if (!theme || !['image', 'video'].includes(theme.wallpaper?.type)) throw new Error('theme');
      const allowed = await new Promise(resolve => chrome.extension.isAllowedFileSchemeAccess(resolve));
      if (serial !== generation) return;
      if (!allowed) throw new Error('permission');
      const url = HomeThemeCore.fileURL(theme.wallpaper.path); if (!url) throw new Error('path');
      const type = theme.wallpaper.type;
      const node = document.createElement(type === 'video' ? 'video' : 'img');
      if (type === 'video') { node.muted = true; node.loop = true; node.autoplay = true; node.playsInline = true; node.preload = 'metadata'; }
      const ready = waitFor(node, type === 'video' ? 'loadeddata' : 'load', 'error');
      node.addEventListener('error', failed); host.append(node); active = node; node.src = url; await ready;
      if (serial !== generation) return;
      if (type === 'video') await node.play();
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
    if (event.source !== parent || event.origin !== allowedOrigin || !request || request.type !== 'WALLPAPER_LOAD' ||
      typeof request.token !== 'string' || !/^[a-f0-9]{32}$/.test(request.token) || !Number.isSafeInteger(request.requestId) ||
      typeof request.themeId !== 'string' || typeof request.analyze !== 'boolean') return;
    if (sessionToken && request.token !== sessionToken) return;
    if (request.requestId <= latestRequest) return;
    sessionToken = request.token; latestRequest = request.requestId; load(request);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && active?.tagName === 'VIDEO') active.play().catch(() => {
      // A resume failure is surfaced through the existing media error handler.
      active?.dispatchEvent(new Event('error'));
    });
  });
  window.addEventListener('pagehide', () => { generation++; clean(); });
  parent.postMessage({ type: 'WALLPAPER_READY' }, allowedOrigin);
})();
