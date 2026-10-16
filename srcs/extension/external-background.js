/* Background-only credentials, normalized data and shared request scheduling. */
(function(){
 'use strict';
 const E=ExternalCore,minute=60000,limit=E.pool(2);
 const ttl={now:20*minute,daily:60*minute,rain:10*minute,courses:60*minute,exams:60*minute,assignments:15*minute,quote:0,hourly:60*minute,daily7:60*minute,rainDetail:10*minute,alerts:10*minute,air:30*minute,cc98:2*minute,cc98Top:5*minute};
 let cc98Configured=false;
 const autoRuns=new Map();let broadcastTimer;function changed(){if(typeof HomeBroadcast!=='function')return;clearTimeout(broadcastTimer);broadcastTimer=setTimeout(()=>void HomeBroadcast('HOME_DATA_CHANGED'),80);}
 let store,config={},writes=Promise.resolve(),loading,mutations=Promise.resolve();
 const scopes={campus:{epoch:0,controllers:new Set()},weather:{epoch:0,controllers:new Set()},quote:{epoch:0,controllers:new Set()},webvpn:{epoch:0,controllers:new Set()}};
 const campusKeys=['courses','exams','assignments'],weatherKeys=['now','daily','rain','hourly','daily7','rainDetail','alerts','air'];
 function allCampusKeys(){return [...campusKeys,...Object.keys(store?.entries||{}).filter(k=>k.startsWith('courses:'))];}
 function courseKey(date){return 'courses:'+E.academicTerm(date?date+'T12:00:00+08:00':Date.now());}
 function cancel(scope){const s=scopes[scope];s.epoch++;for(const controller of s.controllers)controller.abort();s.controllers.clear();}
 const storageReady=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
 storageReady.catch(()=>{});
 function initialize(){return loading||(loading=(async()=>{
  const loaded=await chrome.storage.local.get(['externalCache','privateConfig','cc98PrivateRefresh']);config=loaded.privateConfig||{};cc98Configured=!!(loaded.cc98PrivateRefresh?.refresh&&loaded.cc98PrivateRefresh.clientId===(config.cc98?.clientId||'2dcb3ae1-c60b-4fb1-66d5-08df2824e910'));
  const entries=loaded.externalCache||{};for(const item of Object.values(entries))if(item.status==='loading')item.status=item.data?'ready':'error';
  store=E.cache({entries,save:async data=>{const snapshot=structuredClone(data);writes=writes.catch(()=>{}).then(()=>chrome.storage.local.set({externalCache:snapshot}));await writes;changed();}});
 })());}
 async function request(url,options={}){
  const parsed=new URL(url);const calendar=parsed.origin==='http://calendar.celechron.top'&&/^\/\d{4}-\d{4}-[12]\.json$/.test(parsed.pathname);
  let weatherAllowed=false;
  if(config.weather?.host&&parsed.hostname===config.weather.host){try{weatherAllowed=E.weatherHost(parsed.hostname)===parsed.hostname;}catch{}}
  const permitted=calendar||parsed.protocol==='https:'&&(['zjuam.zju.edu.cn','zdbk.zju.edu.cn','courses.zju.edu.cn','identity.zju.edu.cn','yjsy.zju.edu.cn','v1.hitokoto.cn','webvpn.zju.edu.cn'].includes(parsed.hostname)||weatherAllowed);
  if(!permitted)throw E.problem('请求地址不在已授权的信息源内');
  const scope=scopes[parsed.hostname==='webvpn.zju.edu.cn'?'webvpn':parsed.hostname==='v1.hitokoto.cn'?'quote':parsed.hostname.endsWith('.qweatherapi.com')?'weather':'campus'],epoch=scope.epoch;
  return limit(async()=>{
   if(epoch!==scope.epoch)throw E.problem('请求已取消','cancelled');
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),18000);
   scope.controllers.add(controller);
   try{
    const response=await fetch(url,{...options,...(calendar?{credentials:'omit',redirect:'error'}:{}),signal:controller.signal});
    if(response.type==='opaqueredirect')return response;
    const text=await response.text();
    if(response.status===429)throw E.problem('信息源请求受限，稍后再试','rate-limit');
    const copy=new Response([204,205,304].includes(response.status)?null:text,{status:response.status,statusText:response.statusText,headers:response.headers});
    Object.defineProperty(copy,'url',{value:response.url});return copy;
   }finally{clearTimeout(timeout);scope.controllers.delete(controller);}
  });
 }
 function serviceCallback(service){
  if(service!=='https://yjsy.zju.edu.cn/')return Promise.reject(E.problem('研究生认证地址不匹配'));
  const cas='https://zjuam.zju.edu.cn/cas/login?service='+encodeURIComponent(service);
  return new Promise((resolve,reject)=>{
   let done=false,requestId;
   const cleanup=()=>{clearTimeout(timeout);chrome.webRequest.onBeforeRequest.removeListener(before);chrome.webRequest.onHeadersReceived.removeListener(headers);};
   const finish=(value,error)=>{if(done)return;done=true;cleanup();error?reject(error):resolve(value);};
   const before=details=>{if(details.url===cas&&details.tabId===-1&&(!details.initiator||details.initiator===chrome.runtime.getURL('').replace(/\/$/,'')))requestId=details.requestId;};
   const headers=details=>{if(details.requestId!==requestId)return;const raw=details.responseHeaders?.find(h=>h.name.toLowerCase()==='location')?.value;if(!raw)return;try{const u=new URL(raw,cas);if(u.origin===service.slice(0,-1)&&u.pathname==='/'&&u.searchParams.get('ticket'))finish(u.href);}catch{}};
   const timeout=setTimeout(()=>finish(null,E.problem('研究生认证跳转暂不可用')),20000);
   chrome.webRequest.onBeforeRequest.addListener(before,{urls:['https://zjuam.zju.edu.cn/cas/login*'],types:['xmlhttprequest']});
   chrome.webRequest.onHeadersReceived.addListener(headers,{urls:['https://zjuam.zju.edu.cn/cas/login*'],types:['xmlhttprequest']},['responseHeaders']);
   request(cas,{credentials:'include',redirect:'manual'}).then(()=>{if(!done)finish(null,E.problem('研究生系统未返回认证票据'));},()=>finish(null,E.problem('研究生认证跳转暂不可用')));
  });
 }
 const vpn=globalThis.WebVPNProvider?.create({request,credentials:()=>config.webvpn});
 const cc98=globalThis.CC98Provider?.create({request,vpn,storage:chrome.storage,clientId:()=>config.cc98?.clientId||'2dcb3ae1-c60b-4fb1-66d5-08df2824e910'});
 const campus=CampusProvider.create({request,now:()=>Date.now(),serviceCallback});
 async function weather(path,params={}){
  const cfg=config.weather;if(!cfg?.key||!cfg?.host)throw E.problem('请在设置中配置和风天气','configuration');
  const url=new URL('https://'+E.weatherHost(cfg.host)+path);for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  const response=await request(url.href,{headers:{'X-QW-Api-Key':cfg.key},credentials:'omit',redirect:'error'});
  if(!response.ok)throw E.problem(`和风天气请求失败（HTTP ${response.status}）`);
  const data=await response.json();if(data.code&&String(data.code)!=='200')throw E.problem(data.code==='204'?'当前地点暂无此类天气数据':`和风天气返回状态 ${String(data.code).slice(0,8)}`,data.code==='204'?'no-coverage':'unavailable');
  return data;
 }
 const providers={
  now:async()=>{const p=location();return E.weatherNow(await weather(`/weather/v1/current/${p.lat}/${p.lon}`,{lang:'zh',localTime:true}));},
  daily:async()=>{const p=location();return E.weatherDaily(await weather(`/weather/v1/daily/${p.lat}/${p.lon}`,{lang:'zh',localTime:true,days:3}));},
  rain:async()=>{const p=location();const d=await weather('/v7/minutely/5m',{location:`${Number(p.lon).toFixed(2)},${Number(p.lat).toFixed(2)}`,lang:'zh'});if(!d.summary)throw E.problem('当前地点暂无短时降水信息','no-coverage');return {summary:d.summary,...(Array.isArray(d.minutely)?{points:d.minutely.slice(0,36).map(p=>({time:p.fxTime,precipitation:Number.isFinite(Number(p.precip))?Number(p.precip):null,type:p.type})),updateTime:d.updateTime}:{}),attributions:d.refer?.sources||[]};},
  daily7:async()=>{const p=location();return HomeDetailsCore.daily(await weather(`/weather/v1/daily/${p.lat}/${p.lon}`,{lang:'zh',localTime:true,days:7}));},
  hourly:async()=>{const p=location();return HomeDetailsCore.hourly(await weather(`/weather/v1/hourly/${p.lat}/${p.lon}`,{lang:'zh',localTime:true,hours:24}));},
  rainDetail:async()=>providers.rain(),
  alerts:async()=>{const p=location();return HomeDetailsCore.alerts(await weather(`/weatheralert/v1/current/${p.lat}/${p.lon}`,{lang:'zh',localTime:true}));},
  air:async()=>{const p=location();return HomeDetailsCore.air(await weather(`/airquality/v1/current/${p.lat}/${p.lon}`,{lang:'zh'}));},
  cc98:async()=>{if(!cc98)throw E.problem('CC98 模块未加载');try{return await cc98.unread();}catch(error){if(error.code==='auth-expired'||error.code==='configuration')cc98Configured=false;throw error;}},
  cc98Top:async()=>{if(!cc98)throw E.problem('CC98 模块未加载');try{return await cc98.top();}catch(error){if(error.code==='auth-expired'||error.code==='configuration')cc98Configured=false;throw error;}},
  quote:async()=>{const response=await request('https://v1.hitokoto.cn/?c=k',{credentials:'omit',redirect:'error'});if(!response.ok)throw E.problem(`一言暂不可用（HTTP ${response.status}）`,response.status===403?'rate-limit':'unavailable');return E.quote(await response.json());}
 };
 function location(){const p=config.weather?.location;if(!p||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon)))throw E.problem('请在天气设置中选择地点','configuration');return p;}
 for(const key of ['courses','exams','assignments'])providers[key]=async (force,date)=>{
  if(!config.campus?.username||!config.campus?.password)throw E.problem('请先配置校内账户','configuration');
  const epoch=scopes.campus.epoch;
  const onPartial=data=>{if(epoch===scopes.campus.epoch){const cacheKey=courseKey(date);store.entries[cacheKey]={data,status:'loading',updatedAt:Date.now()};}};
  try{return await campus[key](config.campus,{force,date,...(key==='courses'?{onPartial}:{})});}catch(error){throw E.problem(error.publicMessage||'校内信息获取失败，请检查登录状态',error.code||'unavailable');}
 };
 function status(){return {cc98Configured,campusConfigured:!!config.campus?.username,weatherConfigured:!!config.weather?.key,location:config.weather?.location||null,version:chrome.runtime.getManifest().version};}
 function snapshot(date,projection='full'){const entries=Object.fromEntries(Object.keys(providers).map(k=>[k,store.entries[k]]));entries.courses=store.entries[courseKey(date)]||store.entries.courses;if(store.entries.rain?.data?.points)entries.rainDetail=store.entries.rain;return E.project({entries,config:status()},projection,date);}
 async function refresh(keys,force,date){
  const update=async key=>{
   if(key==='rainDetail'&&!force){const old=store.entries.rainDetail;if(old?.status==='ready'&&Array.isArray(old.data?.points)&&Date.now()-old.updatedAt<ttl.rainDetail&&(!store.entries.rain?.data?.points||old.updatedAt>store.entries.rain.updatedAt))return old;}
   if(key==='daily'&&!force){const seven=store.entries.daily7;if(seven?.status==='ready'&&Date.now()-seven.updatedAt<ttl.daily7){store.entries.daily={...seven,data:{...seven.data,days:seven.data.days.slice(0,3)}};return store.entries.daily;}}
   const canonical=key==='rainDetail'?'rain':key,cacheKey=canonical==='courses'?courseKey(date):canonical;
   const legacy=key==='rainDetail'&&store.entries.rain?.data&&!Array.isArray(store.entries.rain.data.points);
   const entry=await store.get(cacheKey,ttl[key],async()=>{
   const started=Date.now();let status='ready';
   try{return await providers[canonical](force,date);}
   catch(error){status='error';throw error;}
   finally{if(typeof record==='function')void record('外部来源更新',{source:key,status,durationMs:Date.now()-started}).catch(()=>{});}
  },{force:force||legacy});return entry;};
  const jobs=keys.filter(k=>k!=='exams').map(update);
  if(keys.includes('exams'))jobs.push((async()=>{if(keys.includes('courses'))await jobs[keys.filter(k=>k!=='exams').indexOf('courses')];return update('exams');})());
  return Promise.all(jobs);
 }
 async function persistConfig(){await chrome.storage.local.set({privateConfig:config});}
 async function clear(keys){store.clear(keys);await writes;await chrome.storage.local.set({externalCache:structuredClone(store.entries)});}
 function trusted(sender){return sender.id===chrome.runtime.id&&['account.html','data.html'].some(page=>sender.url?.split('?')[0].split('#')[0]===chrome.runtime.getURL(page));}
 function home(sender){try{const u=new URL(sender.url);return sender.id===chrome.runtime.id&&u.origin==='https://zjuers.com'&&['/','/index.html'].includes(u.pathname)&&sender.frameId===0;}catch{return false;}}
 async function notifyThemes(skipTabId){
  if(!chrome.tabs.query||!chrome.tabs.sendMessage)return;
  try{const tabs=await chrome.tabs.query({url:['https://zjuers.com/*']});await Promise.allSettled(tabs.filter(tab=>tab.id!==skipTabId).map(tab=>chrome.tabs.sendMessage(tab.id,{type:'HOME_THEME_CHANGED'})));}catch{}
 }
 const publicActions=new Set(['snapshot','refresh','preferences-get','preferences-set','open-account','clear-cache','logout','themes-get','themes-set','theme-draft','greeting-set','open-data','wallpaper-viewport','weather-details','semester-details']);
 async function handle(message,sender){
  await storageReady;
  const action=message.action,own=trusted(sender);if(!own&&(!home(sender)||!publicActions.has(action)))throw E.problem('不允许此操作');
  if(action==='wallpaper-viewport'){
   if(!home(sender)||!Number.isInteger(sender.tab?.windowId))throw E.problem('请从首页读取窗口尺寸');
   const key=String(message.screen||'');if(!/^\d+x\d+@[\d.]+$/.test(key)||key.length>60)throw E.problem('屏幕参数无效');
   const saved=(await chrome.storage.local.get('wallpaperViewport')).wallpaperViewport;
   const win=await chrome.windows.get(sender.tab.windowId),width=message.width,height=message.height;
   if(win.state==='maximized'&&Number.isFinite(width)&&Number.isFinite(height)&&width>=300&&height>=200&&width<=20000&&height<=20000){
    const value={screen:key,width,height,ratio:width/height};if(JSON.stringify(saved)!==JSON.stringify(value))await chrome.storage.local.set({wallpaperViewport:value});return {...value,measured:true};
   }
   return saved?.screen===key?{...saved,measured:true}:{measured:false};
  }
  if(action==='themes-get'){
   const saved=await chrome.storage.local.get(['update1Themes','update1Greeting','preferences','themeAudioMigration1']);
   const state=HomeThemeCore.normalizeState(saved.update1Themes,saved.preferences);
   if(typeof HomeBingBackground!=='undefined'){const daily=await HomeBingBackground.peek();if(daily?.colors)state.themes[0].colors=daily.colors;}
   if(JSON.stringify(state)!==JSON.stringify(saved.update1Themes))await chrome.storage.local.set({update1Themes:state});
   if(!saved.themeAudioMigration1){if(saved.update1Themes)for(const theme of state.themes)theme.muted=false;await chrome.storage.local.set({update1Themes:state,themeAudioMigration1:true});}
   return {state,greeting:HomeThemeCore.normalizeGreeting(saved.update1Greeting)};
  }
  if(action==='themes-set'){
   if(Array.isArray(message.state?.themes)&&message.state.themes.length>30)throw E.problem('最多保存30个主题，请先删除不需要的主题');
   const state=HomeThemeCore.normalizeState(message.state);
   if(typeof HomeBingBackground!=='undefined'){const daily=await HomeBingBackground.peek();state.themes[0].colors=daily?.colors||HomeThemeCore.defaultTheme().colors;}
   await chrome.storage.local.set({update1Themes:state});await notifyThemes(sender.tab?.id);return state;
  }
  if(action==='theme-draft'){
   const theme=HomeThemeCore.normalizeTheme(message.theme);
   if(theme.id==='default')throw E.problem('请另存为自定义主题');
   if(typeof message.session!=='string'||!/^[a-f0-9]{32}$/.test(message.session))throw E.problem('主题会话无效，请刷新首页');
   const saved=await chrome.storage.session.get('update1ThemeDrafts');
   const drafts=saved.update1ThemeDrafts||{};drafts[message.session]={theme,updatedAt:Date.now()};
   const sorted=Object.entries(drafts).sort((a,b)=>b[1].updatedAt-a[1].updatedAt).slice(0,20);
   await chrome.storage.session.set({update1ThemeDrafts:Object.fromEntries(sorted)});return {};
  }
  if(action==='greeting-set'){
   const greeting=HomeThemeCore.normalizeGreeting(message.value);
   await chrome.storage.local.set({update1Greeting:greeting});await notifyThemes(sender.tab?.id);return greeting;
  }
  if(action==='preferences-get')return (await chrome.storage.local.get('preferences')).preferences||{};
  if(action==='preferences-set'){await chrome.storage.local.set({preferences:HomeCore.preferences(message.value)});return {};}
  await initialize();
  if(action==='open-data'){await chrome.tabs.create({url:chrome.runtime.getURL('data.html')});return {};}
  if(action.startsWith('portable-')){
   if(sender.url?.split('?')[0].split('#')[0]!==chrome.runtime.getURL('data.html'))throw E.problem('请从首页配置页面操作');
   const saved=await chrome.storage.local.get(['preferences','update1Themes','update1Greeting','navigationState','privateConfig','update2ImportBackup','widgetState']);
   if(action==='portable-export')return HomePortable.exportConfig(saved);
   if(action==='portable-backup')return saved.update2ImportBackup||null;
   if(!['portable-import','portable-restore'].includes(action))throw E.problem('未知配置操作');
   const file=action==='portable-restore'?saved.update2ImportBackup:message.data;
   if(!file)throw E.problem('暂无导入前副本');
   let update;try{update=HomePortable.prepare(saved,file);}catch(error){throw E.problem(error.message);}
   // Validate everything before any mutation; snapshot and replacement share one storage write.
   cancel('weather');await writes;
   const entries=structuredClone(store.entries);for(const key of weatherKeys)delete entries[key];
   await chrome.storage.local.set({...update,externalCache:entries});
   config=update.privateConfig;store.clear(weatherKeys);
   for(const alarm of await chrome.alarms.getAll())if(alarm.name.startsWith('home-widget:'))await chrome.alarms.clear(alarm.name);
   await HomeBroadcast('HOME_CONFIG_CHANGED');return {applied:true};
  }
  const date=message.date;
  if(date!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(String(date))||!Number.isFinite(Date.parse(date+'T12:00:00+08:00'))))throw E.problem('课表日期无效');
  if(action==='weather-details'){
   const layers={primary:['now','daily7','rainDetail','alerts'],hourly:['hourly'],auxiliary:['air']};
   const keys=layers[message.layer];if(!keys)throw E.problem('天气详情层级无效');
   await refresh(keys,message.force===true);return snapshot();
  }
  if(action==='semester-details'){
   const entry=store.entries[courseKey(date)];await refresh(['courses'],message.force===true||!!(entry?.data&&!entry.data.calendar),date);return snapshot(date);
  }
  if(action==='snapshot')return snapshot(date,message.projection);
  if(action==='open-account'){await chrome.tabs.create({url:chrome.runtime.getURL('account.html')});return {};}
  if(action==='refresh'){
   const keys=(Array.isArray(message.keys)?message.keys:['now','daily','rain','courses','assignments','exams']).filter(k=>Object.hasOwn(providers,k));
   if(message.force&&keys.some(k=>campusKeys.includes(k))){cancel('campus');campus.reset();store.invalidate(allCampusKeys());}
   const unique=[...new Set(keys)];
   if(message.automatic===true&&!message.force){
    const identity=JSON.stringify([unique.slice().sort(),courseKey(date),scopes.weather.epoch,scopes.campus.epoch]);
    const previous=autoRuns.get(identity);if(previous&&Date.now()-previous.at<30000)await previous.work;
    else {const entry={at:Date.now(),work:refresh(unique,false,date)};autoRuns.set(identity,entry);for(const [key,value]of autoRuns)if(Date.now()-value.at>60000)autoRuns.delete(key);await entry.work;}
   }else await refresh(unique,message.force===true,date);
   return snapshot(date,message.projection);
  }
  if(action==='clear-cache'){for(const scope of Object.keys(scopes))cancel(scope);await clear();return snapshot();}
  if(action==='logout'){cancel('campus');delete config.campus;campus.reset();await persistConfig();await clear(allCampusKeys());return snapshot();}
  if(action==='webvpn-connect'){if(!vpn)throw E.problem('WebVPN 模块未加载');return vpn.ensure(true);}
  if(action==='cc98-status'){if(!cc98)throw E.problem('CC98 模块未加载');return {...await cc98.status(),clientId:config.cc98?.clientId||'2dcb3ae1-c60b-4fb1-66d5-08df2824e910',vpn:vpn.status(),entry:store.entries.cc98||null};}
  if(action==='cc98-start')return cc98.start();
  if(action==='cc98-poll'){const result=await cc98.poll();if(result.status==='ready'){cc98Configured=true;await refresh(['cc98'],true);}return result;}
  if(action==='cc98-forget'){cc98Configured=false;await cc98.forget();await clear(['cc98','cc98Top']);return {};}
  if(action==='cc98-client'){const id=String(message.clientId||'').trim();if(!/^[a-zA-Z0-9._-]{1,120}$/.test(id))throw E.problem('CC98 应用 ID 无效');if(id!==config.cc98?.clientId){cc98Configured=false;await cc98.forget();await clear(['cc98','cc98Top']);}config.cc98={clientId:id};await persistConfig();return {};}
  if(action==='configuration')return {...status(),username:config.campus?.username||'',host:config.weather?.host||'',webvpnUsername:config.webvpn?.username||'',webvpnConfigured:!!config.webvpn?.password};
  if(action==='save-webvpn'){const username=String(message.username||'').trim(),password=String(message.password||config.webvpn?.password||'');if(!username||username.length>100||!password||password.length>512)throw E.problem('请填写 WebVPN 用户名和密码');cancel('webvpn');vpn?.reset();config.webvpn={username,password};await persistConfig();return {}; }
  if(action==='clear-webvpn'){cancel('webvpn');vpn?.reset();delete config.webvpn;await persistConfig();return {};}
  if(action==='save-campus'){
   const username=String(message.username||'').trim(),password=String(message.password||config.campus?.password||'');
   if(!username||username.length>100||!password||password.length>512)throw E.problem('请填写学号和密码');
   cancel('campus');config.campus={username,password};campus.reset();await persistConfig();await clear(allCampusKeys());return status();
  }
  if(action==='save-weather'){
   const host=E.weatherHost(message.host),key=String(message.key||config.weather?.key||'').trim();if(!key||key.length>512)throw E.problem('请填写 API Key');
   cancel('weather');config.weather={host,key,location:config.weather?.location||null};await persistConfig();await clear(weatherKeys);return status();
  }
  if(action==='lookup'){
   const query=String(message.query||'').trim();if(!query||query.length>80)throw E.problem('请输入城市或区县');
   const data=await weather('/geo/v2/city/lookup',{location:query,lang:'zh',number:10});
   return (data.location||[]).map(p=>({id:p.id,name:p.name,adm1:p.adm1,adm2:p.adm2,lat:p.lat,lon:p.lon,tz:p.tz}));
  }
  if(action==='select-location'){
   const p=message.location;if(!p||!p.id||!p.name||!Number.isFinite(Number(p.lat))||Math.abs(Number(p.lat))>90||!Number.isFinite(Number(p.lon))||Math.abs(Number(p.lon))>180||!config.weather)throw E.problem('地点信息不完整');
   cancel('weather');config.weather.location={id:String(p.id).slice(0,40),name:String(p.name).slice(0,80),adm1:String(p.adm1||'').slice(0,80),adm2:String(p.adm2||'').slice(0,80),lat:Number(p.lat),lon:Number(p.lon),tz:String(p.tz||'Asia/Shanghai')};
   await persistConfig();await clear(weatherKeys);return status();
  }
  if(action==='clear-weather'){cancel('weather');delete config.weather;await persistConfig();await clear(weatherKeys);return status();}
  throw E.problem('未知操作');
 }
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='HOME_EXTERNAL')return;
  const mutating=['themes-get','themes-set','theme-draft','greeting-set','save-campus','save-webvpn','clear-webvpn','cc98-client','cc98-forget','save-weather','select-location','clear-weather','clear-cache','logout','preferences-set','portable-import','portable-restore','portable-export','portable-backup'].includes(message.action);
  const work=mutating?(typeof HomeMutation==='function'?HomeMutation(()=>handle(message,sender)):(mutations=mutations.catch(()=>{}).then(()=>handle(message,sender)))):handle(message,sender);
  work.then(value=>reply({ok:true,value}),error=>reply({ok:false,error:error.publicMessage||'操作失败，请稍后重试'}));return true;
 });
})();

