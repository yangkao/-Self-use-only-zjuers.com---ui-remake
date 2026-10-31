(function(global){
 'use strict';
 function initialize(root){
  if(root.__homeControlsApi)return root.__homeControlsApi;
  const host=root.querySelector('.app')||document.body;let ownedStyle=null;if(!root.querySelector('link[href$="/controls.css"],link[href="ui/controls.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href=chrome.runtime.getURL('ui/controls.css');(root===document?document.head:root).append(style);ownedStyle=style;}
  const controls=new Map(),numbers=new Map(),bindings=new Map(),pendingMenus=new Set(),listeners=[],inkJobs=new Map();let opened=null,menu=null,destroyed=false;
  function expansionInk(container,clip,expanded){
   if(!container||!clip||destroyed)return;
   const previous=inkJobs.get(container);
   if(expanded&&(clip.classList.contains('home-ink-unclipped')||previous?.clip===clip))return;
   if(previous?.frame)cancelAnimationFrame(previous.frame);
   inkJobs.delete(container);clip.classList.remove('home-ink-unclipped');
   if(!expanded)return;
   const job={clip,frame:0};inkJobs.set(container,job);
   job.frame=requestAnimationFrame(()=>{job.frame=0;const animations=container.getAnimations?.()||[];
    Promise.allSettled(animations.map(a=>a.finished)).then(()=>{
     if(inkJobs.get(container)!==job)return;inkJobs.delete(container);
     if(!destroyed&&clip.isConnected)clip.classList.add('home-ink-unclipped');
    });
   });
  }
  function listen(target,type,handler,options,owner=listeners){target.addEventListener(type,handler,options);owner.push(()=>target.removeEventListener(type,handler,options));}
  function remember(element,names){const values=names.map(name=>[name,element.getAttribute(name)]);return ()=>{for(const [name,value]of values)value===null?element.removeAttribute(name):element.setAttribute(name,value);};}
  function clearMenu(record){clearTimeout(record.closeTimer);record.closeTimer=null;pendingMenus.delete(record);if(record.currentMenu){record.existingMenu?record.currentMenu.hidden=true:record.currentMenu.remove();record.currentMenu.classList.remove('is-closing');record.currentMenu=null;}}
  function close(focus=false){if(!opened)return;const old=opened,oldMenu=menu;opened=null;menu=null;old.button.setAttribute('aria-expanded','false');if(oldMenu){oldMenu.classList.add('is-closing');const requested=parseFloat(getComputedStyle(oldMenu).getPropertyValue('--visual-menuDuration')),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Number.isFinite(requested)?Math.max(0,requested):180;pendingMenus.add(old);old.closeTimer=setTimeout(()=>clearMenu(old),duration);}if(focus&&old.button.isConnected)old.button.focus();}
  function open(record){if(destroyed||record.destroyed)return;if(opened===record){close();return;}close();clearMenu(record);opened=record;const {select,button}=record;menu=record.existingMenu||document.createElement('div');record.currentMenu=menu;menu.classList.remove('is-closing');menu.hidden=false;if(!record.existingMenu)menu.className='ui-select-menu preview-control';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',button.getAttribute('aria-label'));button.setAttribute('aria-expanded','true');
   if(select)[...select.options].forEach((option,index)=>{if(option.hidden)return;const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.setAttribute('role','option');b.setAttribute('aria-selected',String(index===select.selectedIndex));b.disabled=option.disabled||option.parentElement.disabled===true;b.tabIndex=index===select.selectedIndex?0:-1;b.onclick=()=>{select.selectedIndex=index;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));sync(record);close(true);};menu.append(b);});host.append(menu);
   const r=button.getBoundingClientRect(),ink=record.existingMenu?0:19,height=Math.min(260+ink*2,innerHeight-24),below=innerHeight-r.bottom-12,above=r.top-12;menu.style.width=Math.min(Math.max(r.width,record.existingMenu?210:130)+ink*2,innerWidth-24)+'px';menu.style.left=Math.max(12,Math.min(r.left,innerWidth-menu.offsetWidth-12))+'px';menu.style.maxHeight=Math.max(60,Math.min(height,Math.max(below,above)))+'px';menu.style.top=(below>=Math.min(height,menu.scrollHeight)?r.bottom+5:Math.max(12,r.top-menu.offsetHeight-5))+'px';
   const active=menu.querySelector('[aria-selected=true]:not(:disabled)')||menu.querySelector('button:not(:disabled)');active?.focus();active?.scrollIntoView({block:'nearest'});
  }
  function sync(record){const {select,button}=record;const text=select.selectedOptions[0]?.textContent||'请选择';if(button.firstChild.textContent!==text)button.firstChild.textContent=text;if(button.disabled!==select.disabled)button.disabled=select.disabled;const name=select.getAttribute('aria-label')||record.name||'选择';if(button.getAttribute('aria-label')!==name)button.setAttribute('aria-label',name);}
  function enhance(select){if(controls.has(select)||select.multiple||select.size>1)return;const restore=remember(select,['class','tabindex']),wrap=document.createElement('span'),button=document.createElement('button'),label=document.createElement('span');wrap.className='ui-select';button.type='button';button.className='ui-select-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.append(label);select.before(wrap);wrap.append(select,button);select.classList.add('ui-select-native');select.tabIndex=-1;const record={select,button,wrap,restore,listeners:[],name:select.getAttribute('aria-label')||select.id||'选择'};controls.set(select,record);sync(record);button.onclick=()=>open(record);button.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open(record);}};listen(select,'invalid',()=>button.focus(),undefined,record.listeners);}
  function destroySelect(record){if(opened===record){opened=null;menu=null;}clearMenu(record);record.destroyed=true;record.listeners.forEach(remove=>remove());record.button.onclick=null;record.button.onkeydown=null;if(record.select.parentNode===record.wrap){record.wrap.before(record.select);}record.wrap.remove();record.restore();controls.delete(record.select);}
  function syncNumber(record){const disabled=record.input.matches(':disabled'),readOnly=record.input.readOnly;record.wrap.classList.toggle('is-disabled',disabled);record.wrap.classList.toggle('is-readonly',readOnly);for(const button of record.buttons)if(button.disabled!==(disabled||readOnly))button.disabled=disabled||readOnly;}
  function stepNumber(record,direction){
   const {input}=record;if(destroyed||record.destroyed||input.matches(':disabled')||input.readOnly)return;
   input.focus({preventScroll:true});const before=input.value;
   if(input.step.toLowerCase()==='any'){
    // Native stepUp/stepDown rejects step="any". Keep its validation contract,
    // and offer a unit increment bounded by the original min/max instead.
    const min=input.min===''?NaN:Number(input.min),max=input.max===''?NaN:Number(input.max);let value=(Number.isFinite(Number(before))?Number(before):0)+direction;
    if(Number.isFinite(min)&&Number.isFinite(max)&&min>max)return;
    if(Number.isFinite(min))value=Math.max(min,value);if(Number.isFinite(max))value=Math.min(max,value);
    if(Number.isFinite(value))input.value=String(value);
   }else direction>0?input.stepUp():input.stepDown();
   if(input.value===before)return;
   input.dispatchEvent(new Event('input',{bubbles:true}));record.committedValue=input.value;input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function enhanceNumber(input){
   if(numbers.has(input)||!input.matches('input[type=number]'))return;
   const wrap=document.createElement('span'),actions=document.createElement('span'),record={input,wrap,buttons:[],listeners:[],committedValue:null};wrap.className='ui-number';actions.className='ui-number-actions';input.before(wrap);wrap.append(input,actions);numbers.set(input,record);
   listen(input,'input',event=>{if(event.isTrusted)record.committedValue=null;},true,record.listeners);
   // After typing and clicking a custom stepper, the browser may commit that
   // same value again on blur. Consume only that one unchanged native commit;
   // real edits clear the marker and keep the original change handler intact.
   listen(input,'change',event=>{if(!event.isTrusted)return;const duplicate=record.committedValue!==null&&input.value===record.committedValue;record.committedValue=null;if(duplicate)event.stopImmediatePropagation();},true,record.listeners);
   for(const direction of [1,-1]){const button=document.createElement('button'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');button.type='button';button.tabIndex=-1;button.setAttribute('aria-label',direction>0?'增加数值':'减少数值');svg.setAttribute('viewBox','0 0 12 9');svg.setAttribute('aria-hidden','true');path.setAttribute('d',direction>0?'M2 6 6 2 10 6':'M2 3 6 7 10 3');svg.append(path);button.append(svg);actions.append(button);record.buttons.push(button);listen(button,'pointerdown',event=>event.preventDefault(),undefined,record.listeners);listen(button,'click',()=>stepNumber(record,direction),undefined,record.listeners);}
   syncNumber(record);
  }
  function destroyNumber(record){record.destroyed=true;record.listeners.splice(0).forEach(remove=>remove());if(record.input.parentNode===record.wrap){if(record.wrap.parentNode)record.wrap.before(record.input);else record.input.remove();}record.wrap.remove();numbers.delete(record.input);}
  function update(records){
   if(destroyed)return;const changed=new Set(),changedNumbers=new Set();let removed=false;
   for(const m of records){
    const target=m.target.nodeType===1?m.target:m.target.parentElement,owner=target?.closest?.('select');if(owner)changed.add(owner);
    if(target&&(numbers.has(target)||target.matches('input[type=number]')))changedNumbers.add(target);
    if(m.type==='attributes'&&m.attributeName==='disabled')for(const input of target.querySelectorAll('input[type=number]'))changedNumbers.add(input);
    if(m.type==='childList'){
     removed ||= [...m.removedNodes].some(n=>n.nodeType===1);
     for(const node of m.addedNodes){if(node.nodeType!==1)continue;if(node.matches('select'))changed.add(node);for(const select of node.querySelectorAll('select'))changed.add(select);if(node.matches('input[type=number]'))changedNumbers.add(node);for(const input of node.querySelectorAll('input[type=number]'))changedNumbers.add(input);}
    }
   }
   if(removed)for(const [select,r]of controls)if(!select.isConnected)destroySelect(r);
   if(removed)for(const [input,r]of numbers)if(!input.isConnected||input.parentNode!==r.wrap)destroyNumber(r);
   for(const select of changed){if(!select.isConnected)continue;enhance(select);const r=controls.get(select);if(r)sync(r);}
   for(const input of changedNumbers){const r=numbers.get(input);if(!input.isConnected||!input.matches('input[type=number]')){if(r)destroyNumber(r);continue;}enhanceNumber(input);syncNumber(numbers.get(input));}
  }
  const observer=new MutationObserver(update);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','type','selected','aria-label','label'],characterData:true});
  function refresh(){if(destroyed)return;for(const [select,record]of controls)if(!select.isConnected)destroySelect(record);for(const select of root.querySelectorAll('select')){enhance(select);const record=controls.get(select);if(record)sync(record);}for(const [input,record]of numbers)if(!input.isConnected||input.parentNode!==record.wrap||!input.matches('input[type=number]'))destroyNumber(record);for(const input of root.querySelectorAll('input[type=number]')){enhanceNumber(input);syncNumber(numbers.get(input));}}
  refresh();
  const controller={refresh,expansionInk,destroy(){if(destroyed)return;destroyed=true;for(const job of inkJobs.values())if(job.frame)cancelAnimationFrame(job.frame);inkJobs.clear();root.querySelectorAll('.home-ink-unclipped').forEach(e=>e.classList.remove('home-ink-unclipped'));observer.disconnect();listeners.splice(0).forEach(remove=>remove());for(const record of [...controls.values()])destroySelect(record);for(const record of [...numbers.values()])destroyNumber(record);for(const record of [...bindings.values()])record.api.destroy();for(const record of [...pendingMenus])clearMenu(record);ownedStyle?.remove();delete root.__homeControls;delete root.__homeControlsApi;},bindMenu({button,menu:existingMenu,onSelect}){
   if(destroyed)return;if(bindings.has(button))return bindings.get(button).api;
   const restoreButton=remember(button,['role','aria-haspopup','aria-controls','aria-expanded']),restoreMenu=remember(existingMenu,['class','role','aria-label','style']),originalParent=existingMenu.parentNode,originalNext=existingMenu.nextSibling,originalHidden=existingMenu.hidden,positions=['width','left','maxHeight','top'].map(key=>[key,existingMenu.style[key]]),restoreOptions=[...existingMenu.querySelectorAll('button')].map(option=>remember(option,['role','tabindex']));
   const record={button,existingMenu,listeners:[]};bindings.set(button,record);button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-controls',existingMenu.id);
   existingMenu.className='ui-select-menu engine-select-menu preview-control';existingMenu.hidden=true;
   for(const option of existingMenu.querySelectorAll('button')){option.setAttribute('role','option');option.tabIndex=-1;}
   listen(button,'click',()=>open(record),undefined,record.listeners);listen(button,'keydown',e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open(record);if(e.key==='Home')menu?.querySelector('button:not(:disabled)')?.focus();if(e.key==='End')[...menu.querySelectorAll('button:not(:disabled)')].at(-1)?.focus();}},undefined,record.listeners);
   listen(existingMenu,'click',e=>{const option=e.target.closest('button');if(!option||option.disabled||opened!==record)return;close();onSelect(option);},undefined,record.listeners);
   record.api={close:()=>{if(opened===record)close();},open:()=>open(record),destroy(){if(record.destroyed)return;record.destroyed=true;if(opened===record){opened=null;menu=null;}clearMenu(record);record.listeners.splice(0).forEach(remove=>remove());restoreButton();for(const [key,value]of positions)existingMenu.style[key]=value;restoreMenu();existingMenu.hidden=originalHidden;restoreOptions.forEach(restore=>restore());if(originalParent)originalParent.insertBefore(existingMenu,originalNext?.parentNode===originalParent?originalNext:null);else existingMenu.remove();bindings.delete(button);}};return record.api;
  }};
  root.__homeControls=true;root.__homeControlsApi=controller;
  listen(root,'change',e=>{const r=controls.get(e.target);if(r)sync(r);});
  listen(root,'pointerdown',e=>{if(opened&&!menu.contains(e.target)&&e.target!==opened.button&&!opened.button.contains(e.target))close();},true);
  listen(root,'keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);return;}if(e.key==='Tab'){close(true);return;}const options=[...menu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(root.activeElement||document.activeElement);let target;if(e.key==='ArrowDown')target=options[(index+1)%options.length];if(e.key==='ArrowUp')target=options[(index-1+options.length)%options.length];if(e.key==='Home')target=options[0];if(e.key==='End')target=options.at(-1);if(e.key.length===1&&!e.ctrlKey&&!e.altKey)target=options.find((b,n)=>n>index&&b.textContent.toLowerCase().startsWith(e.key.toLowerCase()))||options.find(b=>b.textContent.toLowerCase().startsWith(e.key.toLowerCase()));if(target){e.preventDefault();e.stopImmediatePropagation();target.focus();}},true);
  listen(root,'scroll',e=>{if(opened&&!menu.contains(e.target))close();},true);listen(window,'resize',()=>close());listen(window,'pagehide',event=>{if(event.persisted)close();else controller.destroy();});return controller;
 }
 global.HomeControls={initialize,bindMenu(root,options){initialize(root);return root.__homeControlsApi.bindMenu(options);}};if(location.protocol==='chrome-extension:')initialize(document);
})(globalThis);


