const test = require('node:test');
const assert = require('node:assert/strict');
const { accepts, initialize } = require('../ui/wallpaper.js');
test('wallpaper replies authenticate source, origin, token and active request', () => {
  const frame = { contentWindow: {} };
  const origin = 'chrome-extension://example';
  const event = { source: frame.contentWindow, origin, data: { type: 'WALLPAPER_STATUS', token: 'session', requestId: 3, status: 'ready' } };
  assert.equal(accepts(event, frame, origin, 'session', 3), true);
  assert.equal(accepts({ ...event, source: {} }, frame, origin, 'session', 3), false);
  assert.equal(accepts({ ...event, origin: 'https://zjuers.com' }, frame, origin, 'session', 3), false);
  assert.equal(accepts(event, frame, origin, 'another', 3), false);
  assert.equal(accepts(event, frame, origin, 'session', 4), false);
});
test('failed load restores builtin once; stale reply and disposed listeners cannot change it', () => {
  const previous = { window: global.window, document: global.document, crypto: global.crypto };
  const listeners = new Map(); const posted = [];
  const builtin = { style: {}, play: () => Promise.resolve(), pause() { assert.equal(this.style.display, 'none'); } };
  const frame = { style: {}, contentWindow: { postMessage: data => posted.push(data) }, setAttribute() {}, addEventListener() {}, removeEventListener() {}, remove() { this.removed = true; } };
  global.window = { addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: type => listeners.delete(type) };
  global.document = { createElement: () => frame };
  const container = { matches: () => true, querySelector: () => builtin, append() {} };
  const errors = []; const palettes = [];
  const controller = initialize(container, { resource: file => 'chrome-extension://test/' + file, onError: (...args) => errors.push(args), onPalette: colors => palettes.push(colors) });
  assert.match(controller.sessionId, /^[a-f0-9]{32}$/);
  const emit = (request, status, extra = {}) => listeners.get('message')({ source: frame.contentWindow, origin: 'chrome-extension://test', data: { ...request, type: 'WALLPAPER_STATUS', status, ...extra } });
  try {
    controller.load({ id: 'first', wallpaper: { type: 'image' } }); const first = posted.at(-1);
    controller.load({ id: 'second', wallpaper: { type: 'video' } }, { analyze: true }); const second = posted.at(-1);
    assert.equal('path' in second, false);
    emit(first, 'error'); assert.equal(errors.length, 0);
    emit(second, 'ready'); assert.equal(builtin.style.display, 'none');
    emit(second, 'palette', { message: 'analysis failed' });
    assert.equal(errors[0][1].analysisError, true); assert.equal(builtin.style.display, 'none');
    emit(second, 'error'); emit(second, 'error');
    assert.equal(errors.length, 2); assert.equal(frame.style.display, 'none'); assert.equal(builtin.style.display, '');
    emit(second, 'palette', { colors: {} }); assert.equal(palettes.length, 0);
    controller.load({ id: 'builtin-copy', wallpaper: { type: 'builtin' } }, { analyze: true });
    const third = posted.at(-1);
    assert.equal(third.themeId, 'builtin-copy'); assert.equal(third.analyze, true);
    emit(third, 'ready'); assert.equal(frame.style.display, 'none'); assert.equal(builtin.style.display, '');
    emit(third, 'palette', { colors: { accent: '#abcdef' } });
    assert.deepEqual(palettes, [{ accent: '#abcdef' }]);
    controller.dispose(); assert.equal(listeners.size, 0); assert.equal(frame.removed, true);
  } finally {
    controller.dispose(); global.window = previous.window; global.document = previous.document;
  }
});
