(function(g){
 'use strict';
 let database;
 function db(){return database||(database=new Promise((resolve,reject)=>{const r=indexedDB.open('zjuers-wallpaper-references',1);r.onupgradeneeded=()=>r.result.createObjectStore('handles');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
 async function read(id){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('handles').objectStore('handles').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function save(id,handle){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('handles','readwrite');t.objectStore('handles').put(handle,id);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}
 async function url(w){if(w.reference){const handle=await read(w.reference);if(!handle||await handle.queryPermission({mode:'read'})!=='granted')throw Error('请在壁纸设置中重新授权本地文件');return URL.createObjectURL(await handle.getFile());}if(!await new Promise(r=>chrome.extension.isAllowedFileSchemeAccess(r)))throw Error('请开启文件 URL 访问权限');const result=HomeThemeCore.fileURL(w.path);if(!result)throw Error('本地引用不可用');return result;}
 function crop(width,height,ratio=16/9,position={x:50,y:50}){let w=width,h=height;if(width/height>ratio)w=height*ratio;else h=width/ratio;return [(width-w)*position.x/100,(height-h)*position.y/100,w,h];}
 const api={read,save,url,crop};g.HomeFileHandles=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
