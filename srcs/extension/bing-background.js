/* One shared daily image request. No account credentials are sent to Bing. */
(()=>{
 'use strict';
 const CACHE='zjuers-bing-daily-v1',KEY='bingDailyWallpaper';let flight,candidate,retryAfter=0,lastError='';
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const cacheKey=id=>'https://cn.bing.com/__zjuers_wallpaper__/'+encodeURIComponent(id);
 function imageURL(value){const u=new URL(value,'https://cn.bing.com');if(u.protocol!=='https:'||!['cn.bing.com','www.bing.com'].includes(u.hostname)||u.pathname!=='/th')throw Error('必应图片地址无效');u.searchParams.set('w','1920');u.searchParams.set('h','1080');u.searchParams.set('c','4');return u.href;}
 async function peek(){return (await chrome.storage.local.get(KEY))[KEY]||null;}
 async function prepare(){
  if(flight)return flight;
  if(Date.now()<retryAfter)throw Error(lastError||'必应壁纸稍后重试');
  flight=(async()=>{
   const old=await peek(),cache=await caches.open(CACHE);if(old?.checkedOn===today()&&await cache.match(old.key))return old;
   const response=await fetch('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN',{credentials:'omit',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('必应壁纸信息请求失败');const item=(await response.json()).images?.[0];if(!item?.url)throw Error('必应壁纸信息为空');
   const url=imageURL(item.url),id=String(item.hsh||item.urlbase||url).slice(0,400);
   if(old?.id===id&&await cache.match(old.key)){const next={...old,checkedOn:today()};await chrome.storage.local.set({[KEY]:next});return next;}
   const image=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(15000)});if(!image.ok||!/^image\//i.test(image.headers.get('content-type')||''))throw Error('必应图片下载失败');
   if(image.url)imageURL(image.url);const blob=await image.blob();if(!blob.size||blob.size>8*1024*1024)throw Error('必应图片大小无效');
   candidate={id,key:cacheKey(id),date:String(item.enddate||'').slice(0,8),title:String(item.title||'必应每日壁纸').slice(0,100),copyright:String(item.copyright||'').slice(0,300),checkedOn:today()};
   await cache.put(candidate.key,new Response(blob));for(const r of await cache.keys())if(r.url!==candidate.key&&r.url!==old?.key)await cache.delete(r);
   return candidate;
  })().catch(error=>{retryAfter=Date.now()+5*60000;lastError=error.message;throw error;}).finally(()=>flight=null);return flight;
 }
 async function commit(id,colors){
  const old=await peek();if(old?.id===id)return old;if(!candidate||candidate.id!==id)throw Error('壁纸候选已失效');
  const expected=Object.keys(HomeThemeCore.defaultTheme().colors);if(!colors||expected.some(k=>!/^#[0-9a-f]{6}$/i.test(colors[k]||'')))throw Error('壁纸配色无效');
  const next={...candidate,colors:Object.fromEntries(expected.map(k=>[k,colors[k].toLowerCase()]))};await chrome.storage.local.set({[KEY]:next});
  const cache=await caches.open(CACHE);for(const r of await cache.keys())if(r.url!==next.key)await cache.delete(r);candidate=null;return next;
 }
 chrome.runtime.onMessage.addListener((m,s,reply)=>{
  if(m?.type!=='HOME_BING')return;
  const allowed=['media.html','thumbnail.html','wallpaper-editor.html'].some(p=>s.url?.split('?')[0]===chrome.runtime.getURL(p));
  if(s.id!==chrome.runtime.id||!allowed){reply({ok:false,error:'不允许此操作'});return;}
  const task=m.action==='peek'?peek():m.action==='prepare'?prepare():m.action==='commit'&&s.url?.split('?')[0]===chrome.runtime.getURL('media.html')?commit(m.id,m.colors):Promise.reject(Error('未知壁纸操作'));
  task.then(value=>reply({ok:true,value}),e=>reply({ok:false,error:e.message}));return true;
 });
 globalThis.HomeBingBackground={peek,prepare,commit,imageURL};
})();
