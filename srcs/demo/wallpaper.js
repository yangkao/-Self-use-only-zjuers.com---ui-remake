/* SPDX-License-Identifier: GPL-3.0-only. Temporary local-file preview, never uploaded. */
(()=>{
 globalThis.HomeWallpaper={initialize(root,options){
  const container=root.querySelector('.wallpaper');let node,theme,disposed=false,generation=0,glass=null,surface=null;
  const status=(effective,reason='')=>root.dispatchEvent(new CustomEvent('home-surface-status',{detail:{effective,reason}}));
  const releaseGlass=()=>{glass?.destroy();glass=null;};
  function syncSurface(){
   if(!theme||!node||disposed)return;
   if(surface?.material==='liquid'&&globalThis.HomeGlassMedia){
    if(!glass){glass=HomeGlassMedia.create({container,onStatus:s=>status(s.effective,s.reason)});glass.setSource(node,theme);}
    glass.setTheme({...theme,colors:surface.theme?.colors||theme.colors,visuals:surface.theme?.visuals||theme.visuals});glass.setLayout({...surface,visible:surface.visible!==false&&!document.hidden});
   }else{releaseGlass();if(surface?.material==='liquid')status('blend','此演示环境无法使用玻璃渲染器。');else status(surface?.material||'current');}
  }
  const stop=()=>{releaseGlass();if(node?.tagName==='VIDEO'){node.pause();node.removeAttribute('src');node.load();}node?.remove();node=null;};
  const visibility=()=>{if(node?.tagName!=='VIDEO')return;if(document.hidden)node.pause();else node.play().catch(()=>{});};document.addEventListener('visibilitychange',visibility);
  return {sessionId:'demo-'+crypto.randomUUID(),setSurface(layout){surface=layout;syncSurface();},setMuted(muted){if(node?.tagName==='VIDEO'){node.muted=muted;if(!muted)node.play().catch(()=>root.dispatchEvent(new CustomEvent('wallpaper-audio',{detail:{blocked:true}})));}},
   load(value,{analyze=false}={}){const version=++generation;theme=value;stop();container.querySelector('video')?.remove();if(disposed)return;const available=HomeDemo.media.has(theme.wallpaper.reference),solid=theme.wallpaper.type==='solid';node=document.createElement(solid?'div':available&&theme.wallpaper.type==='video'?'video':'img');node.className='demo-wallpaper';node.style.objectPosition=`${theme.wallpaper.crop?.x??50}% ${theme.wallpaper.crop?.y??50}%`;if(solid)node.style.backgroundColor=theme.wallpaper.color;if(node.tagName==='VIDEO'){node.muted=theme.muted!==false;node.loop=true;node.playsInline=true;node.autoplay=!document.hidden;}
    const current=node;current.crossOrigin='anonymous';current.addEventListener(current.tagName==='VIDEO'?'loadeddata':'load',()=>{if(disposed||version!==generation)return;if(analyze){try{const c=document.createElement('canvas');c.width=96;c.height=54;c.getContext('2d').drawImage(current,0,0,96,54);options.onPalette?.(HomeThemeCore.paletteFromPixels([c.getContext('2d').getImageData(0,0,96,54).data]),{themeId:theme.id});}catch{options.onError?.('演示取色失败',{themeId:theme.id,analysisError:true});}}if(current.tagName==='VIDEO')visibility();},{once:true});
    if(theme.wallpaper.reference&&!available)HomeDemo.notify('上次选择的本机媒体只保留于当次演示，请重新选择。当前使用演示壁纸。');
    if(!solid)current.src=HomeDemo.mediaURL(theme.wallpaper);container.prepend(current);syncSurface();
    if(solid&&analyze)options.onPalette?.(HomeThemeCore.paletteFromSolid(theme.wallpaper.color,theme.paletteSettings),{themeId:theme.id});
   },dispose(){disposed=true;generation++;stop();document.removeEventListener('visibilitychange',visibility);}};
 }};
})();
