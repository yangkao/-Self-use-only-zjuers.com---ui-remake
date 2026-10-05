(async function(){
 'use strict';
 let node,timer,disposed=false;
 const cleanup=()=>{clearTimeout(timer);if(node?.tagName==='VIDEO'){node.pause();node.removeAttribute('src');node.load();}node=null;};
 window.addEventListener('pagehide',()=>{disposed=true;cleanup();},{once:true});
 try{
  const id=new URL(location.href).searchParams.get('id');
  const saved=await chrome.storage.local.get('update1Themes');
  const theme=id==='default'?HomeThemeCore.defaultTheme():saved.update1Themes?.themes?.find(t=>t.id===id);
  if(!theme)throw new Error('missing');
  document.body.style.color=theme.colors?.text||'#f1e5f4';
  const builtin=theme.wallpaper.type==='builtin';
  if(!builtin&&!await new Promise(r=>chrome.extension.isAllowedFileSchemeAccess(r)))throw new Error('permission');
  if(disposed)return;
  const url=builtin?chrome.runtime.getURL('assets/wallpaper.mp4'):HomeThemeCore.fileURL(theme.wallpaper.path);
  if(!url)throw new Error('path');
  const video=builtin||theme.wallpaper.type==='video';
  node=document.createElement(video?'video':'img');
  if(video){node.muted=true;node.preload='auto';node.playsInline=true;}
  await new Promise((resolve,reject)=>{
   timer=setTimeout(()=>reject(new Error('timeout')),7000);
   node.addEventListener(video?'loadeddata':'load',resolve,{once:true});
   node.addEventListener('error',reject,{once:true});node.src=url;
  });
  if(disposed)return;
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const width=video?node.videoWidth:node.naturalWidth,height=video?node.videoHeight:node.naturalHeight;
  if(!width||!height)throw new Error('empty');
  const scale=Math.max(320/width,180/height);
  canvas.getContext('2d').drawImage(node,(320-width*scale)/2,(180-height*scale)/2,width*scale,height*scale);
  const img=document.createElement('img');img.alt='';img.src=canvas.toDataURL('image/jpeg',.75);
  cleanup();document.body.replaceChildren(img);
 }catch{
  cleanup();if(disposed)return;
  const label=document.createElement('p');label.textContent='壁纸不可用';document.body.replaceChildren(label);
 }
})();
