(function (scope) {
  const nativeUrls = new Set(['edge://newtab/', 'edge://newtab', 'chrome://newtab/', 'chrome://newtab']);
  // Observed in the user's Edge log: this backing-page event can arrive
  // after tabs.update has requested the home page. It is not a user exit.
  const nativeBackingUrl = 'chrome-extension://pcpnigdkpcgemocnjhebmajldpjlbeom/newtab-ext.html';
  const networkErrors = new Set([
    'net::ERR_INTERNET_DISCONNECTED', 'net::ERR_NAME_NOT_RESOLVED',
    'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_CLOSED', 'net::ERR_CONNECTION_TIMED_OUT',
    'net::ERR_TIMED_OUT', 'net::ERR_PROXY_CONNECTION_FAILED',
    'net::ERR_TUNNEL_CONNECTION_FAILED', 'net::ERR_ADDRESS_UNREACHABLE'
  ]);
  function isHome(url) {
    try { const value = new URL(url); return value.origin === 'https://zjuers.com' && ['/', '/index.html'].includes(value.pathname); }
    catch { return false; }
  }
  function step(phase, event, mode) {
    if (phase === 'watching' && event.type === 'url') {
      if (mode === 'off') return { phase: 'ignored' };
      if (isHome(event.url)) return { phase: 'redirecting' };
      if (nativeUrls.has(event.url)) return { phase: 'redirecting', action: mode === 'simulate' ? 'simulate-failure' : 'open-home' };
      if (event.url && event.url !== 'about:blank') return { phase: 'ignored' };
    }
    if (phase === 'redirecting' && event.type === 'failure' && (event.simulated || (isHome(event.url) && networkErrors.has(event.error)))) return { phase: 'fallback', action: 'open-native' };
    if (phase === 'redirecting' && event.type === 'complete' && isHome(event.url)) return { phase: 'ready' };
    if (phase === 'redirecting' && event.type === 'url' && event.url && !isHome(event.url) && !nativeUrls.has(event.url) && event.url !== nativeBackingUrl && event.url !== 'about:blank') return { phase: 'ignored' };
    return { phase };
  }
  scope.EntryPolicy = { step, isHome };
  if (typeof module !== 'undefined') module.exports = scope.EntryPolicy;
})(globalThis);
