/* Source-free widget configuration and wall-clock timers. All writes share the import queue. */
(function(){
 const W=HomeWidgetsCore,prefix='home-widget:';
 async function saved(){const s=await chrome.storage.local.get(['widgetState','widgetRuntime']);if(!s.widgetState){s.widgetState=W.defaults();await chrome.storage.local.set({widgetState:s.widgetState});}return {state:W.validate(s.widgetState),runtime:s.widgetRuntime||{}};}
 async function schedule(s){
  const active=new Set();let dirty=false;
  for(const i of s.state.instances){if(W.definitions[i.kind].source)continue;const r=s.runtime[i.id]||{},c=W.clock(i,r),name=prefix+i.id;
   if(c.done&&!r.notified){s.runtime[i.id]={...r,notified:true,completedAt:Date.now()};dirty=true;
    // Persist the receipt before notifying: simultaneous tabs/alarms cannot duplicate it.
    await chrome.storage.local.set({widgetRuntime:s.runtime});
    try{await chrome.notifications.create(name,{type:'basic',iconUrl:'ui/media/zjuers.png',title:i.config.name,message:i.kind==='date'?'设定的日期已到。':'计时已完成。',silent:true});}catch{}
   }else if(!c.done&&Number.isFinite(c.deadline)){active.add(name);await chrome.alarms.create(name,{when:Math.max(Date.now()+1000,c.deadline)});}
  }
  for(const a of await chrome.alarms.getAll())if(a.name.startsWith(prefix)&&!active.has(a.name))await chrome.alarms.clear(a.name);
  if(dirty)await HomeBroadcast('HOME_WIDGETS_CHANGED');return s;
 }
 globalThis.HomeWidgetsReschedule=()=>HomeMutation(async()=>schedule(await saved()));
 chrome.alarms.onAlarm.addListener(a=>{if(a.name.startsWith(prefix))void HomeWidgetsReschedule();});
 chrome.runtime.onStartup.addListener(()=>{void HomeWidgetsReschedule();});
 chrome.runtime.onInstalled.addListener(()=>{void HomeWidgetsReschedule();});
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(m?.type!=='HOME_WIDGETS')return;
  let allowed=false;try{const u=new URL(sender.url);allowed=sender.id===chrome.runtime.id&&sender.frameId===0&&u.origin==='https://zjuers.com'&&['/','/index.html'].includes(u.pathname);}catch{}
  if(!allowed){reply({ok:false,error:'不允许此操作'});return;}
  HomeMutation(async()=>{const s=await saved();if(m.action==='save'){const next=W.validate(m.state);for(const old of s.state.instances){const i=next.instances.find(i=>i.id===old.id);if(!i||i.kind!==old.kind||JSON.stringify(i.config)!==JSON.stringify(old.config))delete s.runtime[old.id];}s.state=next;await chrome.storage.local.set({widgetState:next,widgetRuntime:s.runtime});}
   else if(m.action==='timer'){const i=s.state.instances.find(i=>i.id===m.id);if(!i||W.definitions[i.kind].source||i.kind==='date')throw Error('计时组件不存在');s.runtime[i.id]=W.operate(i,s.runtime[i.id],m.operation);await chrome.storage.local.set({widgetRuntime:s.runtime});}
   else if(m.action!=='read')throw Error('未知组件操作');
   await schedule(s);if(m.action!=='read')await HomeBroadcast('HOME_WIDGETS_CHANGED');return s;
  }).then(value=>reply({ok:true,value}),e=>reply({ok:false,error:e.message}));return true;
 });
})();
