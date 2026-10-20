/* UI-only policy. No storage, credentials, HTTP or personal fixtures. */
(function(root){
 'use strict';
 const forum='https://webvpn.zju.edu.cn/https/77726476706e69737468656265737421e7e056d22433310830079bab/';
 const key=q=>JSON.stringify(Object.fromEntries(Object.entries(q).sort(([a],[b])=>a.localeCompare(b))));
 function time(value){if(value==null||value==='')return '未知时间';const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'未知时间';}
 function safeURL(value){try{const u=new URL(value);if(u.username||u.password||u.port)return null;if(u.href.startsWith(forum)&&u.origin==='https://webvpn.zju.edu.cn')return u.href;return null;}catch{return null;}}
 // Fixed official hosts only. CFB hostname encoding matches all three existing VPN vectors.
 function avatarURL(value){try{
  if(typeof value!=='string'||!value.trim()||value.length>2000)return null;
  const u=new URL(value,'https://www.cc98.org/');if(u.username||u.password||u.port||u.protocol!=='https:')return null;
  const bases={'www.cc98.org':forum,'file.cc98.org':'https://webvpn.zju.edu.cn/https/77726476706e69737468656265737421f6fe4d9969336b09264686be9f/'};
  if(bases[u.hostname])return bases[u.hostname]+u.pathname.slice(1)+u.search;
  if(u.origin==='https://webvpn.zju.edu.cn'&&Object.values(bases).some(base=>u.href.startsWith(base)))return u.href;
  return null;
 }catch{return null;}}
 function cache({maxPages=10,maxItems=200,maxBytes=262144}={}){
  const map=new Map();let bytes=0,items=0;
  const size=e=>({bytes:new TextEncoder().encode(JSON.stringify(e)).length,items:e.data?.kind==='boards'?0:e.data?.items?.length||0});
  function remove(k){const v=map.get(k);if(!v)return;bytes-=v.bytes;items-=v.items;map.delete(k);}
  return {get(k){const v=map.get(k);if(!v)return null;map.delete(k);map.set(k,v);return v.entry;},put(k,entry){remove(k);const s=size(entry);map.set(k,{entry,...s});bytes+=s.bytes;items+=s.items;while(map.size&&(map.size>maxPages||items>maxItems||bytes>maxBytes))remove(map.keys().next().value);return entry;},removeWhere(test){for(const [k,v]of map)if(test(k,v.entry))remove(k);},clear(){map.clear();bytes=items=0;},stats(){return {pages:map.size,bytes,items};}};
 }
 function combine(entries){const available=entries.filter(e=>e?.data);if(!available.length)return entries.find(Boolean)||null;const last=available.at(-1),seen=new Set(),items=[];for(const e of available)for(const item of e.data.items||[]){const id=item.id==null?null:String(item.id);if(id&&seen.has(id))continue;if(id)seen.add(id);items.push(item);}const error=entries.find(e=>e?.status==='error');return {...last,...(error?{status:error.status,error:error.error,code:error.code,stale:true}:{}),data:{...last.data,items},newItemsDetected:available.some(e=>e.newItemsDetected)};}
 const api={forum,key,time,safeURL,avatarURL,cache,combine};root.HomeCC98UICore=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
