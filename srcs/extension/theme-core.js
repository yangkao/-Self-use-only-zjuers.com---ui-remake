(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HomeThemeCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const COLORS={background:'#190b25',primary:'#b88bd1',accent:'#d3a3e3',text:'#f1e5f4',muted:'#bda9c5',search:'#271330',card:'#352044',secondaryCard:'#25162f',panel:'#211329',border:'#bda9c5',hover:'#b88bd1',selected:'#d3a3e3',shadow:'#000000'};
 const LIMITS={widgetOpacity:[0,100,50],menuDuration:[0,400,180],detailDuration:[0,400,200],focusGlow:[0,60,20],brightness:[.2,1.5,.68],blur:[0,30,0],secondaryBlur:[0,30,14],grayscale:[0,100,0],scale:[100,150,104],shade:[0,100,35],vignette:[0,100,0],cardOpacity:[0,100,50],secondaryOpacity:[0,100,90],panelOpacity:[0,100,100],searchOpacity:[0,100,30],radius:[0,30,9],border:[0,3,1],shadow:[0,100,35],width:[800,1600,1220],padding:[12,80,48],groupGap:[10,60,31],cardGap:[8,40,16],fontSize:[11,18,13],clockSize:[24,80,24],searchHeight:[32,70,40],titleSize:[12,24,21]};
 const FONTS=['ZJUers Josefin','Segoe UI','Noto Sans CJK SC'];
 function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}
 function bounded(v,max,fallback){return typeof v==='string'&&v.trim()?v.trim().slice(0,max):fallback;}
 function normalizeVisuals(value){const v=obj(value),out={};for(const [key,[min,max,fallback]] of Object.entries(LIMITS)){const n=typeof v[key]==='number'?v[key]:NaN;out[key]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}out.displayFont=FONTS.includes(v.displayFont)?v.displayFont:'ZJUers Josefin';out.uiFont=FONTS.includes(v.uiFont)?v.uiFont:'ZJUers Josefin';return out;}
 function normalizeMaterial(value){return ['current','blend','liquid'].includes(value)?value:'current';}
 function defaultTheme(){return {material:'blend',paletteSettings:normalizePaletteSettings(),lockedColors:{},id:'default',name:'必应每日壁纸',muted:true,wallpaper:{type:'bing',path:''},colors:paletteFromPixels([[128,128,128,255]]),visuals:normalizeVisuals()};}
 function fileURL(path){if(typeof path!=='string'||/[\u0000-\u001f]/.test(path))return '';let p=path.trim();if(/^file:\/\/\/[A-Za-z]:\//i.test(p)){try{p=decodeURIComponent(p.slice(8));}catch{return '';}}if(!/^[A-Za-z]:[\\/]/.test(p))return '';return 'file:///'+p.replace(/\\/g,'/').split('/').map((part,i)=>i===0?part:encodeURIComponent(part)).join('/');}
 function legacyWallpaper(value){const w={...obj(value)};if(w.type==='builtin')return w.path||w.reference?{...w,type:'video'}:{type:'bing',path:''};return w;}
 function hex(value,fallback=''){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;}
 function clamp(value,min,max,fallback){return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;}
 function normalizePaletteSettings(value){
  const v=obj(value),start=clamp(v.start,0,86400,0),end=clamp(v.end,0,86400,0);
  return {mode:['uniform','range','frame'].includes(v.mode)?v.mode:'uniform',frameCount:[4,8,16].includes(v.frameCount)?v.frameCount:8,start,end:end===0?0:Math.max(start,end),time:clamp(v.time,0,86400,0),region:v.region==='full'?'full':'crop',saturation:clamp(v.saturation,0,2,1),background:clamp(v.background,-.15,.15,0),accent:clamp(v.accent,0,2,1),primary:hex(v.primary)};
 }
 function normalizeLocks(value){const out={};for(const key of Object.keys(COLORS)){const color=hex(obj(value)[key]);if(color)out[key]=color;}return out;}
 function applyPaletteLocks(colors,lockedColors){return {...colors,...normalizeLocks(lockedColors)};}
 function createThemeDraft(source,id,name){
  const base=obj(source),theme=normalizeTheme({...base,material:'blend',id:id&&id!=='default'?id:'theme-'+Date.now().toString(36),name:name||'新主题',muted:true,wallpaper:{type:'solid',color:hex(obj(base.colors).background,COLORS.background)}});
  return theme;
 }
 function normalizeTheme(value){const t=obj(value);if(t.id==='default')return {...defaultTheme(),material:normalizeMaterial(t.material),visuals:normalizeVisuals(t.visuals),colors:defaultTheme().colors};const colors={...COLORS};for(const key of Object.keys(colors)){if(typeof obj(t.colors)[key]==='string'&&/^#[0-9a-f]{6}$/i.test(t.colors[key]))colors[key]=t.colors[key].toLowerCase();}const w=legacyWallpaper(t.wallpaper);const type=['image','video','bing','solid'].includes(w.type)?w.type:'bing';return {material:normalizeMaterial(t.material),id:bounded(t.id,80,'custom'),name:bounded(t.name,60,'自定义主题'),muted:t.muted!==false,wallpaper:type==='solid'?{type,path:'',color:hex(w.color,colors.background)}:{type,path:typeof w.path==='string'?w.path.slice(0,2048):'',...(typeof w.reference==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(w.reference)?{reference:w.reference,name:bounded(w.name,200,'本地壁纸')}:{}),...(w.crop?{crop:{x:Math.min(100,Math.max(0,Number(w.crop.x)||0)),y:Math.min(100,Math.max(0,Number(w.crop.y)||0))}}:{})},colors,visuals:normalizeVisuals(t.visuals),paletteSettings:normalizePaletteSettings(t.paletteSettings),lockedColors:normalizeLocks(t.lockedColors),...(Object.keys(normalizeLocks(t.generatedColors)).length?{generatedColors:normalizeLocks(t.generatedColors)}:{})};}
 function normalizeState(saved,legacyPrefs){
  const s=obj(saved),list=Array.isArray(s.themes)?s.themes:[],oldDefault=list.find(t=>t?.id==='default'),migrate=oldDefault?.wallpaper?.type==='builtin';
  const themes=[normalizeTheme(migrate?{...defaultTheme(),material:normalizeMaterial(oldDefault.material)}:oldDefault||defaultTheme())],ids=new Set(['default']);let activeId=s.activeId;
  if(migrate&&(oldDefault.wallpaper.path||oldDefault.wallpaper.reference)){let id='legacy-wallpaper';while(list.some(t=>t?.id===id))id+='-old';themes.push(normalizeTheme({...oldDefault,id,name:'原视频主题',wallpaper:legacyWallpaper(oldDefault.wallpaper)}));ids.add(id);if(activeId==='default')activeId=id;}
  for(const t of list){if(!t||t.id==='default')continue;const n=normalizeTheme(t);if(ids.has(n.id))continue;themes.push(n);ids.add(n.id);if(themes.length>=30)break;}
  if(!list.length){const pref=obj(legacyPrefs),w=obj(pref.wallpaper),oldVisuals=(Number.isFinite(pref.shade)&&pref.shade!==55)||(Number.isFinite(pref.blur)&&pref.blur!==36);if(['image','video'].includes(w.type)||oldVisuals){const visuals=pref.visuals||(['image','video'].includes(w.type)?pref:{brightness:.68+(55-(Number.isFinite(pref.shade)?pref.shade:55))*.006,secondaryBlur:(Number.isFinite(pref.blur)?pref.blur:36)*14/36});themes.push(normalizeTheme({id:'legacy',name:'原壁纸主题',wallpaper:['image','video'].includes(w.type)?w:{type:'bing',path:''},visuals}));ids.add('legacy');if(!activeId)activeId='legacy';}}
  return {activeId:ids.has(activeId)?activeId:'default',themes};
 }
 function hsl(h,s,l){const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};return '#'+[f(0),f(8),f(4)].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function legacyPaletteFromPixels(frames){let validPixels=0;const buckets=Array.from({length:24},()=>({weight:0,hx:0,hy:0}));for(const frame of Array.isArray(frames)?frames:[]){const pixels=frame&&frame.data?frame.data:frame;if(!pixels||typeof pixels.length!=='number')continue;for(let i=0;i+3<pixels.length;i+=4){const rgb=[pixels[i],pixels[i+1],pixels[i+2]];if(!rgb.every(n=>Number.isFinite(n)&&n>=0&&n<=255)||!Number.isFinite(pixels[i+3])||pixels[i+3]<128)continue;validPixels++;const [r,g,b]=rgb.map(n=>n/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(d<.08)continue;let hue=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;hue=(hue*60+360)%360;const weight=d*(.5+Math.min(max,1-max));const bucket=buckets[Math.floor(hue/15)];bucket.weight+=weight;bucket.hx+=Math.cos(hue*Math.PI/180)*weight;bucket.hy+=Math.sin(hue*Math.PI/180)*weight;}}
 const best=buckets.reduce((a,b)=>a.weight>=b.weight?a:b);if(!best.weight)return validPixels?{background:'#131313',primary:'#b8b8b8',accent:'#dedede',text:'#f2f2f2',muted:'#bdbdbd',search:'#1f1f1f',card:'#292929',secondaryCard:'#212121',panel:'#191919',border:'#a6a6a6',hover:'#b3b3b3',selected:'#d4d4d4',shadow:'#000000'}:{...defaultTheme().colors};const hue=(Math.atan2(best.hy,best.hx)*180/Math.PI+360)%360;return {background:hsl(hue,.42,.075),primary:hsl(hue,.5,.72),accent:hsl(hue,.65,.76),text:hsl(hue,.25,.95),muted:hsl(hue,.2,.74),search:hsl(hue,.3,.12),card:hsl(hue,.3,.15),secondaryCard:hsl(hue,.3,.12),panel:hsl(hue,.3,.1),border:hsl(hue,.25,.65),hover:hsl(hue,.45,.7),selected:hsl(hue,.6,.74),shadow:'#000000'};}
 // Extraction keeps luminance structure separate from hue confidence. Nothing
 // in this analysis is persisted; only selected colors and user settings are.
 function analyzePalette(frames){
  const histogram=new Float64Array(256),neutralHistogram=new Float64Array(256),groups=new Map();
  let total=0,neutralCount=0,frameCount=0;
  const toHex=channels=>'#'+channels.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  for(const frame of Array.isArray(frames)?frames:[]){
   const pixels=frame?.data||frame;if(!pixels||typeof pixels.length!=='number')continue;
   const frameId=frameCount++;
   for(let i=0;i+3<pixels.length;i+=4){
    const values=[pixels[i],pixels[i+1],pixels[i+2]];
    if(!values.every(n=>Number.isFinite(n)&&n>=0&&n<=255)||!Number.isFinite(pixels[i+3])||pixels[i+3]<128)continue;
    const [r,g,b]=values.map(v=>v/255),hi=Math.max(r,g,b),lo=Math.min(r,g,b),chroma=hi-lo;
    const luminance=.2126*r+.7152*g+.0722*b,level=Math.round(luminance*255);
    histogram[level]++;total++;
    // Near-neutral pixels contribute lightness, rather than acquiring a strong
    // hue merely because a codec/resize shifted one RGB channel slightly.
    if(chroma<.12){neutralHistogram[level]++;neutralCount++;}
    if(chroma<.02)continue;
    let hue=hi===r?((g-b)/chroma)%6:hi===g?(b-r)/chroma+2:(r-g)/chroma+4;
    hue=(hue*60+360)%360;
    const key=Math.floor(hue/15)*4+Math.min(3,Math.floor(luminance*4));
    let group=groups.get(key);
    if(!group){group={count:0,r:0,g:0,b:0,chroma:0,luminance:0,hx:0,hy:0,frames:new Set()};groups.set(key,group);}
    group.count++;group.r+=values[0];group.g+=values[1];group.b+=values[2];group.chroma+=chroma;group.luminance+=luminance;
    group.hx+=Math.cos(hue*Math.PI/180);group.hy+=Math.sin(hue*Math.PI/180);group.frames.add(frameId);
   }
  }
  const hueOf=g=>(Math.atan2(g.hy,g.hx)*180/Math.PI+360)%360;
  const clusters=[];
  for(const group of [...groups.values()].sort((a,b)=>b.count-a.count)){
   const near=clusters.find(other=>{const distance=Math.abs(hueOf(other)-hueOf(group));return Math.min(distance,360-distance)<=22.5&&Math.abs(other.luminance/other.count-group.luminance/group.count)<.2&&Math.abs(other.chroma/other.count-group.chroma/group.count)<.2;});
   if(!near){clusters.push({...group,frames:new Set(group.frames)});continue;}
   for(const key of ['count','r','g','b','chroma','luminance','hx','hy'])near[key]+=group[key];
   for(const id of group.frames)near.frames.add(id);
  }
  const chromatic=[];
  for(const group of clusters){
   const coverage=group.count/Math.max(1,total),chroma=group.chroma/group.count;
   const t=Math.max(0,Math.min(1,(chroma-.02)/.23)),signal=t*t*(3-2*t);
   const mass=1-Math.exp(-coverage/.025),support=1-Math.exp(-group.count/Math.max(.05,Math.min(12,total/20)));
   const repeat=group.frames.size/Math.max(1,frameCount);
   const confidence=signal*(.3+.7*mass)*(.55+.45*repeat)*support;
   if(confidence<.18)continue;
   chromatic.push({color:toHex([group.r/group.count,group.g/group.count,group.b/group.count]),kind:'chromatic',confidence,coverage,weight:group.count*chroma*chroma*(.25+.75*confidence)});
  }
  chromatic.sort((a,b)=>b.weight-a.weight);
  const neutralBins=[];
  const source=neutralCount?neutralHistogram:!chromatic.length?histogram:null;
  if(source){for(let start=0;start<256;start+=24){let count=0,sum=0;for(let j=start;j<Math.min(256,start+24);j++){count+=source[j];sum+=j*source[j];}if(count)neutralBins.push({color:toHex([sum/count,sum/count,sum/count]),kind:'neutral',confidence:1,coverage:count/Math.max(1,total),weight:count});}}
  const mergedNeutral=[];
  for(const candidate of neutralBins){const previous=mergedNeutral.at(-1),value=parseInt(candidate.color.slice(1,3),16);if(previous&&value-parseInt(previous.color.slice(1,3),16)<24){const count=previous.weight+candidate.weight,gray=(parseInt(previous.color.slice(1,3),16)*previous.weight+value*candidate.weight)/count;previous.color=toHex([gray,gray,gray]);previous.weight=count;previous.coverage+=candidate.coverage;}else mergedNeutral.push({...candidate});}
  const substantial=mergedNeutral.filter(c=>c.weight/Math.max(1,neutralCount||total)>=.01);
  const pool=substantial.length?substantial:mergedNeutral;
  const representatives=pool.length<=4?pool:[pool[0],pool.at(-1),...pool.slice(1,-1).sort((a,b)=>b.weight-a.weight).slice(0,2)];
  representatives.sort((a,b)=>parseInt(a.color.slice(1,3),16)-parseInt(b.color.slice(1,3),16));
  return {total,histogram,candidates:[...chromatic.slice(0,6),...representatives]};
 }
 function paletteCandidates(frames){return analyzePalette(frames).candidates;}
 function neutralPalette(analysis,primary){
  if(!analysis.total&&!primary)return {...defaultTheme().colors};
  function quantile(p){let sum=0;for(let i=0;i<256;i++){sum+=analysis.histogram[i];if(sum>=analysis.total*p&&sum>0)return i/255;}return .5;}
  const low=quantile(.1),high=quantile(.9),spread=high-low;
  let middle=quantile(.5);
  if(primary){const channels=rgb(primary);const seed=(.2126*channels[0]+.7152*channels[1]+.0722*channels[2])/255;middle=analysis.total?(middle+seed)/2:seed;}
  const background=Math.max(.025,Math.min(.12,.025+low*.07+middle*.025));
  const primaryLevel=.58+middle*.18+spread*.08;
  const levels={background,primary:primaryLevel,accent:Math.max(primaryLevel+.1,.78+high*.08),text:.91+high*.07,muted:.55+middle*.12,search:background+.045+middle*.008,card:background+.075+spread*.025,secondaryCard:background+.06,panel:background+.025+spread*.008,border:.4+middle*.17,hover:primaryLevel-.03,selected:Math.min(.92,primaryLevel+.06),shadow:0};
  return Object.fromEntries(Object.entries(levels).map(([key,level])=>[key,hsl(0,0,level)]));
 }
 function colorHSL(color){
  const [r,g,b]=rgb(color).map(n=>n/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  let hue=0;if(d)hue=(max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60;
  return [(hue+360)%360,d?d/(1-Math.abs(2*l-1)):0,l];
 }
 function paletteFromPixels(frames,options){
  if(options===undefined)return legacyPaletteFromPixels(frames);
  const settings=normalizePaletteSettings(options);
  const analysis=analyzePalette(frames),manual=settings.primary;
  const chosen=manual?{color:manual,confidence:1,kind:colorHSL(manual)[1]===0?'neutral':'chromatic'}:analysis.candidates.find(c=>c.kind==='chromatic');
  let base;
  if(chosen?.kind==='chromatic'){
   base=legacyPaletteFromPixels([[...rgb(chosen.color),255]]);
   const sourceSaturation=colorHSL(chosen.color)[1],cap=sourceSaturation*(.5+.5*chosen.confidence);
   for(const [key,color]of Object.entries(base)){const [h,sat,l]=colorHSL(color);base[key]=hsl(h,Math.min(sat,cap),l);}
  }else base=neutralPalette(analysis,manual);
  const colors={...base},backgrounds=['background','search','card','secondaryCard','panel'],accents=['primary','accent','hover','selected'];
  for(const [key,color] of Object.entries(base)){
   if(key==='shadow')continue;
   const [h,s,l]=colorHSL(color),sat=Math.min(1,s*settings.saturation*(accents.includes(key)?settings.accent:1)),light=Math.max(0,Math.min(1,l+(backgrounds.includes(key)?settings.background:0)));
   if(sat!==s||light!==l)colors[key]=hsl(h,sat,light);
  }
  return applyPaletteLocks(colors,obj(options).lockedColors);
 }
 function paletteFromSolid(color,options){return paletteFromPixels([[...rgb(hex(color,'#131313')),255]],options);}
 function rgb(hex){return hex.slice(1).match(/../g).map(v=>parseInt(v,16));}
 function edgeThemeManifest(value){
  const c=normalizeTheme(value?.id==='default'?{...value,id:'edge-export'}:value).colors;
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
   bookmark_text:readable(c.text,c.secondaryCard),
   omnibox_background:c.search,omnibox_text:readable(c.text,c.search),
   ntp_background:c.background,ntp_text:readable(c.text,c.background),ntp_header:c.secondaryCard,ntp_link:c.accent
  };
  return {manifest_version:3,name:'ZJUers 个人配色',version:'1.1.0',theme:{colors:Object.fromEntries(Object.entries(mapped).map(([key,color])=>[key,rgb(color)]))}};
 }
 function normalizeGreeting(value){const c=obj(value);return {name:bounded(c.name,40,'Zjuer'),morning:bounded(c.morning,200,'早上好，{称呼}'),afternoon:bounded(c.afternoon,200,'下午好，{称呼}'),evening:bounded(c.evening,200,'晚上好，{称呼}')};}
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
 return {defaultTheme,normalizeMaterial,normalizeVisuals,normalizeTheme,normalizeState,normalizePaletteSettings,createThemeDraft,paletteCandidates,paletteFromPixels,paletteFromSolid,applyPaletteLocks,edgeThemeManifest,fileURL,normalizeGreeting,greeting,manageTheme};
});
