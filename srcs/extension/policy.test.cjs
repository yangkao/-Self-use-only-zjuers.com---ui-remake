const { test } = require('node:test');
const assert = require('node:assert/strict');
test('direct home startup tab is watched for network failure without duplicate navigation', () => {
  const policy = require('./policy.js');
  assert.deepEqual(policy.step('watching', {type:'url',url:'https://zjuers.com/'}, 'normal'), {phase:'redirecting'});
});
const { step } = require('./policy.js');
test('new native tab redirects once, fallback remains native', () => {
  assert.deepEqual(step('watching', { type: 'url', url: 'edge://newtab/' }, 'normal'), { phase: 'redirecting', action: 'open-home' });
  assert.deepEqual(step('redirecting', { type: 'failure', url: 'https://zjuers.com/', error: 'net::ERR_NAME_NOT_RESOLVED' }, 'normal'), { phase: 'fallback', action: 'open-native' });
  assert.deepEqual(step('fallback', { type: 'url', url: 'edge://newtab/' }, 'normal'), { phase: 'fallback' });
});
test('normal user navigation and cancellation do not cause fallback', () => {
  assert.equal(step('watching', { type: 'url', url: 'https://example.org/' }, 'normal').phase, 'ignored');
  assert.equal(step('redirecting', { type: 'failure', url: 'https://zjuers.com/', error: 'net::ERR_ABORTED' }, 'normal').action, undefined);
  assert.equal(step('redirecting', { type: 'failure', url: 'https://example.org/', error: 'net::ERR_CONNECTION_REFUSED' }, 'normal').action, undefined);
});
test('simulation tests native recovery without an external failure request', () => {
  assert.equal(step('watching', { type: 'url', url: 'edge://newtab/' }, 'simulate').action, 'simulate-failure');
  assert.equal(step('redirecting', { type: 'failure', simulated: true }, 'simulate').action, 'open-native');
});
test('successful home and disabled mode do not redirect again', () => {
  assert.equal(step('redirecting', { type: 'complete', url: 'https://zjuers.com/index.html' }, 'normal').phase, 'ready');
  assert.equal(step('ready', { type: 'url', url: 'edge://newtab/' }, 'normal').action, undefined);
  assert.equal(step('watching', { type: 'url', url: 'edge://newtab/' }, 'off').action, undefined);
});
test('native backing page event must not cancel pending home failure recovery', () => {
  let state = step('watching', { type: 'url', url: 'edge://newtab/' }, 'normal');
  state = step(state.phase, { type: 'url', url: 'chrome-extension://pcpnigdkpcgemocnjhebmajldpjlbeom/newtab-ext.html' }, 'normal');
  assert.equal(state.phase, 'redirecting');
  state = step(state.phase, { type: 'failure', url: 'https://zjuers.com/', error: 'net::ERR_CONNECTION_CLOSED' }, 'normal');
  assert.deepEqual(state, { phase: 'fallback', action: 'open-native' });
  assert.equal(step(state.phase, { type: 'url', url: 'edge://newtab/' }, 'normal').action, undefined);
});
test('unrelated extension page still ends the pending attempt', () => {
  assert.equal(step('redirecting', { type: 'url', url: 'chrome-extension://another-extension/settings.html' }, 'normal').phase, 'ignored');
});
