(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HomeThemeCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const COLORS={background:'#190b25',primary:'#b88bd1',accent:'#d3a3e3',text:'#f1e5f4',muted:'#bda9c5',search:'#271330',card:'#352044',secondaryCard:'#25162f',panel:'#211329',border:'#bda9c5',hover:'#b88bd1',selected:'#d3a3e3',shadow:'#000000'};
 const LIMITS={brightness:[.2,1.5,.68],blur:[0,30,0],secondaryBlur:[0,30,14],grayscale:[0,100,0],scale:[100,150,104],shade:[0,100,35],vignette:[0,100,0],cardOpacity:[0,100,50],secondaryOpacity:[0,100,90],panelOpacity:[0,100,100],searchOpacity:[0,100,0],radius:[0,30,9],border:[0,3,1],shadow:[0,100,35],width:[800,1600,1220],padding:[12,80,48],groupGap:[10,60,31],cardGap:[8,40,16],fontSize:[11,18,13],clockSize:[24,80,24],searchHeight:[32,70,40],titleSize:[12,24,21]};
 const FONTS=['ZJUers Josefin','Segoe UI','Noto Sans CJK SC'];
 function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
 function bounded(v,max,fallback){return typeof v==='string'&&v.trim()?v.trim().slice(0,max):fallback;}
 function normalizeVisuals(value){const v=obj(value),out={};for(const [key,[min,max,fallback]] of Object.entries(LIMITS)){const n=typeof v[key]==='number'?v[key]:NaN;out[key]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}out.displayFont=FONTS.includes(v.displayFont)?v.displayFont:'ZJUers Josefin';out.uiFont=FONTS.includes(v.uiFont)?v.uiFont:'ZJUers Josefin';return out;}
 function defaultTheme(){return {id:'default',name:'默认主题',wallpaper:{type:'builtin',path:''},colors:{...COLORS},visuals:normalizeVisuals()};}
 function fileURL(path){if(typeof path!=='string'||/[\u0000-\u001f]/.test(path))return '';let p=path.trim();if(/^file:\/\/\/[A-Za-z]:\//i.test(p)){try{p=decodeURIComponent(p.slice(8));}catch{return '';}}if(!/^[A-Za-z]:[\\/]/.test(p))return '';return 'file:///'+p.replace(/\\/g,'/').split('/').map((part,i)=>i===0?part:encodeURIComponent(part)).join('/');}
 function normalizeTheme(value){const t=obj(value);if(t.id==='default')return defaultTheme();const colors={...COLORS};for(const key of Object.keys(colors)){if(typeof obj(t.colors)[key]==='string'&&/^#[0-9a-f]{6}$/i.test(t.colors[key]))colors[key]=t.colors[key].toLowerCase();}const w=obj(t.wallpaper),type=['image','video'].includes(w.type)?w.type:'builtin';return {id:bounded(t.id,80,'custom'),name:bounded(t.name,60,'自定义主题'),wallpaper:{type,path:type==='builtin'?'':typeof w.path==='string'?w.path.slice(0,2048):''},colors,visuals:normalizeVisuals(t.visuals)};}
 function normalizeState(saved,legacyPrefs){const s=obj(saved),themes=[defaultTheme()],ids=new Set(['default']);if(Array.isArray(s.themes)){for(const t of s.themes){if(!t||t.id==='default')continue;const normalized=normalizeTheme(t);if(ids.has(normalized.id))continue;themes.push(normalized);ids.add(normalized.id);if(themes.length===30)break;}}else{const p=obj(legacyPrefs),w=obj(p.wallpaper);const oldVisuals=(Number.isFinite(p.shade)&&p.shade!==55)||(Number.isFinite(p.blur)&&p.blur!==36);if(['image','video'].includes(w.type)||oldVisuals){const visuals=p.visuals||(['image','video'].includes(w.type)?p:{brightness:.68+(55-(Number.isFinite(p.shade)?p.shade:55))*.006,secondaryBlur:(Number.isFinite(p.blur)?p.blur:36)*14/36});themes.push(normalizeTheme({id:'legacy',name:'原壁纸主题',wallpaper:w,visuals}));ids.add('legacy');}}return {activeId:ids.has(s.activeId)?s.activeId:themes.length===2&&!Array.isArray(s.themes)?'legacy':'default',themes};}
 function hsl(h,s,l){const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};return '#'+[f(0),f(8),f(4)].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function paletteFromPixels(frames){const buckets=Array.from({length:24},()=>({weight:0,hx:0,hy:0}));for(const frame of Array.isArray(frames)?frames:[]){const pixels=frame&&frame.data?frame.data:frame;if(!pixels||typeof pixels.length!=='number')continue;for(let i=0;i+3<pixels.length;i+=4){const rgb=[pixels[i],pixels[i+1],pixels[i+2]];if(!rgb.every(n=>Number.isFinite(n)&&n>=0&&n<=255)||pixels[i+3]<128)continue;const [r,g,b]=rgb.map(n=>n/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(d<.08)continue;let hue=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;hue=(hue*60+360)%360;const weight=d*(.5+Math.min(max,1-max));const bucket=buckets[Math.floor(hue/15)];bucket.weight+=weight;bucket.hx+=Math.cos(hue*Math.PI/180)*weight;bucket.hy+=Math.sin(hue*Math.PI/180)*weight;}}
 const best=buckets.reduce((a,b)=>a.weight>=b.weight?a:b);if(!best.weight)return {...COLORS};const hue=(Math.atan2(best.hy,best.hx)*180/Math.PI+360)%360;return {background:hsl(hue,.42,.075),primary:hsl(hue,.5,.72),accent:hsl(hue,.65,.76),text:hsl(hue,.25,.95),muted:hsl(hue,.2,.74),search:hsl(hue,.3,.12),card:hsl(hue,.3,.15),secondaryCard:hsl(hue,.3,.12),panel:hsl(hue,.3,.1),border:hsl(hue,.25,.65),hover:hsl(hue,.45,.7),selected:hsl(hue,.6,.74),shadow:'#000000'};}
 function rgb(hex){return hex.slice(1).match(/../g).map(v=>parseInt(v,16));}
 function edgeThemeManifest(value){
  const c=normalizeTheme(value).colors;
  const light='#ffffff',dark='#101018';
  const luminance=hex=>rgb(hex).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const readable=(foreground,background)=>contrast(foreground,background)>=4.5?foreground:contrast(light,background)>=contrast(dark,background)?light:dark;
  const mapped={
   frame:c.background,frame_inactive:c.panel,frame_incognito:c.background,frame_incognito_inactive:c.panel,
   background_tab:c.card,background_tab_inactive:c.panel,background_tab_incognito:c.card,background_tab_incognito_inactive:c.panel,
   tab_text:readable(c.text,c.secondaryCard),tab_background_text:readable(c.muted,c.card),
   tab_background_text_inactive:readable(c.muted,c.panel),tab_background_text_incognito:readable(c.muted,c.card),
   tab_background_text_incognito_inactive:readable(c.muted,c.panel),
   toolbar:c.secondaryCard,toolbar_text:readable(c.text,c.secondaryCard),toolbar_button_icon:readable(c.text,c.secondaryCard),
   bookmark_text:readable(c.text,c.secondaryCard),button_background:c.accent,
   omnibox_background:c.search,omnibox_text:readable(c.text,c.search),
   ntp_background:c.background,ntp_text:readable(c.text,c.background),ntp_header:c.secondaryCard,ntp_link:c.accent
  };
  return {manifest_version:3,name:'ZJUers 个人配色',version:'1.1.0',theme:{colors:Object.fromEntries(Object.entries(mapped).map(([key,color])=>[key,rgb(color)]))}};
 }
 function normalizeGreeting(value){const c=obj(value);return {name:bounded(c.name,40,'Yangkao'),morning:bounded(c.morning,200,'早上好，{称呼}'),afternoon:bounded(c.afternoon,200,'下午好，{称呼}'),evening:bounded(c.evening,200,'晚上好，{称呼}')};}
 function greeting(value,hour){const c=normalizeGreeting(value),h=Number.isFinite(hour)?hour:12;return c[h<11?'morning':h<18?'afternoon':'evening'].replace(/\{称呼\}/g,()=>c.name);}
 function manageTheme(value,action,id,name){
  const state=normalizeState(value),theme=state.themes.find(item=>item.id===id);
  if(!theme)throw new Error('主题不存在');
  if(action==='select')state.activeId=id;
  else if(action==='delete'){
   if(id==='default')throw new Error('默认主题不可删除');
   state.themes=state.themes.filter(item=>item.id!==id);
   if(state.activeId===id)state.activeId='default';
  }else if(action==='rename'){
   if(id==='default')throw new Error('默认主题不可重命名');
   if(typeof name!=='string'||!name.trim())throw new Error('请输入主题名称');
   theme.name=name.trim().slice(0,60);
  }else throw new Error('不支持的主题操作');
  return state;
 }
 return {defaultTheme,normalizeVisuals,normalizeTheme,normalizeState,paletteFromPixels,edgeThemeManifest,fileURL,normalizeGreeting,greeting,manageTheme};
});
