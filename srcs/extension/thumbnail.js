(async function(){
 'use strict';
 let node,timer,disposed=false,objectURL="";
 const cleanup=()=>{clearTimeout(timer);if(objectURL){URL.revokeObjectURL(objectURL);objectURL="";}if(node?.tagName==='VIDEO'){node.pause();node.removeAttribute('src');node.load();}node=null;};
 window.addEventListener('pagehide',()=>{disposed=true;cleanup();},{once:true});
 try{
  const id=new URL(location.href).searchParams.get('id');
  const saved=await chrome.storage.local.get('update1Themes');
  const theme=saved.update1Themes?.themes?.find(t=>t.id===id)||(id==='default'?HomeThemeCore.defaultTheme():null);
  if(!theme)throw new Error('missing');
  document.body.style.color=theme.colors?.text||'#f1e5f4';
  const builtin=theme.wallpaper.type==='builtin';

  if(disposed)return;
  if(theme.wallpaper.type==='solid'){
   if(!/^#[a-f0-9]{6}$/i.test(theme.wallpaper.color))throw new Error('color');
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
   const context=canvas.getContext('2d');context.fillStyle=theme.wallpaper.color;context.fillRect(0,0,320,180);
   const img=document.createElement('img');img.alt='';img.src=canvas.toDataURL('image/jpeg',.75);canvas.width=canvas.height=0;
   document.body.replaceChildren(img);if(parent!==window)parent.postMessage({type:'THEME_THUMBNAIL',image:img.src},'https://zjuers.com');return;
  }
  const daily=theme.wallpaper.type==='bing'||builtin;const meta=daily?(typeof HomeBing!=='undefined'?await HomeBing.call('peek'):null):null;const url=daily?(meta?await HomeBing.url(meta):chrome.runtime.getURL('assets/fallback.svg')):await HomeFileHandles.url(theme.wallpaper);if(url.startsWith('blob:'))objectURL=url;
  if(!url)throw new Error('path');
  const video=theme.wallpaper.type==='video';
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
  const crop=HomeFileHandles.crop(width,height,320/180,theme.wallpaper.crop||{x:50,y:50});
  canvas.getContext('2d').drawImage(node,...crop,0,0,320,180);
  const img=document.createElement('img');img.alt='';img.src=canvas.toDataURL('image/jpeg',.75);
  cleanup();document.body.replaceChildren(img);if(parent!==window)parent.postMessage({type:'THEME_THUMBNAIL',image:img.src},'https://zjuers.com');
 }catch{
  cleanup();if(disposed)return;
  const label=document.createElement('p');label.textContent='壁纸不可用';document.body.replaceChildren(label);
 }
})();
