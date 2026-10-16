(()=>{
 const CACHE='zjuers-bing-daily-v1';
 async function call(action,args={}){const result=await chrome.runtime.sendMessage({type:'HOME_BING',action,...args});if(!result?.ok)throw Error(result?.error||'必应壁纸服务不可用');return result.value;}
 async function url(meta){const found=meta?.key&&await(await caches.open(CACHE)).match(meta.key);if(!found)throw Error('必应图片缓存不可用');return URL.createObjectURL(await found.blob());}
 globalThis.HomeBing={call,url};
})();
