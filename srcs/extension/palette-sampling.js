(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HomePaletteSampling = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const number = (value, fallback) => Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : fallback;
  function normalizeOptions(options = {}) {
    options = options || {};
    return {
      mode: ['uniform', 'range', 'frame'].includes(options.mode) ? options.mode : 'uniform',
      frameCount: [4, 8, 16].includes(Number(options.frameCount)) ? Number(options.frameCount) : 8,
      start: Math.max(0, number(options.start, 0)),
      end: number(options.end, null),
      time: Math.max(0, number(options.time, 0)),
      region: options.region === 'full' ? 'full' : 'crop',
      ratio: Math.max(0.01, number(options.ratio, 16 / 9)),
      zoom: clamp(number(options.zoom, 1), 1, 1.5),
      crop: { x: clamp(number(options.crop?.x, 50), 0, 100), y: clamp(number(options.crop?.y, 50), 0, 100) },
      width: Math.round(clamp(number(options.width, 192), 1, 512)),
      timeout: clamp(number(options.timeout, 7000), 1, 30000)
    };
  }
  function sampleTimes(duration, options = {}) {
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video duration is unavailable or invalid');
    const settings = normalizeOptions(options);
    if (settings.mode === 'frame') return [clamp(settings.time, 0, duration)];
    const start = settings.mode === 'range' ? clamp(settings.start, 0, duration) : 0;
    const end = settings.mode === 'range' ? clamp(settings.end === 0 ? duration : (settings.end ?? duration), 0, duration) : duration;
    if (end <= start) throw new Error('Sampling range must end after its start');
    return Array.from({ length: settings.frameCount }, (_, i) => start + (i + 0.5) * (end - start) / settings.frameCount);
  }
  // Match CSS background-size: cover and percent background-position.
  function cropRect(width, height, ratio, crop = {}) {
    if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) throw new Error('Media dimensions are unavailable');
    ratio = number(ratio, 16 / 9);
    if (ratio <= 0) throw new Error('Sampling aspect ratio must be positive');
    const w = Math.min(width, height * ratio), h = Math.min(height, width / ratio);
    return { x: (width - w) * clamp(number(crop.x, 50), 0, 100) / 100,
      y: (height - h) * clamp(number(crop.y, 50), 0, 100) / 100, width: w, height: h };
  }
  function abortError() { const error = new Error('Palette sampling canceled'); error.name = 'AbortError'; return error; }
  function checkAbort(signal) { if (signal?.aborted) throw abortError(); }
  function waitFor(media, event, signal, timeout, action) {
    checkAbort(signal);
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        media.removeEventListener(event, good);
        media.removeEventListener('error', bad);
        signal?.removeEventListener('abort', canceled);
      };
      const finish = error => {
        if (settled) return;
        settled = true; cleanup(); error ? reject(error) : resolve();
      };
      const good = () => finish();
      const bad = () => finish(new Error('Media decoding failed during palette sampling'));
      const canceled = () => finish(abortError());
      const timer = setTimeout(() => finish(new Error('Palette sampling timed out waiting for ' + event)), timeout);
      media.addEventListener(event, good);
      media.addEventListener('error', bad);
      signal?.addEventListener('abort', canceled, { once: true });
      try { checkAbort(signal); if (action) action(); } catch (error) { finish(error); }
    });
  }
  async function seek(media, time, signal, timeout) {
    checkAbort(signal);
    if (!media.seeking && media.currentTime === time && media.readyState >= 2) return;
    await waitFor(media, 'seeked', signal, timeout, () => { media.currentTime = time; });
    checkAbort(signal);
    if (media.readyState < 2) await waitFor(media, 'loadeddata', signal, timeout);
  }
  /**
   * One-shot, bounded canvas sampling. Returns independent RGBA typed arrays,
   * directly accepted by HomeThemeCore.paletteFromPixels. Prefer a dedicated
   * hidden media element so the visible wallpaper never pauses or seeks.
   * The caller owns the media element and any object URL; neither is disposed here.
   */
  async function collectPalettePixels(media, options = {}, signal) {
    checkAbort(signal);
    if (!media) throw new Error('Media is required for palette sampling');
    const settings = normalizeOptions(options);
    const video = String(media.tagName || media.nodeName).toLowerCase() === 'video';
    const oldTime = video ? media.currentTime : 0, wasPaused = video ? media.paused : true;
    let canvas, failure;
    try {
      if (video) {
        media.pause();
        if (media.readyState < 1) await waitFor(media, 'loadedmetadata', signal, settings.timeout);
      } else if (!media.complete) await waitFor(media, 'load', signal, settings.timeout);
      checkAbort(signal);
      const width = video ? media.videoWidth : media.naturalWidth;
      const height = video ? media.videoHeight : media.naturalHeight;
      const rect = settings.region === 'full'
        ? cropRect(width, height, width / height)
        : cropRect(width, height, settings.ratio, settings.crop);
      if (settings.region === 'crop') {
        const w = rect.width / settings.zoom, h = rect.height / settings.zoom;
        rect.x += (rect.width - w) / 2; rect.y += (rect.height - h) / 2;
        rect.width = w; rect.height = h;
      }
      const times = video ? sampleTimes(media.duration, settings) : [0];
      canvas = options.canvasFactory ? options.canvasFactory() : media.ownerDocument?.createElement('canvas');
      if (!canvas && typeof document !== 'undefined') canvas = document.createElement('canvas');
      if (!canvas) throw new Error('Canvas is unavailable for palette sampling');
      const scale = Math.min(1, settings.width / Math.max(rect.width, rect.height));
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas 2D context is unavailable for palette sampling');
      const frames = [];
      for (const time of times) {
        checkAbort(signal);
        if (video) await seek(media, time, signal, settings.timeout);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(media, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        // Black is valid: only entirely transparent/empty decoded frames fail.
        if (!pixels?.length || !pixels.some((value, index) => index % 4 === 3 && value > 0)) throw new Error('Empty decoded frame during palette sampling');
        frames.push(new Uint8ClampedArray(pixels));
        if (typeof options.onProgress === 'function') options.onProgress(frames.length, times.length);
      }
      checkAbort(signal);
      return frames;
    } catch (error) {
      failure = error; throw error;
    } finally {
      if (canvas) { canvas.width = 0; canvas.height = 0; }
      if (video) {
        let restoreError;
        // Restoration has its own bounded wait, independent of a canceled task.
        try {
          if (Number.isFinite(oldTime) && media.currentTime !== oldTime) await seek(media, oldTime, undefined, settings.timeout);
        } catch (error) { restoreError = error; }
        try { if (wasPaused) media.pause(); else await media.play(); }
        catch (error) { if (!restoreError) restoreError = error; }
        // Preserve the primary sampling error, including AbortError.
        if (restoreError && !failure) throw restoreError;
      }
    }
  }
  return { normalizeOptions, sampleTimes, cropRect, collectPalettePixels };
});
