/* One queue covers navigation writes and portable imports across all open tabs. */
let homeMutationQueue=Promise.resolve();
globalThis.HomeMutation=task=>{const work=homeMutationQueue.catch(()=>{}).then(task);homeMutationQueue=work;return work;};
globalThis.HomeBroadcast=async type=>{try{const tabs=await chrome.tabs.query({url:'https://zjuers.com/*'});await Promise.allSettled(tabs.map(tab=>chrome.tabs.sendMessage(tab.id,{type})));}catch{}};
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message?.type!=='HOME_NAV')return;
 let allowed=false;try{const u=new URL(sender.url);allowed=sender.id===chrome.runtime.id&&sender.frameId===0&&u.origin==='https://zjuers.com'&&['/','/index.html'].includes(u.pathname);}catch{}
 if(!allowed){reply({ok:false,error:'不允许此操作'});return;}
 HomeMutation(async()=>{
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  if(JSON.stringify(message.categories).length>2*1024*1024)throw Error('导航数据过大');
  const saved=await chrome.storage.local.get(['navigationState','preferences']);
  let state=HomeNavigation.reconcile(saved.navigationState,message.categories);
  if(!saved.navigationState)HomeNavigation.defaults.forEach((g,i)=>{if(saved.preferences?.remember!==false&&saved.preferences?.folds?.[i])state.folds[g.id]=true;});
  if(message.action==='apply'){
   if(message.revision!==state.revision)throw Object.assign(Error('另一页面已更新导航，请关闭编辑窗口后重试'),{code:'NAV_CONFLICT'});
   state=HomeNavigation.apply(state,message.op,message.categories);
  }else if(message.action!=='read')throw Error('未知导航操作');
  if(JSON.stringify(state)!==JSON.stringify(saved.navigationState)){state.revision++;await chrome.storage.local.set({navigationState:state,update2SchemaVersion:1});}
  if(message.action==='apply')await HomeBroadcast('HOME_NAV_CHANGED');
  return {state,groups:HomeNavigation.groups(state,message.categories,true)};
 }).then(value=>reply({ok:true,value}),error=>reply({ok:false,error:error.message||'导航保存失败',...(error.code?{code:error.code}:{})}));return true;
});
