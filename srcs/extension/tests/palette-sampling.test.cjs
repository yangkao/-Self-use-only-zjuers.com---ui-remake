const { test } = require('node:test');
const assert = require('node:assert/strict');
const sampling = require('../palette-sampling.js');

test('sample times use interval midpoints, clamp bounds and reject empty ranges', () => {
  assert.deepEqual(sampling.sampleTimes(8, { frameCount: 4 }), [1, 3, 5, 7]);
  assert.deepEqual(sampling.sampleTimes(20, { mode: 'range', frameCount: 4, start: 4, end: 12 }), [5, 7, 9, 11]);
  assert.deepEqual(sampling.sampleTimes(10, { mode: 'frame', time: 20 }), [10]);
  assert.throws(() => sampling.sampleTimes(10, { mode: 'range', start: 8, end: 2 }), /range/i);
  assert.throws(() => sampling.sampleTimes(Infinity), /duration/i);
  assert.equal(sampling.sampleTimes(8, {}).length, 8);
  assert.deepEqual(sampling.sampleTimes(8, { mode: 'range', frameCount: 4, end: 0 }), [1, 3, 5, 7]);
});

test('crop follows cover aspect ratio and percent alignment', () => {
  assert.deepEqual(sampling.cropRect(400, 200, 1, { x: 100, y: 50 }), { x: 200, y: 0, width: 200, height: 200 });
  assert.deepEqual(sampling.cropRect(200, 400, 1, { x: 50, y: 0 }), { x: 0, y: 0, width: 200, height: 200 });
  assert.equal(sampling.normalizeOptions({ frameCount: 999 }).frameCount, 8);
});

class Video extends EventTarget {
  constructor({ stalled = false, paused = false } = {}) {
    super(); this.tagName = 'VIDEO'; this.videoWidth = 400; this.videoHeight = 200;
    this.readyState = 2; this.duration = 8; this.paused = paused; this._time = 0;
    this.stalled = stalled; this.seeks = []; this.listeners = 0;
  }
  addEventListener(...args) { this.listeners++; super.addEventListener(...args); }
  removeEventListener(...args) { this.listeners--; super.removeEventListener(...args); }
  get currentTime() { return this._time; }
  set currentTime(value) {
    this._time = value; this.seeks.push(value);
    if (!this.stalled) queueMicrotask(() => this.dispatchEvent(new Event('seeked')));
  }
  pause() { this.paused = true; }
  async play() { this.paused = false; }
}
function canvasFixture(alpha = 255) {
  const draws = [];
  const canvas = { width: 0, height: 0, getContext: () => ({
    clearRect() {}, drawImage(...args) { draws.push(args.slice(1)); },
    getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, alpha]) })
  }) };
  return { canvas, draws, canvasFactory: () => canvas };
}

test('video sampling is sequential, keeps black pixels and restores playing position', async () => {
  const media = new Video(); const fixture = canvasFixture();
  const frames = await sampling.collectPalettePixels(media, { frameCount: 4, ratio: 1, crop: { x: 100 }, ...fixture });
  assert.equal(frames.length, 4);
  assert.deepEqual([...frames[0]], [0, 0, 0, 255]);
  assert.deepEqual(media.seeks, [1, 3, 5, 7, 0]);
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, 0);
  assert.equal(media.listeners, 0);
  assert.deepEqual(fixture.draws[0].slice(0, 4), [200, 0, 200, 200]);
  assert.equal(fixture.canvas.width, 0);
});

test('image full-frame sampling ignores cover crop and rejects transparent output', async () => {
  const media = { tagName: 'IMG', complete: true, naturalWidth: 400, naturalHeight: 200 };
  const fixture = canvasFixture();
  assert.equal((await sampling.collectPalettePixels(media, { region: 'full', ...fixture })).length, 1);
  assert.deepEqual(fixture.draws[0].slice(0, 4), [0, 0, 400, 200]);
  await assert.rejects(sampling.collectPalettePixels(media, canvasFixture(0)), /empty/i);
});

test('aborted seek and timeout clean listeners and restore paused state', async () => {
  for (const abort of [true, false]) {
    const media = new Video({ stalled: true, paused: true });
    const controller = new AbortController();
    const pending = sampling.collectPalettePixels(media, { ...canvasFixture(), timeout: 20 }, controller.signal);
    if (abort) setTimeout(() => controller.abort(), 2);
    await assert.rejects(pending, abort ? { name: 'AbortError' } : /timed out/i);
    assert.equal(media.listeners, 0);
    assert.equal(media.currentTime, 0);
    assert.equal(media.paused, true);
  }
});

test('already aborted work neither seeks nor allocates canvas', async () => {
  const controller = new AbortController(); controller.abort();
  const media = new Video();
  await assert.rejects(sampling.collectPalettePixels(media, { canvasFactory() { throw new Error('allocated'); } }, controller.signal), { name: 'AbortError' });
  assert.deepEqual(media.seeks, []);
});

test('crop zoom keeps the crop center while full frame ignores zoom and reports progress', async () => {
  const media = { tagName: 'IMG', complete: true, naturalWidth: 400, naturalHeight: 200 };
  const fixture = canvasFixture(), progress = [];
  await sampling.collectPalettePixels(media, { ratio: 1, zoom: 1.25, crop: { x: 100 }, ...fixture, onProgress: (done, total) => progress.push([done, total]) });
  assert.deepEqual(fixture.draws[0].slice(0, 4), [220, 20, 160, 160]);
  assert.deepEqual(progress, [[1, 1]]);
  const full = canvasFixture();
  await sampling.collectPalettePixels(media, { region: 'full', zoom: 1.5, ...full });
  assert.deepEqual(full.draws[0].slice(0, 4), [0, 0, 400, 200]);
});

test('failure to restore playback rejects instead of claiming success', async () => {
  const media = new Video();
  media.play = async () => { throw new Error('playback restore failed'); };
  await assert.rejects(sampling.collectPalettePixels(media, { mode: 'frame', ...canvasFixture() }), /playback restore failed/);
});

test('decoder errors remove event handlers and preserve the original error', async () => {
  const media = new Video({ stalled: true, paused: true });
  const pending = sampling.collectPalettePixels(media, { ...canvasFixture(), timeout: 20 });
  setTimeout(() => media.dispatchEvent(new Event('error')), 2);
  await assert.rejects(pending, /decoding failed/i);
  assert.equal(media.listeners, 0);
  assert.equal(media.currentTime, 0);
  assert.equal(media.paused, true);
});

test('canvas read failures release canvas memory without hiding the error', async () => {
  const media = { tagName: 'IMG', complete: true, naturalWidth: 400, naturalHeight: 200 };
  const canvas = { getContext: () => ({ clearRect() {}, drawImage() {}, getImageData() { throw new Error('unreadable canvas'); } }) };
  await assert.rejects(sampling.collectPalettePixels(media, { canvasFactory: () => canvas }), /unreadable canvas/);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});
