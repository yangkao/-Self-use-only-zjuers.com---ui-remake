/* Advanced palette controls for the protected wallpaper preview. */
(()=>{
 'use strict';
 function create({host,getMedia,getTheme,getRatio,onResult,onSettings,onStatus}){
  const T=HomeThemeCore,S=HomePaletteSampling;
  let theme=T.defaultTheme(),settings=T.normalizePaletteSettings(),controller=null,version=0,frames=null,candidates=[],disposed=false;
  const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const panel=make('details');panel.className='palette-advanced';const summary=make('summary','高级取色');panel.append(summary);host.append(panel);
  const form=make('div');form.className='palette-options';panel.append(form);
  const fields={};
  function field(label,key,type,value,options){const line=make('label');line.className='palette-option';line.append(make('span',label));const e=make(type==='select'?'select':'input');if(type==='select'){for(const [value,text]of options){const o=make('option',text);o.value=value;e.append(o);}}else e.type=type;e.value=value;e.dataset.paletteField=key;fields[key]=e;line.append(e);form.append(line);return e;}
  field('视频采样方式','mode','select','uniform',[['uniform','均匀多帧'],['range','指定区间'],['frame','指定单帧']]);
  field('采样帧数','frameCount','select',8,[[4,'4 帧'],[8,'8 帧'],[16,'16 帧']]);
  for(const [key,label]of [['start','开始（秒）'],['end','结束（秒，0为片尾）']]){const e=field(label,key,'number',0);e.min=0;e.step=.1;}
  const time=field('单帧位置','time','range',0);time.min=0;time.max=1;time.step=.01;const stamp=make('output','0.00 秒');time.parentElement.append(stamp);
  field('画面范围','region','select','crop',[['crop','首页裁切区域'],['full','完整画面']]);
  const primary=field('指定主色（可留空）','primary','text','');primary.placeholder='#b88bd1';primary.maxLength=7;primary.pattern='#[0-9a-fA-F]{6}';
  for(const [key,label,min,max,step,value]of [['saturation','整体饱和度',0,2,.05,1],['background','背景明暗',-.15,.15,.01,0],['accent','强调色强度',0,2,.05,1]]){const e=field(label,key,'range',value);e.min=min;e.max=max;e.step=step;const o=make('output',String(value));e.parentElement.append(o);}
  const note=make('p','参数改变后点击生成；拖动单帧时间轴仅预览画面，不持续分析。');note.className='palette-help';panel.append(note);
  const choices=make('div');choices.className='palette-candidates';choices.setAttribute('aria-label','候选主色');panel.append(choices);
  const actions=make('div');actions.className='palette-actions';const generate=make('button','生成并预览配色'),cancel=make('button','取消分析'),reset=make('button','恢复最近生成结果');for(const b of [generate,cancel,reset]){b.type='button';actions.append(b);}cancel.hidden=true;panel.append(actions);
  const status=make('output');status.setAttribute('aria-live','polite');panel.append(status);
  function report(text){status.textContent=text;onStatus?.(text);}
  function stop(){version++;controller?.abort();controller=null;cancel.hidden=true;generate.disabled=theme.id==='default';}
  function read(){const value={};for(const [key,e]of Object.entries(fields))value[key]=e.type==='range'||e.type==='number'||key==='frameCount'?Number(e.value):e.value;settings=T.normalizePaletteSettings(value);theme.paletteSettings=structuredClone(settings);return settings;}
  function sync(){const video=getMedia()?.tagName==='VIDEO';fields.mode.parentElement.hidden=!video;fields.frameCount.parentElement.hidden=!video||settings.mode==='frame';fields.start.parentElement.hidden=!video||settings.mode!=='range';fields.end.parentElement.hidden=!video||settings.mode!=='range';fields.time.parentElement.hidden=!video||settings.mode!=='frame';const duration=getMedia()?.duration;time.max=Number.isFinite(duration)?Math.max(0,duration-.001):Math.max(1,settings.time);time.value=Math.min(Number(time.max),settings.time);stamp.textContent=Number(time.value).toFixed(2)+' 秒';for(const e of Object.values(fields))e.disabled=theme.id==='default';generate.disabled=theme.id==='default'||Boolean(controller);reset.disabled=theme.id==='default'||!theme.generatedColors;}
  function write(){time.max=Math.max(1,settings.time);for(const [key,e]of Object.entries(fields)){e.value=settings[key];if(e.type==='range'&&key!=='time')e.parentElement.querySelector('output').textContent=String(settings[key]);}sync();}
  function settingsChanged(){const old=JSON.stringify([settings.mode,settings.frameCount,settings.start,settings.end,settings.time,settings.region]);stop();read();if(old!==JSON.stringify([settings.mode,settings.frameCount,settings.start,settings.end,settings.time,settings.region])){frames=null;candidates=[];choices.replaceChildren();}primary.setCustomValidity('');if(primary.value&&!/^#[0-9a-f]{6}$/i.test(primary.value)){primary.setCustomValidity('请输入六位十六进制颜色');primary.setAttribute('aria-invalid','true');}else primary.removeAttribute('aria-invalid');sync();onSettings?.(structuredClone(settings));}
  form.addEventListener('input',event=>{if(!event.target.dataset.paletteField)return;settingsChanged();if(event.target.type==='range'&&event.target!==time)event.target.parentElement.querySelector('output').textContent=event.target.value;
   if(event.target===time&&settings.mode==='frame'){const media=getMedia();if(media?.tagName==='VIDEO'&&Number.isFinite(media.duration)){media.pause();media.currentTime=Math.min(media.duration-.001,settings.time);}}
  });
  form.addEventListener('change',event=>{if(event.target.dataset.paletteField)settingsChanged();});
  function deliver(){const base=theme.wallpaper.type==='solid'?T.paletteFromSolid(theme.wallpaper.color,settings):T.paletteFromPixels(frames,settings);const colors=T.applyPaletteLocks(base,theme.lockedColors);theme.generatedColors=base;onResult({colors,generatedColors:base,paletteSettings:settings});reset.disabled=false;}
  function showCandidates(){choices.replaceChildren();for(const item of candidates){const neutral=item.kind==='neutral',b=make('button',(neutral?'中性色 ':'')+item.color);b.type='button';b.style.setProperty('--candidate-color',item.color);b.setAttribute('aria-label','使用'+(neutral?'中性色':'主色')+' '+item.color);b.onclick=()=>{settings.primary=item.color;theme.paletteSettings=structuredClone(settings);fields.primary.value=item.color;onSettings?.(structuredClone(settings));deliver();report('已预览该候选主色，请保存主题。');};choices.append(b);}}
  async function analyze(){
   if(theme.id==='default'){report('默认必应主题随每日图片自动生成配色。');return;}
   if(primary.value&&!/^#[0-9a-f]{6}$/i.test(primary.value)){primary.reportValidity();return;}
   stop();const run=version;controller=new AbortController();const signal=controller.signal;cancel.hidden=false;generate.disabled=true;read();const source=getMedia();let analysis;
   try{
    report('正在准备采样…');
    if(theme.wallpaper.type==='solid'){frames=null;candidates=[{color:theme.wallpaper.color,weight:1}];}
    else{
     if(!source)throw Error('请先等待壁纸加载');
     analysis=document.createElement(source.tagName==='VIDEO'?'video':'img');if(analysis.tagName==='VIDEO'){analysis.muted=true;analysis.preload='auto';analysis.playsInline=true;}
     await new Promise((resolve,reject)=>{const good=()=>finish(),bad=()=>finish(Error('分析素材加载失败')),abort=()=>finish(new DOMException('已取消','AbortError'));const timer=setTimeout(()=>finish(Error('分析素材加载超时')),15000);function finish(error){clearTimeout(timer);analysis.removeEventListener('loadeddata',good);analysis.removeEventListener('load',good);analysis.removeEventListener('error',bad);signal.removeEventListener('abort',abort);error?reject(error):resolve();}analysis.addEventListener(analysis.tagName==='VIDEO'?'loadeddata':'load',good,{once:true});analysis.addEventListener('error',bad,{once:true});signal.addEventListener('abort',abort,{once:true});analysis.src=source.currentSrc||source.src;if(signal.aborted)abort();});
     frames=await S.collectPalettePixels(analysis,{...settings,crop:theme.wallpaper.crop,ratio:getRatio(),zoom:theme.visuals.scale/100,onProgress:(done,total)=>report(`正在采样 ${done} / ${total}…`)},signal);
     candidates=T.paletteCandidates(frames);
    }
    if(disposed||signal.aborted||run!==version)return;deliver();showCandidates();report(candidates.length&&candidates.every(c=>c.kind==='neutral')&&!settings.primary?'已按画面亮度分布生成中性色层级，可选择不同明度候选；请保存主题。':'配色已预览；锁定颜色保持不变，请保存主题。');
   }catch(error){if(!disposed&&run===version)report(error.name==='AbortError'?'分析已取消，原配色保持不变。':error.message+'，原配色保持不变。');}
   finally{if(analysis){if(analysis.tagName==='VIDEO'){analysis.pause();analysis.removeAttribute('src');analysis.load();}else analysis.removeAttribute('src');}if(run===version){controller=null;cancel.hidden=true;sync();}}
  }
  generate.onclick=()=>void analyze();cancel.onclick=()=>{stop();report('分析已取消，原配色保持不变。');};reset.onclick=()=>{if(!theme.generatedColors)return;onResult({colors:T.applyPaletteLocks(theme.generatedColors,theme.lockedColors),generatedColors:theme.generatedColors,paletteSettings:settings});report('已恢复最近生成的配色；锁定颜色保持不变。');};
  return {analyze,cancel:stop,update(value){const next=T.normalizeTheme(value),changed=JSON.stringify([theme.id,theme.wallpaper,theme.paletteSettings,theme.visuals.scale])!==JSON.stringify([next.id,next.wallpaper,next.paletteSettings,next.visuals.scale]);theme=next;settings=T.normalizePaletteSettings(theme.paletteSettings);if(changed){stop();frames=null;candidates=[];choices.replaceChildren();write();}else sync();},mediaReady(){sync();},destroy(){disposed=true;stop();frames=null;candidates=[];panel.remove();}};
 }
 globalThis.HomePaletteEditor={create};
})();
