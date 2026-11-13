(()=>{
 const source='https://zjuers.com';
 const dirty=new Set(),jobs=new Set();
 function state(){if(parent!==window)parent.postMessage({type:'SETTINGS_STATE',dirty:dirty.size>0,busy:jobs.size>0},source);}
 globalThis.HomeFrameState={clean(form){if(form===document)dirty.clear();else dirty.delete(form);state();},busy(id,value){value?jobs.add(id):jobs.delete(id);state();}};
 document.addEventListener('input',e=>{dirty.add(e.target.closest('form')||e.target);state();});
 function apply(value){document.documentElement.classList.add('theme-applying');HomeAppearance.apply(value,document.documentElement,{reveal:false});getComputedStyle(document.body).color;document.documentElement.dataset.themeReady='true';document.documentElement.classList.remove('theme-applying');}
 // Display-only endpoint: no wallpaper references or credentials reach these pages.
 if(parent===window)chrome.runtime.sendMessage({type:'HOME_EXTERNAL',action:'appearance-get'}).then(reply=>{if(!reply?.ok)throw Error('Appearance unavailable');apply(reply.value);}).catch(()=>{apply(HomeThemeCore.defaultTheme());});
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==source||e.data?.type!=='SETTINGS_THEME')return;apply({colors:e.data.colors,visuals:{...e.data.visuals,uiFont:e.data.font||e.data.visuals?.uiFont},material:e.data.material});});
 if(parent!==window){document.documentElement.classList.add('embedded');const main=document.querySelector('main');const report=()=>{if(main)parent.postMessage({type:'SETTINGS_HEIGHT',height:Math.ceil(main.getBoundingClientRect().height)},source);};if(main)new ResizeObserver(report).observe(main);document.fonts.ready.then(report);document.addEventListener('keydown',e=>{if(e.key==='Escape')parent.postMessage({type:'SETTINGS_ESCAPE'},source);});}
})();
