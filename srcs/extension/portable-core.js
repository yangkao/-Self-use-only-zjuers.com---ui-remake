(function(root){
 'use strict';
 const node=typeof module!=='undefined',N=node?require('./navigation-core.js'):root.HomeNavigation,T=node?require('./theme-core.js'):root.HomeThemeCore,H=node?require('./core.js'):root.HomeCore,E=node?require('./external-core.js'):root.ExternalCore;
 const W=node?require('./widget-core.js'):root.HomeWidgetsCore;
 const fail=m=>{throw new Error(m);};
 const canonical=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])):x);
 function keys(x,list){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==list.length||list.some(k=>!Object.hasOwn(x,k)))fail('配置结构或字段不匹配');}
 function weather(value){const w=value||{},host=w.host?E.weatherHost(w.host):'',l=w.location;let location=null;
  if(l){if(!l.id||!l.name||!Number.isFinite(Number(l.lat))||Math.abs(Number(l.lat))>90||!Number.isFinite(Number(l.lon))||Math.abs(Number(l.lon))>180)fail('天气地点无效');location={};for(const key of ['id','name','adm1','adm2','tz']){if(l[key]!==undefined&&typeof l[key]!=='string')fail('天气地点字段无效');location[key]=String(l[key]||'').slice(0,100);}location.lat=Number(l.lat);location.lon=Number(l.lon);}
  return {host,location};
 }
 function exportConfig(saved){return {format:'zjuers-home-config',schemaVersion:1,exportedAt:new Date().toISOString(),settings:{preferences:H.preferences(saved.preferences),themes:T.normalizeState(saved.update1Themes,saved.preferences),greeting:T.normalizeGreeting(saved.update1Greeting),navigation:saved.navigationState?N.validate(saved.navigationState):null,weather:weather(saved.privateConfig?.weather),widgets:W.validate(saved.widgetState||{schemaVersion:1,instances:[]})}};}
 function validate(value){
  if(JSON.stringify(value).length>4*1024*1024)fail('配置文件超过4MB');keys(value,['format','schemaVersion','exportedAt','settings']);if(value.format!=='zjuers-home-config'||value.schemaVersion!==1)fail('不支持的配置版本');if(typeof value.exportedAt!=='string'||!Number.isFinite(Date.parse(value.exportedAt)))fail('配置日期无效');
  value=structuredClone(value);const prefs=value.settings?.preferences;if(prefs&&!Object.hasOwn(prefs,'showSeconds'))prefs.showSeconds=false;
  if(prefs&&!Object.hasOwn(prefs,'rotateLogo'))prefs.rotateLogo=false;
  for(const theme of value.settings?.themes?.themes||[])if(theme.visuals)for(const [key,v]of Object.entries({widgetOpacity:50,menuDuration:180,detailDuration:200,focusGlow:20}))if(!Object.hasOwn(theme.visuals,key))theme.visuals[key]=v;
  for(const theme of value.settings?.themes?.themes||[])if(!Object.hasOwn(theme,'muted'))theme.muted=true;
  for(const theme of value.settings?.themes?.themes||[]){if(!Object.hasOwn(theme,'paletteSettings'))theme.paletteSettings=T.normalizePaletteSettings();if(!Object.hasOwn(theme,'lockedColors'))theme.lockedColors={};}
  for(const theme of value.settings?.themes?.themes||[]){if(!Object.hasOwn(theme,'material'))theme.material='current';if(!['current','blend','liquid'].includes(theme.material))fail('主题材质无效');}
  const s=value.settings;keys(s,['preferences','themes','greeting','navigation','weather','widgets']);
  if(s.themes?.themes?.some(t=>t?.wallpaper?.type==='builtin')){
   keys(s.themes,['activeId','themes']);const ids=new Set();
   for(const theme of s.themes.themes){keys(theme,['id','name','material','muted','wallpaper','colors','visuals','paletteSettings','lockedColors',...(Object.hasOwn(theme,'generatedColors')?['generatedColors']:[])]);if(typeof theme.id!=='string'||ids.has(theme.id))fail('旧主题编号无效');ids.add(theme.id);
    if(canonical(theme.paletteSettings)!==canonical(T.normalizePaletteSettings(theme.paletteSettings))||canonical(theme.lockedColors)!==canonical(T.normalizeTheme({...theme,id:'validate-locks'}).lockedColors))fail('????????');
    if(Object.hasOwn(theme,'generatedColors')&&canonical(theme.generatedColors)!==canonical(T.normalizeTheme({...theme,id:'validate-generated'}).generatedColors))fail('??????');
    if(theme.wallpaper.type==='builtin'){
     if(Object.keys(theme.wallpaper).some(k=>!['type','path','crop'].includes(k))||theme.wallpaper.path!=='')fail('旧壁纸引用无效');
     keys(theme.colors,Object.keys(T.defaultTheme().colors));if(Object.values(theme.colors).some(v=>typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v)))fail('旧主题配色无效');
     if(canonical(theme.visuals)!==canonical(T.normalizeVisuals(theme.visuals))||typeof theme.muted!=='boolean'||typeof theme.name!=='string')fail('旧主题设置无效');
    }else if(canonical(theme)!==canonical(T.normalizeTheme(theme)))fail('主题配置无效');
   }
   s.themes=T.normalizeState(s.themes);
  }
  if(canonical(s.preferences)!==canonical(H.preferences(s.preferences)))fail('搜索与界面配置无效');
  if(canonical(s.themes)!==canonical(T.normalizeState(s.themes)))fail('主题配置含未知字段、重复编号或无效数值');
  if(canonical(s.greeting)!==canonical(T.normalizeGreeting(s.greeting)))fail('问候配置无效');
  if(s.navigation!==null)N.validate(s.navigation);
  if(canonical(s.weather)!==canonical(weather(s.weather)))fail('天气公开配置无效');
  W.validate(s.widgets);
  return structuredClone(value);
 }
 function prepare(saved,file){const data=validate(file),s=data.settings,privateConfig=structuredClone(saved.privateConfig||{});
  privateConfig.weather={...(privateConfig.weather||{}),...s.weather};
  const navigation=s.navigation?N.validate(s.navigation):null;if(navigation)navigation.revision=(saved.navigationState?.revision||0)+1;
  return {widgetState:s.widgets,widgetRuntime:{},preferences:s.preferences,update1Themes:s.themes,update1Greeting:s.greeting,navigationState:navigation,privateConfig,update2ImportBackup:exportConfig(saved),update2SchemaVersion:1};
 }
 const api={exportConfig,validate,prepare};root.HomePortable=api;if(node)module.exports=api;
})(globalThis);
