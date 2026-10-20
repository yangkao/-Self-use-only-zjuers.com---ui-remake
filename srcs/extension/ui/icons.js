(function(global){
 'use strict';
 const references={"courses": {"peak": 255, "width": 87, "bg": 68, "box": [9, 16, 65, 60], "height": 100, "file": "reference-courses.png"}, "assignments": {"peak": 255, "width": 63, "bg": 41, "box": [11, 7, 44, 48], "height": 60, "file": "reference-assignments.png"}, "air": {"peak": 255, "width": 85, "bg": 68, "box": [13, 12, 54, 52], "height": 78, "file": "reference-air.png"}, "工": {"peak": 236, "width": 67, "bg": 41, "box": [10, 6, 45, 39], "height": 49, "file": "reference-tools.png"}, "习": {"peak": 212, "width": 52, "bg": 41, "box": [11, 14, 29, 26], "height": 57, "file": "reference-study.png"}, "scholarship": {"peak": 212, "width": 45, "bg": 61, "box": [11, 8, 24, 28], "height": 48, "file": "reference-scholarship.png"}, "exam": {"peak": 177, "width": 76, "bg": 41, "box": [15, 6, 45, 45], "height": 54, "file": "reference-exam.png"}};
 let instance=0;
 function transparentReference(file,width,height,box,bg,peak,x,y,w,h){
  const id='cc98-ink-'+(++instance),scale=255/(peak-bg),offset=-bg/(peak-bg);
  return `<defs><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${scale} 0 ${offset}" result="ink"/><feComposite in="ink" in2="SourceGraphic" operator="in" result="shape"/><feFlood flood-color="currentColor"/><feComposite operator="in" in2="shape"/></filter></defs><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${box}" preserveAspectRatio="xMidYMid meet"><image href="${chrome.runtime.getURL('assets/'+file)}" width="${width}" height="${height}" filter="url(#${id})"/></svg>`;
 }
 const shapes={
  refresh:'<path d="M20 3.5v5.5h-5.5M20 9a8.5 8.5 0 1 0 .5 5"/>',
  scholarship:'<rect x="5" y="2.5" width="14" height="19" rx="1.8"/><path d="M8 7h8v3H8zM18 6h3M18 11h3M18 16h3"/>',
  教:'<path fill="currentColor" stroke="none" d="M2 21h20v-2H2ZM3 3h4v15H3Zm6 2h5v13H9Zm7-3h5v16h-5Z"/><path stroke="var(--theme-background)" d="M10.5 8h2M17 6h3"/>',
  浙:'<path fill="currentColor" stroke="none" fill-rule="evenodd" d="m12 2 7 5v2h4v13H1V9h4V7Zm0 3-5 3.6V20h3v-6h4v6h3V8.6ZM3 12v2h2v-2Zm0 5v2h2v-2Zm16-5v2h2v-2Zm0 5v2h2v-2Z"/><circle cx="12" cy="9.5" r="1.5"/>',
  学:'<path d="M14 21H4V3h13v7M7 7h7M7 11h5M7 15h3"/><circle cx="16" cy="15" r="4"/><path d="m19 18 3 3"/>',
  习:'<path d="m2 8 10-5 10 5-10 5ZM6 10v7q6 5 12 0v-7M22 8v9"/>',
  工:'<path d="M11 20H3V7h18v6M8 7V3h8v4M3 12h10M9 11v3h3v-3"/><path d="m15 22 5-5a4 4 0 0 0 1-5l-2 3-2-2 2-3a4 4 0 0 0-4 5l-4 4Z"/>',
  其:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 16.5v.2"/>',
  schedule:'<path d="M10 21H3V5h18v6M3 10h18M7 2v5M17 2v5"/><circle cx="16.5" cy="16.5" r="5"/><path d="M16.5 13.5v3l2 1"/>',
  assignments:'<path d="M12 21H4V3h13v6M7 7h7M7 11h5M7 15h3m3 6 1-5 6-8 3 2-6 9Z"/>',
  exam:'<path d="M12 21H3V3h16v8M7 7h8M7 11h6M7 15h3m3 7 1-4 6-6 3 3-6 6Z"/>',
  air:'<path fill="currentColor" stroke="none" d="M21 2C10 2 3 5 3 12c0 3 2 5 4 6l-3 3 1.5 1.5L19 7 9 18c7 3 13-4 12-16Z"/>',
  courses:'<path fill="currentColor" stroke="none" d="m12 2 11 5-11 5L1 7Zm-9 9 9 4 9-4 2 2-11 5L1 13Zm0 6 9 4 9-4 2 2-11 5L1 19Z"/>',
  event:'<path fill="currentColor" stroke="none" d="m14 2 8 8-3 1-3 5-1 4-5-5-7 7-1-1 7-7-5-5 4-1 5-3Z"/>'
 };
 function content(key){
  const ref=references[key];if(ref){
   const id='reference-ink-'+(++instance),scale=255/(ref.peak-ref.bg),offset=-ref.bg/(ref.peak-ref.bg);
   return `<defs><filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${scale} 0 ${offset}" result="ink"/><feFlood flood-color="currentColor"/><feComposite operator="in" in2="ink"/></filter></defs><svg x="1" y="1" width="22" height="22" viewBox="${ref.box.join(' ')}" preserveAspectRatio="xMidYMid meet"><image href="${chrome.runtime.getURL('assets/'+ref.file)}" width="${ref.width}" height="${ref.height}" filter="url(#${id})"/></svg>`;
  }
  if(key==='cc98'||key==='cc98Top')return transparentReference('cc98.ico',45,32,'0 0 45 32',0,255,0,0,19,19)+(key==='cc98'?transparentReference('reference-cc98-unread.png',76,51,'17 10 42 29',41,212,13,15,11,8):transparentReference('reference-cc98-hot.png',87,91,'21 13 44 66',68,255,15,12,9,12));
  return shapes[key];
 }
 function svg(key){return `<svg viewBox="0 0 24 24" aria-hidden="true" data-home-icon="${key}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${content(key)||''}</svg>`;}
 function element(key){const e=document.createElementNS('http://www.w3.org/2000/svg','svg');e.setAttribute('viewBox','0 0 24 24');e.setAttribute('aria-hidden','true');e.dataset.homeIcon=key;e.innerHTML=content(key)||'';return e;}
 global.HomeIcons={svg,element,has:key=>key in shapes||key==='cc98'||key==='cc98Top'};
})(globalThis);
