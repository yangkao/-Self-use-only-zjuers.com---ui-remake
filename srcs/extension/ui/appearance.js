/* Theme appearance only: no media references, credentials or storage writes. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('../theme-core.js'));
 else root.HomeAppearance=factory(root.HomeThemeCore);
})(globalThis,function(Core){
 'use strict';
 function normalize(value){
  const fallback=Core.defaultTheme(),colors={...fallback.colors},input=value?.colors;
  for(const key of Object.keys(colors))if(typeof input?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(input[key]))colors[key]=input[key].toLowerCase();
  return {colors,visuals:Core.normalizeVisuals(value?.visuals)};
 }
 function encode(value){return JSON.stringify(normalize(value));}
 function decode(value){if(typeof value!=='string'||value.length>12000)return null;try{const data=JSON.parse(value);return data&&typeof data==='object'&&data.colors?normalize(data):null;}catch{return null;}}
 function apply(value,element,options={}){
  const look=normalize(value);
  for(const [key,color]of Object.entries(look.colors))element.style.setProperty('--theme-'+key,color);
  element.style.setProperty('--visual-focusGlow',String(look.visuals.focusGlow));
  element.style.setProperty('--visual-menuDuration',look.visuals.menuDuration+'ms');
  element.style.setProperty('font-family','"'+look.visuals.uiFont+'", DengXian, "Microsoft YaHei UI", sans-serif');
  if(options.reveal!==false)element.dataset.themeReady='true';
  return look;
 }
 return {normalize,encode,decode,apply};
});
