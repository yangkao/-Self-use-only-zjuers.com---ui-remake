(function (scope) {
  'use strict';
  function accepts(event, frame, origin, token, requestId) {
    const data = event.data;
    return event.source === frame.contentWindow && event.origin === origin && data &&
      data.type === 'WALLPAPER_STATUS' && data.token === token && data.requestId === requestId;
  }
  function initialize(root, options) {
    const container = root.matches?.('.wallpaper') ? root : root.querySelector('.wallpaper');
    if (!container) throw new Error('找不到壁纸区域');
    const builtin = container.querySelector('video');
    const frame = document.createElement('iframe');
    frame.title = '本机壁纸'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
    frame.allow = 'autoplay';
    const url = options.resource('media.html');
    const parsed = new URL(url);
    const origin = parsed.protocol + '//' + parsed.host;
    Object.assign(frame.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', pointerEvents: 'none', display: 'none' });
    const token = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');
    let requestId = 0, current = null, timer = null, disposed = false, failed = false;
    function restore() {
      frame.style.display = 'none';
      if (builtin) { builtin.style.display = ''; builtin.play()?.catch(() => {}); }
    }
    function send() {
      if (current && !disposed && !failed) frame.contentWindow.postMessage({ type: 'WALLPAPER_LOAD', token, requestId, themeId: current.theme.id, analyze: current.analyze }, origin);
    }
    function fail(message) {
      if (failed || disposed || !current) return;
      failed = true; clearTimeout(timer); restore();
      options.onError?.(message, { themeId: current.theme.id, analysisError: false });
    }
    function receive(event) {
      if (disposed || event.source !== frame.contentWindow || event.origin !== origin) return;
      if (event.data?.type === 'WALLPAPER_READY') { send(); return; }
      if (!accepts(event, frame, origin, token, requestId) || !current || failed) return;
      const data = event.data;
      if (data.status === 'ready') {
        clearTimeout(timer);
        if (!current.builtin) {
          frame.style.display = '';
          if (builtin) { builtin.style.display = 'none'; builtin.pause(); }
        }
      } else if (data.status === 'error') fail('本机壁纸无法读取。请检查文件路径和扩展的文件访问权限。');
      else if (data.status === 'palette' && current.analyze) {
        if (data.colors && typeof data.colors === 'object') options.onPalette?.(data.colors, { themeId: current.theme.id });
        else options.onError?.('壁纸已加载，但取色失败。已保留原配色。', { themeId: current.theme.id, analysisError: true });
      }
    }
    window.addEventListener('message', receive);
    frame.addEventListener('load', send); frame.src = url; container.append(frame);
    return {
      sessionId: token,
      load(theme, { analyze = false } = {}) {
        requestId++; clearTimeout(timer); failed = false;
        current = { theme, analyze, builtin: theme.wallpaper.type === 'builtin' };
        if (theme.wallpaper.type === 'builtin') {
          restore();
          if (!analyze) {
            current = null;
            frame.contentWindow.postMessage({ type: 'WALLPAPER_LOAD', token, requestId, themeId: 'default', analyze: false }, origin);
            return;
          }
        }
        timer = setTimeout(() => fail('本机壁纸加载超时。已使用默认视频壁纸。'), 15000);
        send();
      },
      dispose() { disposed = true; clearTimeout(timer); window.removeEventListener('message', receive); frame.removeEventListener('load', send); frame.remove(); restore(); }
    };
  }
  const api = { initialize, accepts };
  if (typeof module !== 'undefined') module.exports = api;
  scope.HomeWallpaper = api;
})(globalThis);
