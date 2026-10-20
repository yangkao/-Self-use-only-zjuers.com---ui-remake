/* Project surfaces: shared DOM; materials change presentation only. */
(function(global){
 'use strict';
 const selectors={base:'.search-shell,.nav-card,.info-card,.widget-row.is-open,.rail-control:is(:hover,:has(:focus-visible),.is-active)',overlay:'.detail-shell,.settings-panel.open'};
 const changing='.main-view,.secondary-view,.widget-row,.rail-control,.nav-section,.collapse-region';
 function surfaceRect(element,measure){
  const source=measure(element).rect;let left=Math.max(0,source.left),top=Math.max(0,source.top),right=Math.min(innerWidth,source.right),bottom=Math.min(innerHeight,source.bottom);
  for(let node=element;node instanceof Element;node=node.parentElement){
   const {css,rect:clip}=measure(node);
   // inert blocks focus/pointer interaction; it does not hide painted content.
   if(css.display==='none'||css.visibility==='hidden'||Number(css.opacity)<=.02)return null;
   if(node!==element){if(/hidden|clip|auto|scroll/.test(css.overflowX)){left=Math.max(left,clip.left);right=Math.min(right,clip.right);}if(/hidden|clip|auto|scroll/.test(css.overflowY)){top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);}}
  }
  return right>left&&bottom>top?{x:left,y:top,width:right-left,height:bottom-top}:null;
 }
 function create({root,onLayout}){
  const app=root.querySelector('.app')||root;let theme=global.HomeThemeCore.defaultTheme(),requested='current',effective='current',raf=0,disposed=false,shown=!document.hidden,last='',lastReason='';
  const observed=new Set(),ids=new WeakMap();let nextId=0,motionUntil=0;
  const status=document.createElement('output');status.className='surface-status';status.setAttribute('role','status');status.hidden=true;app.append(status);
  function material(value){return global.HomeThemeCore.normalizeMaterial(value);}
  function display(value,reason=''){const changed=effective!==value;effective=value;lastReason=reason;app.dataset.material=value;app.dataset.materialRequested=requested;status.hidden=requested!=='liquid'||value==='liquid'||!reason;status.textContent=status.hidden?'':'液态玻璃暂不可用，已使用适度融合。'+reason;if(changed){last='';schedule();}}
  function send(){raf=0;if(disposed)return;
   const secondary=app.classList.contains('is-secondary'),panels=[],cache=new Map();
   const measure=element=>{if(!cache.has(element))cache.set(element,{css:getComputedStyle(element),rect:element.getBoundingClientRect()});return cache.get(element);};
   if(requested!=='liquid')for(const element of observed){resize.unobserve(element);observed.delete(element);}
   if(requested==='liquid'&&shown){
    // Floating windows retain their own CSS surface. Never remove the base
    // glass while a settings/detail window is open above it.
    const elements=[...root.querySelectorAll(selectors.base)].filter(element=>!(secondary&&element.closest('.main-view,.widget-rail,.search-shell'))&&!(!secondary&&element.closest('.secondary-view')));
    for(const element of [...observed])if(!elements.includes(element)){resize.unobserve(element);observed.delete(element);}
    for(const element of elements){if(!observed.has(element)){resize.observe(element);observed.add(element);}const rect=surfaceRect(element,measure);if(!rect)continue;const css=measure(element).css,isSearch=element.matches('.search-shell'),info=element.matches('.info-card'),settings=element.matches('.settings-panel'),widget=element.matches('.widget-row,.rail-control');
     const opacity=Number(theme.visuals[isSearch?'searchOpacity':info?'secondaryOpacity':settings?'panelOpacity':widget?'widgetOpacity':'cardOpacity'])/100;
     const color=theme.colors[isSearch?'search':info?'secondaryCard':settings?'panel':widget?'card':'card'];
     const tint=(color||theme.colors.card).slice(1).match(/../g).map(v=>parseInt(v,16)/255);
     if(!ids.has(element))ids.set(element,'home-surface-'+(++nextId));
     panels.push({id:ids.get(element),kind:isSearch?'search':'panel',x:rect.x,y:rect.y,w:rect.width,h:rect.height,radius:Math.min(parseFloat(css.borderTopLeftRadius)||0,rect.width/2,rect.height/2),opacity,tint});
    }
   }
   const payload={material:requested,panels,visible:shown,width:innerWidth,height:innerHeight,secondary,theme:{material:requested,visuals:theme.visuals,colors:theme.colors}};
   const serialized=JSON.stringify(payload);if(serialized!==last){last=serialized;onLayout?.(payload);}
   if(requested==='liquid'&&shown&&performance.now()<motionUntil)schedule();
  }
  function schedule(){if(!disposed&&!raf)raf=requestAnimationFrame(send);}
  // Observe only surface structure/state, not live text or every data attribute.
  const observer=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'?[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.(selectors.base+','+selectors.overlay)||n.querySelector?.(selectors.base+','+selectors.overlay))):r.target===app||r.target.matches?.(selectors.base+','+selectors.overlay+','+changing)))schedule();});
  observer.observe(app,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open']});
  const resize=new ResizeObserver(schedule);resize.observe(app);
  const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);return()=>target.removeEventListener(type,fn,options);};
  const hover=event=>{if(requested==='liquid'&&event.target.closest?.('.rail-control,.widget-row'))schedule();};
  const removers=[listen(root,'pointerover',hover),listen(root,'pointerout',hover),listen(root,'focusin',hover),listen(root,'focusout',hover),listen(root,'scroll',schedule,true),listen(window,'resize',schedule),listen(document,'visibilitychange',()=>{shown=!document.hidden;last='';schedule();}),listen(root,'home-surface-status',event=>{
   if(requested!=='liquid')return;const data=event.detail||{};if(data.effective==='liquid')display('liquid');else if(data.effective==='blend')display('blend',data.reason||'');
  }),listen(root,'transitionrun',event=>{if(!event.target.matches?.(selectors.base+','+changing)||!/transform|height|width|grid-template|opacity/.test(event.propertyName))return;motionUntil=performance.now()+600;schedule();}),listen(root,'transitionend',schedule),listen(root,'animationend',schedule),listen(window,'pagehide',event=>{if(!event.persisted)api.destroy();else api.setVisible(false);}),listen(window,'pageshow',()=>api.setVisible(!document.hidden))];
  const api={
   setTheme(value){theme=value;const previous=requested;requested=material(value.material);const reason=previous==='liquid'&&requested==='liquid'?lastReason:'';display(requested==='liquid'?(previous===requested&&effective==='liquid'?'liquid':'blend'):requested,reason);last='';schedule();},
   invalidateLayout(){last='';schedule();},
   setVisible(value){shown=Boolean(value);last='';schedule();},
   destroy(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();removers.forEach(remove=>remove());status.remove();onLayout?.({material:'current',panels:[],visible:false});delete app.dataset.material;delete app.dataset.materialRequested;},
   getState(){return {requested,effective};}
  };
  return api;
 }
 global.HomeSurface={create};
})(globalThis);
