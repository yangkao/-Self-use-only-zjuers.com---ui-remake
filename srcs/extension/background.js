importScripts('policy.js', 'replacement.js', 'core.js', 'theme-core.js', 'bing-background.js', 'external-core.js', 'details-core.js', 'providers/vpn-crypto.js', 'providers/webvpn.js', 'cc98-core.js', 'providers/cc98.js', 'providers/campus.js', 'navigation-core.js', 'widget-core.js', 'portable-core.js', 'navigation-background.js', 'external-background.js', 'widget-background.js');
let queue = Promise.resolve();
const nativeTabs = new Set();
async function record(event, details = {}) {
  const { diagnostics = [] } = await chrome.storage.session.get('diagnostics');
  diagnostics.push({time:new Date().toISOString(),event,...details});
  await chrome.storage.session.set({diagnostics:diagnostics.slice(-80)});
}
function safeUrl(value) {try {const url=new URL(value);return `${url.protocol}//${url.host}${url.pathname}`;}catch{return '';}}
function enqueue(task) { queue = queue.then(task).catch(async error => {
  console.error('首页入口处理失败',error);
  try {await record('后台处理失败',{error:error.message});}catch{}
}); }
async function transition(tabId, event) {
  const { entries = {} } = await chrome.storage.session.get('entries');
  const current = entries[tabId];
  if (!current) return;
  await record('入口事件',{tabId,phase:current.phase,type:event.type,url:safeUrl(event.url || ''),error:event.error || ''});
  const next = EntryPolicy.step(current.phase,event,'normal');
  if (next.phase === current.phase && !next.action) return;
  entries[tabId] = { ...current, phase:next.phase };
  await chrome.storage.session.set({entries});
  await record('入口状态变化',{tabId,from:current.phase,to:next.phase,action:next.action || ''});
  if (next.action === 'open-home') await chrome.tabs.update(tabId,{url:'https://zjuers.com/'});
  if (next.action === 'open-native') {
    await NativeReplacement.replaceFailedTab(chrome.tabs,tabId,async createdId => {
      nativeTabs.add(createdId);
      const { entries:latest = {} } = await chrome.storage.session.get('entries');
      latest[createdId] = {phase:'native-return'};
      await chrome.storage.session.set({entries:latest});
    });
  }
}
chrome.tabs.onCreated.addListener(tab => enqueue(async () => {
  if (tab.incognito || nativeTabs.has(tab.id)) return;
  await record('新建标签',{tabId:tab.id,url:safeUrl(tab.pendingUrl || tab.url || '')});
  const { entries = {} } = await chrome.storage.session.get('entries');
  if (entries[tab.id]?.phase === 'native-return') return;
  entries[tab.id] = {phase:'watching'};
  await chrome.storage.session.set({entries});
  await transition(tab.id,{type:'url',url:tab.pendingUrl || tab.url || ''});
}));
chrome.tabs.onUpdated.addListener((id,change,tab) => enqueue(async () => {
  if (change.url || change.status === 'loading') await transition(id,{type:'url',url:tab.pendingUrl || change.url || tab.url || ''});
}));
chrome.webNavigation.onCompleted.addListener(event => {
  if (event.frameId === 0) enqueue(() => transition(event.tabId,{type:'complete',url:event.url}));
});
chrome.webNavigation.onErrorOccurred.addListener(event => {
  if (event.frameId === 0) enqueue(() => transition(event.tabId,{type:'failure',url:event.url,error:event.error}));
});
chrome.tabs.onRemoved.addListener(id => enqueue(async () => {
  nativeTabs.delete(id);
  const {entries = {}} = await chrome.storage.session.get('entries');
  delete entries[id]; await chrome.storage.session.set({entries});
}));
chrome.action.onClicked.addListener(() => chrome.tabs.create({url:'https://zjuers.com/'}));
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (message?.type !== 'HOME_UI_STATUS' || !EntryPolicy.isHome(sender.url || '')) return;
  enqueue(async () => {
    await record('界面加载',{tabId:sender.tab?.id,stage:String(message.stage).slice(0,80),error:String(message.error || '').slice(0,300),navigationMs:Number.isFinite(message.navigationMs)?message.navigationMs:null,elapsedMs:Number.isFinite(message.elapsedMs)?message.elapsedMs:null});
    reply({ok:true});
  });
  return true;
});
chrome.runtime.onInstalled.addListener(() => enqueue(() => record('扩展已安装或更新',{version:chrome.runtime.getManifest().version})));


