/* Goose media adapter. Loaded only by the extension media frame in liquid mode. */
(() => {
 'use strict';
 const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
 function roundedPath(panel){
  const {x,y,w,h}=panel,r=Math.max(0,Math.min(number(panel.radius,0),w/2,h/2));
  return `M ${x+r} ${y} H ${x+w-r} A ${r} ${r} 0 0 1 ${x+w} ${y+r} V ${y+h-r} A ${r} ${r} 0 0 1 ${x+w-r} ${y+h} H ${x+r} A ${r} ${r} 0 0 1 ${x} ${y+h-r} V ${y+r} A ${r} ${r} 0 0 1 ${x+r} ${y} Z`;
 }
 function create({container,onStatus=()=>{}}){
  const canvas=document.createElement('canvas');
  Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1',display:'none'});
  canvas.setAttribute?.('aria-hidden','true');
  container.appendChild(canvas);
  let surface=null,source=null,sourceStyle=null,theme={},layout={visible:true,width:globalThis.innerWidth,height:globalThis.innerHeight,panels:[],secondary:false};
  let destroyed=false,failed=false,frame=null,frameKind='',lastStatus='';
  let sourceDirty=true,appliedVisuals='',appliedSize='',framesUploaded=0,effective='pending';
  const sourceEvents=['loadeddata','load','seeked','play','pause','ended','error'];
  const active=()=>!destroyed&&!failed&&layout.visible!==false&&!document.hidden&&layout.panels.length>0;
  function status(effective,reason=''){
   const key=effective+reason;if(key===lastStatus)return;lastStatus=key;
   onStatus({effective,reason});
  }
  function stop(){
   if(frame!==null){if(frameKind==='video')source?.cancelVideoFrameCallback?.(frame);else cancelAnimationFrame(frame);frame=null;}
   surface?.suspend?.();
  }
  function fail(reason){
   if(failed||destroyed)return;failed=true;stop();canvas.style.display='none';
   canvas.removeEventListener('webglcontextlost',contextLost);effective='blend';
   try{surface?.destroy();}catch{}surface=null;restoreSource();status('blend',reason);
  }
  function visuals(){
   const v=theme.visuals||{},secondary=Boolean(layout.secondary);
   return {scale:Math.max(.01,number(v.scale,100)/100+(secondary?.05:0)),brightness:Math.max(0,number(v.brightness,1)*(secondary?.71:1)),grayscale:Math.max(0,Math.min(1,number(v.grayscale,0)/100)),blur:Math.max(0,number(secondary?v.secondaryBlur:v.blur,0)),position:[number(theme.wallpaper?.crop?.x,50)/100,number(theme.wallpaper?.crop?.y,50)/100]};
  }
  function applyVisuals(){
   const v=visuals(),key=JSON.stringify(v);if(key!==appliedVisuals){surface?.setVisuals(v);appliedVisuals=key;}
   if(source?.style){source.style.filter=`brightness(${v.brightness}) blur(${v.blur}px) grayscale(${v.grayscale})`;source.style.transform=`scale(${v.scale})`;source.style.transformOrigin='50% 50%';}
  }
  function schedule(){
   if(!active()||frame!==null||source?.tagName!=='VIDEO'||source.paused||source.ended)return;
   if(typeof source.requestVideoFrameCallback==='function'){
    frameKind='video';frame=source.requestVideoFrameCallback(()=>{frame=null;sourceDirty=true;draw();schedule();});
   }else{
    frameKind='raf';frame=requestAnimationFrame(()=>{frame=null;sourceDirty=true;draw();schedule();});
   }
  }
  function draw(){
   if(!active()||!surface||!source)return;
   if(theme.wallpaper?.type==='solid'&&/^#[0-9a-f]{6}$/i.test(theme.wallpaper.color)){
    const v=visuals(),rgb=theme.wallpaper.color.slice(1).match(/../g).map(c=>parseInt(c,16)/255*v.brightness),gray=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    surface.setSolid(rgb.map(c=>c*(1-v.grayscale)+gray*v.grayscale));commit();return;
   }
   const ready=source.tagName==='VIDEO'?source.readyState>=2&&source.videoWidth>0:source.complete!==false&&source.naturalWidth>0;
   if(!ready)return;
   try{
    if(sourceDirty){if(surface.setSource(source)===false)return;sourceDirty=false;framesUploaded++;}
    commit();
   }catch(error){fail(error?.name==='SecurityError'?'Media texture blocked by origin policy':String(error?.message||'Media texture upload failed'));}
  }
  function commit(){
   surface.flush(()=>{
    if(!active())return;
    canvas.style.clipPath=layout.panels.length?`path('${layout.panels.map(roundedPath).join(' ')}')`:'inset(100%)';
    canvas.style.display='block';effective='liquid';status('liquid');
   });
  }
  function sourceChanged(event){
   if(event?.type==='error'){fail('Media source unavailable');return;}
   stop();sourceDirty=true;draw();schedule();
  }
  function restoreSource(){
   if(source){sourceEvents.forEach(name=>source.removeEventListener?.(name,sourceChanged));
    if(source.style&&sourceStyle)Object.assign(source.style,sourceStyle);
   }
   sourceStyle=null;
  }
  function visibilityChanged(){
   stop();canvas.style.display='none';if(active()){sourceDirty=true;draw();schedule();}
  }
  function contextLost(event){event.preventDefault();fail('WebGL context lost');}
  canvas.addEventListener('webglcontextlost',contextLost);
  document.addEventListener('visibilitychange',visibilityChanged);
  try{surface=new globalThis.ZJGGooseSurface(canvas);surface.onError=error=>fail(String(error?.message||'WebGL render failed'));}catch(error){fail(String(error?.message||'WebGL unavailable'));}
  return {
   setSource(mediaNode,nextTheme){
    if(destroyed||failed)return;stop();restoreSource();if(source!==mediaNode)surface?.clearSourceCache?.();source=mediaNode||null;sourceDirty=true;if(nextTheme)theme=nextTheme;
    if(source){sourceStyle={filter:source.style?.filter||'',transform:source.style?.transform||'',transformOrigin:source.style?.transformOrigin||''};sourceEvents.forEach(name=>source.addEventListener?.(name,sourceChanged));}
    applyVisuals();draw();schedule();if(!active())stop();
   },
   setTheme(nextTheme){if(destroyed||failed)return;theme=nextTheme||{};applyVisuals();draw();schedule();if(!active())stop();},
   setLayout(nextLayout){
    if(destroyed||failed)return;layout={...layout,...nextLayout};
    layout.panels=(layout.panels||[]).filter(p=>[p.x,p.y,p.w,p.h].every(Number.isFinite)&&p.w>0&&p.h>0);
    const width=Math.max(1,number(layout.width,1)),height=Math.max(1,number(layout.height,1)),size=`${width}x${height}`;
    if(size!==appliedSize){surface.setSize(width,height);appliedSize=size;}
    surface.setPanels(layout.panels);
    applyVisuals();if(active()){draw();schedule();}else{canvas.style.display='none';stop();}
   },
   getStats(){return {effective,framesUploaded,contextCount:surface?1:0,visible:active(),sourceKind:source?.tagName||null,scheduledFrame:frame!==null};},
   destroy(){
    if(destroyed)return;stop();destroyed=true;effective='destroyed';restoreSource();source=null;
    canvas.removeEventListener('webglcontextlost',contextLost);document.removeEventListener('visibilitychange',visibilityChanged);
    try{surface?.destroy();}catch{}surface=null;canvas.remove();
   }
  };
 }
 globalThis.HomeGlassMedia=Object.freeze({create});
})();
