(function(global){
 'use strict';
 function initialize(root){
  if(root.__homeControls)return;root.__homeControls=true;
  const host=root.querySelector('.app')||document.body;if(!root.querySelector('link[href$="/controls.css"],link[href="ui/controls.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href=chrome.runtime.getURL('ui/controls.css');(root===document?document.head:root).append(style);}
  const controls=new Map();let opened=null,menu=null;
  function close(focus=false){if(!opened)return;const old=opened;opened=null;menu?.remove();menu=null;old.button.setAttribute('aria-expanded','false');if(focus&&old.button.isConnected)old.button.focus();}
  function open(record){if(opened===record){close();return;}close();opened=record;const {select,button}=record;menu=document.createElement('div');menu.className='ui-select-menu preview-control';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',button.getAttribute('aria-label'));button.setAttribute('aria-expanded','true');
   [...select.options].forEach((option,index)=>{if(option.hidden)return;const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.setAttribute('role','option');b.setAttribute('aria-selected',String(index===select.selectedIndex));b.disabled=option.disabled||option.parentElement.disabled===true;b.tabIndex=index===select.selectedIndex?0:-1;b.onclick=()=>{select.selectedIndex=index;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));sync(record);close(true);};menu.append(b);});host.append(menu);
   const r=button.getBoundingClientRect(),height=Math.min(260,innerHeight-24),below=innerHeight-r.bottom-12,above=r.top-12;menu.style.width=Math.min(Math.max(r.width,130),innerWidth-24)+'px';menu.style.left=Math.max(12,Math.min(r.left,innerWidth-menu.offsetWidth-12))+'px';menu.style.maxHeight=Math.max(60,Math.min(height,Math.max(below,above)))+'px';menu.style.top=(below>=Math.min(height,menu.scrollHeight)?r.bottom+5:Math.max(12,r.top-menu.offsetHeight-5))+'px';
   const active=menu.querySelector('[aria-selected=true]:not(:disabled)')||menu.querySelector('button:not(:disabled)');active?.focus();active?.scrollIntoView({block:'nearest'});
  }
  function sync(record){const {select,button}=record;const text=select.selectedOptions[0]?.textContent||'请选择';if(button.firstChild.textContent!==text)button.firstChild.textContent=text;if(button.disabled!==select.disabled)button.disabled=select.disabled;const name=select.getAttribute('aria-label')||record.name||'选择';if(button.getAttribute('aria-label')!==name)button.setAttribute('aria-label',name);}
  function enhance(select){if(controls.has(select)||select.multiple||select.size>1)return;const wrap=document.createElement('span'),button=document.createElement('button'),label=document.createElement('span');wrap.className='ui-select';button.type='button';button.className='ui-select-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.append(label);select.before(wrap);wrap.append(select,button);select.classList.add('ui-select-native');select.tabIndex=-1;const record={select,button,name:select.getAttribute('aria-label')||select.id||'选择'};controls.set(select,record);sync(record);button.onclick=()=>open(record);button.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();open(record);}};select.addEventListener('invalid',()=>button.focus());}
  function update(records){
   const changed=new Set();let removed=false;
   for(const m of records){
    const target=m.target.nodeType===1?m.target:m.target.parentElement,owner=target?.closest?.('select');if(owner)changed.add(owner);
    if(m.type==='childList'){
     removed ||= [...m.removedNodes].some(n=>n.nodeType===1);
     for(const node of m.addedNodes){if(node.nodeType!==1)continue;if(node.matches('select'))changed.add(node);for(const select of node.querySelectorAll('select'))changed.add(select);}
    }
   }
   if(removed)for(const [select,r]of controls)if(!select.isConnected){if(opened===r)close();controls.delete(select);}
   for(const select of changed){if(!select.isConnected)continue;enhance(select);const r=controls.get(select);if(r)sync(r);}
  }
  const observer=new MutationObserver(update);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected','aria-label','label'],characterData:true});
  for(const select of root.querySelectorAll('select'))enhance(select);
  root.addEventListener('change',e=>{const r=controls.get(e.target);if(r)sync(r);});
  root.addEventListener('pointerdown',e=>{if(opened&&!menu.contains(e.target)&&e.target!==opened.button&&!opened.button.contains(e.target))close();},true);
  root.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);return;}if(e.key==='Tab'){close(true);return;}const options=[...menu.querySelectorAll('button:not(:disabled)')],index=options.indexOf(root.activeElement||document.activeElement);let target;if(e.key==='ArrowDown')target=options[(index+1)%options.length];if(e.key==='ArrowUp')target=options[(index-1+options.length)%options.length];if(e.key==='Home')target=options[0];if(e.key==='End')target=options.at(-1);if(e.key.length===1&&!e.ctrlKey&&!e.altKey)target=options.find((b,n)=>n>index&&b.textContent.toLowerCase().startsWith(e.key.toLowerCase()))||options.find(b=>b.textContent.toLowerCase().startsWith(e.key.toLowerCase()));if(target){e.preventDefault();e.stopImmediatePropagation();target.focus();}},true);
  root.addEventListener('scroll',e=>{if(opened&&!menu.contains(e.target))close();},true);window.addEventListener('resize',()=>close());window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 }
 global.HomeControls={initialize};if(location.protocol==='chrome-extension:')initialize(document);
})(globalThis);


