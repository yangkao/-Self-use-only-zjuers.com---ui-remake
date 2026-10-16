/* SPDX-License-Identifier: GPL-3.0-only. Temporary local-file preview, never uploaded. */
(()=>{
 globalThis.HomeWallpaper={initialize(root,options){
  const container=root.querySelector('.wallpaper');let node,theme,disposed=false,generation=0;
  const stop=()=>{if(node?.tagName==='VIDEO'){node.pause();node.removeAttribute('src');node.load();}node?.remove();node=null;};
  const visibility=()=>{if(node?.tagName!=='VIDEO')return;if(document.hidden)node.pause();else node.play().catch(()=>{});};document.addEventListener('visibilitychange',visibility);
  return {sessionId:'demo-'+crypto.randomUUID(),setMuted(muted){if(node?.tagName==='VIDEO'){node.muted=muted;if(!muted)node.play().catch(()=>root.dispatchEvent(new CustomEvent('wallpaper-audio',{detail:{blocked:true}})));}},
   load(value,{analyze=false}={}){const version=++generation;theme=value;stop();container.querySelector('video')?.remove();if(disposed)return;const available=HomeDemo.media.has(theme.wallpaper.reference);node=document.createElement(available&&theme.wallpaper.type==='video'?'video':'img');node.className='demo-wallpaper';node.style.objectPosition=`${theme.wallpaper.crop?.x??50}% ${theme.wallpaper.crop?.y??50}%`;if(node.tagName==='VIDEO'){node.muted=theme.muted!==false;node.loop=true;node.playsInline=true;node.autoplay=!document.hidden;}
    const current=node;current.crossOrigin='anonymous';current.addEventListener(current.tagName==='VIDEO'?'loadeddata':'load',()=>{if(disposed||version!==generation)return;if(analyze){try{const c=document.createElement('canvas');c.width=96;c.height=54;c.getContext('2d').drawImage(current,0,0,96,54);options.onPalette?.(HomeThemeCore.paletteFromPixels([c.getContext('2d').getImageData(0,0,96,54).data]),{themeId:theme.id});}catch{options.onError?.('演示取色失败',{themeId:theme.id,analysisError:true});}}if(current.tagName==='VIDEO')visibility();},{once:true});
    if(theme.wallpaper.reference&&!available)HomeDemo.notify('上次选择的本机媒体只保留于当次演示，请重新选择。当前使用演示壁纸。');
    current.src=HomeDemo.mediaURL(theme.wallpaper);container.prepend(current);
   },dispose(){disposed=true;generation++;stop();document.removeEventListener('visibilitychange',visibility);}};
 }};
})();
