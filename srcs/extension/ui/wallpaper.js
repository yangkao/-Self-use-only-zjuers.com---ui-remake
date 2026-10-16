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
    let muted=true;
    function audio(blocked=false){root.dispatchEvent?.(new CustomEvent('wallpaper-audio',{detail:{blocked}}));}
    async function playBuiltin(){/* Static fallback has no audio. */}
    function restore() {
      frame.style.display = 'none';
      if (builtin) { builtin.style.display = '';builtin.autoplay=false;builtin.muted=true;builtin.poster=options.resource('assets/fallback.svg'); }
    }
    function send() {
      if (current && !disposed && !failed) frame.contentWindow.postMessage({ type: 'WALLPAPER_LOAD', token, requestId, themeId: current.theme.id, analyze: current.analyze,muted }, origin);
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
      if(data.status==='daily-state'){options.onDailyStatus?.(data.message||'');return;}
      if(data.status==='audio'){audio(data.blocked);return;}
      if(data.status==='playback'){options.onDailyStatus?.(data.message||'');return;}
      if (data.status === 'ready') {
        clearTimeout(timer);
        if (!current.builtin) {
          frame.style.display = '';
          if (builtin) { builtin.style.display = 'none'; builtin.pause(); }
        }
      } else if (data.status === 'error') fail('本机壁纸无法读取。请检查文件路径和扩展的文件访问权限。');
      else if (data.status === 'palette' && (current.analyze||current.theme.wallpaper.type==='bing')) {
        if (data.colors && typeof data.colors === 'object') options.onPalette?.(data.colors, { themeId: current.theme.id });
        else options.onError?.('壁纸已加载，但取色失败。已保留原配色。', { themeId: current.theme.id, analysisError: true });
      }
    }
    window.addEventListener('message', receive);
    frame.addEventListener('load', send); frame.src = url; container.append(frame);
    return {
      sessionId: token,
      setMuted(value){muted=value!==false;if(current)current.theme.muted=muted;if(!current||current.builtin||failed)void playBuiltin();else frame.contentWindow.postMessage({type:'WALLPAPER_AUDIO',token,requestId,muted},origin);},
      load(theme, { analyze = false } = {}) {
        requestId++; clearTimeout(timer); failed = false;
        muted=theme.muted!==false;audio();
        current = { theme, analyze, builtin: false };
        if(builtin)builtin.style.objectPosition=`${theme.wallpaper.crop?.x??50}% ${theme.wallpaper.crop?.y??50}%`;
        if(!current.builtin&&builtin){builtin.style.display='none';builtin.pause();if(builtin.getAttribute?.('src')){builtin.removeAttribute('src');builtin.load();}}
        frame.style.display='none';
        timer = setTimeout(() => fail('壁纸加载超时，已使用静态后备背景。'), 30000);
        send();
      },
      dispose() { disposed = true; clearTimeout(timer); window.removeEventListener('message', receive); frame.removeEventListener('load', send); frame.remove();builtin?.pause(); }
    };
  }
  const api = { initialize, accepts };
  if (typeof module !== 'undefined') module.exports = api;
  scope.HomeWallpaper = api;
})(globalThis);
