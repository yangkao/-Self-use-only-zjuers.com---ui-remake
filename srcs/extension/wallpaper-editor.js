(()=>{
 'use strict';
 const $=id=>document.getElementById(id),standalone=parent===window,params=new URL(location.href).searchParams,request=params.get('request')||crypto.randomUUID();
 let wallpaper={type:'builtin',path:''},node,url='',ratio=16/9,handleId='',serial=0,drag=null,visuals=HomeThemeCore.defaultTheme().visuals,preparedHandle=null,canApply=true;
 if(standalone&&params.has('reference'))HomeFileHandles.read(params.get('reference')).then(h=>preparedHandle=h).catch(e=>report(e.message));
 let previewFrame=null,heightFrame=null,lastEditorHeight=null;
 function queuePreviewResize(){if(previewFrame!==null)return;previewFrame=requestAnimationFrame(()=>{previewFrame=null;const box=$('preview'),width=box.clientWidth;if(!(width>0))return;const height=(Math.round(width/ratio*100)/100)+'px';if(box.style.height!==height)box.style.height=height;});}
 function queueEditorHeight(){if(heightFrame!==null)return;heightFrame=requestAnimationFrame(()=>{heightFrame=null;const height=Math.ceil(document.body.getBoundingClientRect().height)+8;if(height===lastEditorHeight)return;lastEditorHeight=height;parent.postMessage({type:'EDITOR_HEIGHT',height},'https://zjuers.com');});}
 function setRatio(value,measured){ratio=Math.max(.3,Math.min(5,Number(value)||16/9));const box=$('preview');box.style.aspectRatio=String(ratio);queuePreviewResize();$('ratioNotice').textContent=measured?'':'请将浏览器最大化一次以校准预览；当前暂按窗口比例显示。';}
 const previewResizeObserver=new ResizeObserver(queuePreviewResize);previewResizeObserver.observe($('preview'));
 window.addEventListener('message',e=>{if(e.source===parent&&e.origin==='https://zjuers.com'&&e.data?.type==='EDITOR_VIEWPORT')setRatio(e.data.ratio,e.data.measured===true);});
 const report=text=>$('status').textContent=text;
 let editingTheme=HomeThemeCore.defaultTheme();
 const advanced=HomePaletteEditor.create({host:$('advanced'),getMedia:()=>node,getTheme:()=>editingTheme,getRatio:()=>ratio,onStatus:report,onSettings:settings=>{editingTheme.paletteSettings=settings;emit();},onResult:result=>{Object.assign(editingTheme,result);emit(result.colors,result);}});
 function emit(colors,extra={}){if(!canApply){report('请先授权文件，再应用壁纸或生成配色。');return false;}if(!standalone)parent.postMessage({type:'EDITOR_UPDATE',wallpaper,colors,paletteSettings:editingTheme.paletteSettings,lockedColors:editingTheme.lockedColors,generatedColors:editingTheme.generatedColors,...extra},'https://zjuers.com');return true;}
 async function dailyURL(){const daily=await HomeBing.call('peek');return daily?HomeBing.url(daily):chrome.runtime.getURL('assets/fallback.svg');}
 let cancelDisplay=null;
 function cleanup(){cancelDisplay?.();cancelDisplay=null;advanced.cancel();if(node?.tagName==='VIDEO'){node.pause();node.removeAttribute('src');node.load();}if(url.startsWith('blob:'))URL.revokeObjectURL(url);url='';node=null;$('preview').replaceChildren();}
 async function display(w,file){
  const run=++serial;cleanup();canApply=false;wallpaper=w;editingTheme.wallpaper=w;advanced.update(editingTheme);
  if(w.type==='solid'){$('fileName').textContent='纯色背景';$('preview').style.background=w.color;canApply=true;$('solidColor').value=w.color;$('solidHex').value=w.color;advanced.mediaReady();return;}
  $('preview').style.background='';
  const selectedURL=file?URL.createObjectURL(file):['bing','builtin'].includes(w.type)?await dailyURL():await HomeFileHandles.url(w);
  if(run!==serial){if(selectedURL.startsWith('blob:'))URL.revokeObjectURL(selectedURL);return;}
  url=selectedURL;const media=document.createElement(w.type==='video'?'video':'img');node=media;
  if(media.tagName==='VIDEO'){media.muted=true;media.autoplay=true;media.loop=true;media.playsInline=true;}
  media.style.objectPosition=(w.crop?.x??50)+'% '+(w.crop?.y??50)+'%';media.style.transform='scale('+visuals.scale/100+')';media.style.filter='brightness('+visuals.brightness+') grayscale('+visuals.grayscale+'%)';
  $('preview').replaceChildren(media);$('fileName').textContent=w.name||(['bing','builtin'].includes(w.type)?'必应每日壁纸':w.path);
  await new Promise((resolve,reject)=>{const event=media.tagName==='VIDEO'?'loadeddata':'load',good=()=>finish(),bad=()=>finish(Error('壁纸读取失败，请重新选择或授权。'));const timer=setTimeout(()=>finish(Error('壁纸加载超时')),12000);let settled=false;function finish(error){if(settled)return;settled=true;clearTimeout(timer);media.removeEventListener(event,good);media.removeEventListener('error',bad);if(cancelDisplay===cancel)cancelDisplay=null;error?reject(error):resolve();}const cancel=()=>finish();cancelDisplay=cancel;media.addEventListener(event,good,{once:true});media.addEventListener('error',bad,{once:true});media.src=url;});
  if(run!==serial)return;canApply=!file;advanced.mediaReady();
 }
 let selectionSequence=0;
 async function selected(handle){const selection=++selectionSequence,expected=serial;preparedHandle=handle;const file=await handle.getFile();if(selection!==selectionSequence||expected!==serial)return null;if(!/^(image|video)\//.test(file.type))throw Error('请选择图片或视频');const id=crypto.randomUUID();await HomeFileHandles.save(id,handle);if(selection!==selectionSequence||expected!==serial)return null;handleId=id;const w={type:file.type.startsWith('image/')?'image':'video',path:'',reference:id,name:file.name,crop:{x:50,y:50}};await display(w,file);if(wallpaper!==w||selection!==selectionSequence)return null;const permission=await handle.queryPermission({mode:'read'});if(wallpaper!==w||selection!==selectionSequence)return null;canApply=permission==='granted';return w;}
 async function grant(existing=false){
  let handle;
  if(existing){if(!preparedHandle)throw Error('文件引用正在读取，请稍后再次点击');handle=preparedHandle;if(await handle.requestPermission({mode:'read'})!=='granted')throw Error('未获得文件读取权限');}
  else{[handle]=await showOpenFilePicker({multiple:false,types:[{description:'图片与视频',accept:{'image/*':['.png','.jpg','.jpeg','.webp','.gif'],'video/*':['.mp4','.webm','.mov']}}]});}
  const w=await selected(handle);
  if(standalone){await chrome.storage.session.set({wallpaperSelection:{request,wallpaper:w,time:Date.now()}});report('文件已授权并送回设置预览。可关闭本页；在设置中保存主题。');}
  else{$('authorize').hidden=true;emit();await palette();report('文件已在内嵌窗口授权，请保存主题。');}
 }
 function grantFailed(error,existing){
  if(error.name==='AbortError'){report('已取消选择');return;}
  if(!standalone&&['SecurityError','NotAllowedError'].includes(error.name)){
   report('Edge 不允许此内嵌窗口申请文件权限，已打开独立授权页；授权完成后将返回这里预览。');
   chrome.tabs.create({url:chrome.runtime.getURL('wallpaper-editor.html')+'?request='+encodeURIComponent(request)+(existing?'&reference='+encodeURIComponent(handleId):'')}).catch(()=>report('无法打开授权页，请重新点击选择文件。'));return;
  }
  report(error.message);
 }
 $('choose').onclick=()=>{const existing=standalone&&params.has('reference');grant(existing).catch(e=>grantFailed(e,existing));};
 $('authorize').onclick=()=>grant(true).catch(e=>grantFailed(e,true));
 $('builtin').onclick=()=>{display({type:'bing',path:''}).then(()=>emit()).catch(e=>report(e.message));};
 async function palette(){return advanced.analyze();}
 $('palette').onclick=()=>palette().catch(e=>report(e.message));
 $('solidColor').oninput=()=>{$('solidHex').value=$('solidColor').value;};$('solidHex').oninput=()=>{if(/^#[0-9a-f]{6}$/i.test($('solidHex').value)){$('solidColor').value=$('solidHex').value;$('solidHex').setCustomValidity('');}else $('solidHex').setCustomValidity('请输入六位十六进制颜色');};
 $('solid').onclick=()=>{if(!$('solidHex').checkValidity()||!/^#[0-9a-f]{6}$/i.test($('solidHex').value)){$('solidHex').setCustomValidity('请输入六位十六进制颜色');$('solidHex').reportValidity();return;}display({type:'solid',path:'',color:$('solidHex').value.toLowerCase()}).then(()=>{emit();return palette();}).catch(e=>report(e.message));};
 for(const type of ['dragover','drop'])document.addEventListener(type,e=>{e.preventDefault();});
 $('preview').ondragover=e=>{e.preventDefault();$('preview').classList.add('dragging');};$('preview').ondragleave=()=>$('preview').classList.remove('dragging');
 $('preview').ondrop=async e=>{e.preventDefault();$('preview').classList.remove('dragging');const item=[...e.dataTransfer.items].find(x=>x.kind==='file');const pending=item?.getAsFileSystemHandle?.(),file=e.dataTransfer.files[0];if(!file)return;try{if(!/^(image|video)\//.test(file.type))throw Error('仅支持图片或视频');const h=await pending;if(h){const w=await selected(h);if(!w)return;const permission=await h.queryPermission({mode:'read'});$('authorize').hidden=false;report('壁纸已预览。请点击“授权已拖入文件”并允许后续访问，以便重启恢复。');if(permission==='granted'){emit();await palette();}}else{await display({type:file.type.startsWith('image/')?'image':'video',path:'',name:file.name,crop:{x:50,y:50}},file);report('仅临时预览；请使用选择文件并授权保存原文件引用。');}}catch(error){report(error.message);}};
 $('preview').onpointerdown=e=>{if(e.button!==0||!node)return;drag={x:e.clientX,y:e.clientY,crop:wallpaper.crop||{x:50,y:50}};$('preview').setPointerCapture(e.pointerId);};
 $('preview').onpointermove=e=>{if(!drag)return;const rect=$('preview').getBoundingClientRect();wallpaper.crop={x:Math.max(0,Math.min(100,drag.crop.x-(e.clientX-drag.x)/rect.width*100)),y:Math.max(0,Math.min(100,drag.crop.y-(e.clientY-drag.y)/rect.height*100))};node.style.objectPosition=`${wallpaper.crop.x}% ${wallpaper.crop.y}%`;};
 $('preview').onpointerup=()=>{if(drag){drag=null;if(wallpaper.reference||wallpaper.type==='builtin'||wallpaper.path)emit();}};
 const receive=async changes=>{const value=changes.wallpaperSelection?.newValue;if(value?.request!==request)return;try{await display(value.wallpaper);$('authorize').hidden=true;emit();await palette();report('授权完成并已生成配色，请保存主题。');}catch(e){report(e.message);}};
 chrome.storage.onChanged.addListener(receive);
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!=='https://zjuers.com'||e.data?.type!=='EDITOR_THEME')return;const t=HomeThemeCore.normalizeTheme(e.data.theme);editingTheme=t;advanced.update(t);$('palette').disabled=t.id==='default';handleId=t.wallpaper.reference||'';preparedHandle=null;if(handleId){const id=handleId;HomeFileHandles.read(id).then(h=>{if(handleId===id)preparedHandle=h;}).catch(()=>{});}visuals=t.visuals;ratio=Math.max(.3,Math.min(5,Number(e.data.ratio)||16/9));setRatio(ratio,e.data.measured===true);document.documentElement.classList.add('theme-applying');for(const [key,value]of Object.entries(t.colors))document.documentElement.style.setProperty('--theme-'+key,value);getComputedStyle(document.body).color;document.documentElement.dataset.themeReady='true';document.documentElement.classList.remove('theme-applying');display(t.wallpaper).catch(error=>{handleId=t.wallpaper.reference||'';$('authorize').hidden=!handleId;report(error.message);});});
 if(standalone){chrome.runtime.sendMessage({type:'HOME_EXTERNAL',action:'themes-get'}).then(reply=>{const state=reply?.value?.state,t=state?.themes.find(t=>t.id===state.activeId);if(t)for(const [k,v]of Object.entries(t.colors))document.documentElement.style.setProperty('--theme-'+k,v);getComputedStyle(document.body).color;document.documentElement.dataset.themeReady='true';document.documentElement.classList.remove('theme-applying');}).catch(()=>{getComputedStyle(document.body).color;document.documentElement.dataset.themeReady='true';document.documentElement.classList.remove('theme-applying');});document.body.classList.add('standalone');report('点击“选择文件并授权”继续。请选择允许每次访问，以便浏览器重启后恢复。');$('choose').textContent=params.has('reference')?'授权此文件':'选择文件并授权';}
 const editorResizeObserver=!standalone?new ResizeObserver(queueEditorHeight):null;editorResizeObserver?.observe(document.body);
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!=='https://zjuers.com'||e.data?.type!=='EDITOR_VISUALS')return;if(e.data.themeId)editingTheme.id=e.data.themeId;editingTheme.visuals=HomeThemeCore.normalizeVisuals(e.data.visuals);if(e.data.colors)editingTheme.colors={...editingTheme.colors,...e.data.colors};if(e.data.paletteSettings)editingTheme.paletteSettings=HomeThemeCore.normalizePaletteSettings(e.data.paletteSettings);if(e.data.lockedColors)editingTheme.lockedColors=e.data.lockedColors;if(e.data.generatedColors)editingTheme.generatedColors=e.data.generatedColors;advanced.update(editingTheme);visuals=HomeThemeCore.normalizeVisuals(e.data.visuals);if(node){node.style.transform=`scale(${visuals.scale/100})`;node.style.filter=`brightness(${visuals.brightness}) grayscale(${visuals.grayscale}%)`;}document.documentElement.classList.add('theme-applying');for(const [key,value]of Object.entries(e.data.colors||{}))if(/^[a-zA-Z]+$/.test(key)&&/^#[0-9a-f]{6}$/i.test(value))document.documentElement.style.setProperty('--theme-'+key,value);getComputedStyle(document.body).color;document.documentElement.classList.remove('theme-applying');});
 window.addEventListener('pagehide',()=>{previewResizeObserver.disconnect?.();editorResizeObserver?.disconnect?.();if(previewFrame!==null)cancelAnimationFrame(previewFrame);if(heightFrame!==null)cancelAnimationFrame(heightFrame);cleanup();advanced.destroy();chrome.storage.onChanged.removeListener(receive);});
})();
