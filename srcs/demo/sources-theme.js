/* A product-description page can inherit demo appearance without extension APIs. */
(()=>{
 'use strict';
 const D=window.opener?.HomeDemo||(parent!==window?parent.HomeDemo:null);
 let theme;
 try{if(D){const state=D.theme();theme=state.themes.find(t=>t.id===state.activeId);}}catch{}
 if(!theme)try{
  const state=JSON.parse(localStorage.getItem('zjuers-demo-v1:themes'));
  theme=state?.themes?.find(t=>t.id===state.activeId);
  if(theme?.id==='default'){const palette=JSON.parse(localStorage.getItem('zjuers-demo-v1:bingPalette'));if(palette)theme.colors=palette;}
 }catch{}
 if(!theme){
  // This page is also usable as an ordinary static document.
  document.documentElement.dataset.themeReady='true';return;
 }
 for(const [key,color]of Object.entries(theme.colors||{}))if(/^#[0-9a-f]{6}$/i.test(color))document.documentElement.style.setProperty('--theme-'+key,color);
 document.documentElement.dataset.material=theme.material;
 if(['ZJUers Josefin','Segoe UI','Noto Sans CJK SC'].includes(theme.visuals?.uiFont))document.documentElement.style.fontFamily='"'+theme.visuals.uiFont+'", DengXian, "Microsoft YaHei UI", sans-serif';
 document.documentElement.dataset.themeReady='true';
})();
