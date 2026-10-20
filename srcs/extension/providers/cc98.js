/* Device authorization and refresh; no Client Secret or webpage token access. */
(function(root){
 'use strict';
 const keys=['systemCount','atCount','replyCount','messageCount'];
 const api='https://webvpn.zju.edu.cn/https/77726476706e69737468656265737421f1e748d22433310830079bab/';
 const forum='https://webvpn.zju.edu.cn/https/77726476706e69737468656265737421e7e056d22433310830079bab/';
 function normalizeCounts(d){if(!keys.every(k=>Number.isSafeInteger(d?.[k])&&d[k]>=0))throw ExternalCore.problem('CC98 未读接口格式不匹配');return {...Object.fromEntries(keys.map(k=>[k,d[k]])),total:keys.reduce((n,k)=>n+d[k],0),url:forum};}
 function normalizeTop(d){
  if(!Array.isArray(d?.hotTopic))throw ExternalCore.problem('CC98 十大接口格式不匹配');
  const seen=new Set(),items=[];for(const topic of d.hotTopic){const id=String(topic?.id??'');if(!/^[1-9][0-9]*$/.test(id)||typeof topic.title!=='string'||!topic.title.trim())throw ExternalCore.problem('CC98 十大帖子格式不匹配');if(seen.has(id))continue;seen.add(id);items.push({id,title:topic.title.slice(0,500),url:forum+'topic/'+id});if(items.length===10)break;}return {items,url:forum};
 }
 const format=()=>ExternalCore.problem('CC98 返回格式不匹配','format');
 const object=d=>d!==null&&typeof d==='object'&&!Array.isArray(d);
 const id=d=>/^[1-9][0-9]*$/.test(String(d??''))?String(d):null;
 const number=d=>typeof d==='number'&&Number.isFinite(d)?d:null;
 const bool=d=>typeof d==='boolean'?d:null;
 function text(d,limit=500){return typeof d==='string'?d.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'').replace(/<[^>]*>/g,'').replace(/\[\/?[a-z][^\]]*\]/gi,'').slice(0,limit):null;}
 const time=d=>typeof d==='string'&&d.length<=80&&Number.isFinite(Date.parse(d))?d:null;
 function portrait(value){try{if(typeof value!=='string'||value.length>2000)return null;const u=new URL(value,'https://www.cc98.org/');if(u.hostname==='file.cc98.org'&&u.protocol==='http:')u.protocol='https:';return u.protocol==='https:'&&['www.cc98.org','file.cc98.org'].includes(u.hostname)&&!u.port&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 function array(d){if(!Array.isArray(d))throw format();return d;}
 function topic(d,boards){if(!object(d)||!id(d.id)||typeof d.title!=='string'||!d.title.trim())throw format();const boardId=id(d.boardId);return {id:id(d.id),title:text(d.title),url:forum+'topic/'+id(d.id),authorName:d.isAnonymous===true?'匿名':text(d.authorName??d.userName),isAnonymous:d.isAnonymous===true,time:time(d.time??d.createTime),hitCount:number(d.hitCount),lastPostTime:time(d.lastPostTime),boardId,boardName:text(d.boardName)??boards.get(boardId)??null};}
 function profile(d){if(!object(d)||!id(d.id)||typeof d.name!=='string')throw format();return {id:id(d.id),name:text(d.name),portraitUrl:portrait(d.portraitUrl),signature:text(d.signatureCode,4000),...Object.fromEntries(['wealth','prestige','fanCount','popularity','postCount','receivedLikeCount','signInCardCount'].map(k=>[k,number(d[k])]))};}
 function signIn(d){if(!object(d)||typeof d.hasSignedInToday!=='boolean')throw format();return {hasSignedInToday:d.hasSignedInToday,lastSignInTime:time(d.lastSignInTime),lastSignInCount:number(d.lastSignInCount),lastReward:number(d.lastReward)};}
 function monthItems(d,q){return array(d).map(item=>{if(!object(item)||item.year!==q.year||item.month!==q.month||!Number.isInteger(item.day)||item.day<1||item.day>new Date(Date.UTC(q.year,q.month,0)).getUTCDate())throw format();return {year:item.year,month:item.month,day:item.day,useCard:bool(item.useCard),reward:number(item.reward)};});}
 function create({request,vpn,storage,clientId,now=Date.now}){
  const localKey='cc98PrivateRefresh',accessKey='cc98PrivateAccess',deviceKey='cc98PrivateDevice';let tokenJob=null,pollJob=null,generation=0,storageWrites=Promise.resolve();
  // One bounded directory only; no private data or arbitrary per-board caches.
  const boardNames=new Map();let boardOwner=null,boardGeneration=-1,boardDirectory=null,boardJob=null,boardCheckedAt=0;
  const ready=Promise.all([storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})]);
  const commit=fn=>{const task=storageWrites.catch(()=>{}).then(fn);storageWrites=task;return task;};
  const fail=(text,code='cc98')=>ExternalCore.problem(text,code);
  async function read(area,key){await ready;return (await storage[area].get(key))[key];}
  async function post(path,params){await vpn.ensure();const r=await request(WebVPNProvider.oidc+path,{method:'POST',credentials:'include',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId(),...params}).toString()});if(r.type==='opaqueredirect'){vpn.reset();throw fail('WebVPN 登录失效，请重新连接后重试','interaction');}let d;try{d=await r.json();}catch{throw fail('CC98 授权服务响应不匹配');}return {r,d};}
  async function persist(d,g,expectedClient=clientId()){
   if(typeof d.access_token!=='string'||!d.access_token||String(d.token_type).toLowerCase()!=='bearer'||!Number.isFinite(d.expires_in)||d.expires_in<=0)throw fail('CC98 令牌响应不匹配');
   return commit(async()=>{if(g!==generation||expectedClient!==clientId())throw fail('CC98 授权已取消','cancelled');const id=expectedClient,old=await read('local',localKey);if(g!==generation||expectedClient!==clientId())throw fail('CC98 授权已取消','cancelled');if(d.refresh_token)await storage.local.set({[localKey]:{clientId:id,refresh:d.refresh_token}});else if(old?.clientId!==id)await storage.local.remove(localKey);if(g!==generation||expectedClient!==clientId())throw fail('CC98 授权已取消','cancelled');await storage.session.set({[accessKey]:{clientId:id,access:d.access_token,expiresAt:now()+d.expires_in*1000}});});
  }
  async function forget(){generation++;tokenJob=null;boardNames.clear();return commit(async()=>{await ready;await storage.local.remove(localKey);await storage.session.remove([accessKey,deviceKey]);});}
  async function access(force=false){if(tokenJob)return tokenJob;const g=generation,id=clientId(),check=()=>{if(g!==generation||id!==clientId())throw fail('CC98 授权已取消','cancelled');};const job=(async()=>{await vpn.ensure();check();const session=await read('session',accessKey);check();if(!force&&session?.clientId===id&&session.expiresAt>now()+30000)return session.access;const local=await read('local',localKey);check();if(!local?.refresh||local.clientId!==id)throw fail('请在设置中授权 CC98','configuration');const {r,d}=await post('connect/token',{grant_type:'refresh_token',refresh_token:local.refresh});check();if(!r.ok){if(d.error==='invalid_grant'){await forget();throw fail('CC98 授权已失效，请重新授权','auth-expired');}throw fail('CC98 刷新授权失败，请稍后重试');}await persist(d,g,id);check();return d.access_token;})();tokenJob=job;try{return await job;}finally{if(tokenJob===job)tokenJob=null;}}
  function context(signal){const g=generation,client=clientId();if(boardOwner!==client||boardGeneration!==g){boardNames.clear();boardDirectory=null;boardJob=null;boardCheckedAt=0;boardOwner=client;boardGeneration=g;}return {signal,check(){if(signal?.aborted||g!==generation||client!==clientId())throw fail('CC98 查询已取消','cancelled');}};}
  async function directory(ctx){
   ctx.check();if(boardDirectory&&now()-boardCheckedAt<1800000)return boardDirectory;
   if(!boardJob){const own=context();let job;job=readApi('board/all',d=>array(d).slice(0,200).map(section=>{if(!object(section)||!id(section.id)||typeof section.name!=='string')throw format();return {id:id(section.id),name:text(section.name),boards:array(section.boards).slice(0,1000).map(b=>{if(!object(b)||!id(b.id)||typeof b.name!=='string')throw format();return {id:id(b.id),name:text(b.name)};})};}),'版面目录',own).then(sections=>{own.check();boardNames.clear();for(const s of sections)for(const b of s.boards)if(boardNames.size<2000)boardNames.set(b.id,b.name);boardDirectory=sections;boardCheckedAt=now();return sections;}).finally(()=>{if(boardJob===job)boardJob=null;});boardJob=job;}
   const result=await boardJob;ctx.check();return result;
  }
  async function readApi(path,normalize,label,ctx=context()){
   ctx.check();let token=await access();ctx.check();
   const url=api+path+(path.includes('?')?'&':'?')+'vpn-12-o2-www.cc98.org';
   for(let n=0;n<2;n++){
    ctx.check();let r;try{r=await request(url,{method:'GET',credentials:'include',redirect:'manual',signal:ctx.signal,headers:{Authorization:'Bearer '+token}});}catch(e){ctx.check();if(['rate-limit','timeout','cancelled'].includes(e?.code)&&typeof e.publicMessage==='string')throw fail(e.publicMessage,e.code);if(e?.name==='AbortError')throw fail('CC98 查询已取消','cancelled');throw fail('CC98 '+label+'连接失败','network');}ctx.check();
    if(r.type==='opaqueredirect'||r.redirected||r.status>=300&&r.status<400){vpn.reset();throw fail('WebVPN 登录失效，请重新连接','interaction');}
    if(r.status===401&&n===0){token=await access(true);ctx.check();continue;}
    if(!r.ok)throw fail('CC98 '+label+'读取失败',({401:'auth-expired',403:'forbidden',404:'not-found',429:'rate-limit'})[r.status]||'unavailable');
    const contentType=r.headers?.get?.('content-type');if(contentType&&/html/i.test(contentType))throw format();
    let d;try{d=await r.json();}catch{ctx.check();throw format();}ctx.check();const result=normalize(d);ctx.check();return result;
   }
  }
  const unread=()=>readApi('me/unread-count',normalizeCounts,'未读信息');
  const top=()=>readApi('config/index',normalizeTop,'十大帖子');
  async function query(spec,{signal}={}){
   const ctx=context(signal);ctx.check();const q=root.CC98Core.normalizeQuery(spec),kind=q.kind;
   const get=(path,normalize=d=>d)=>readApi(path,normalize,kind,ctx);
   const pagePath=path=>path+'?'+new URLSearchParams({from:q.from,size:q.size});
   const list=items=>({kind,items,rawCount:items.length,...root.CC98Core.paging(q,items.length)});
   const recover=e=>{ctx.check();if(['cancelled','interaction','auth-expired','configuration','rate-limit'].includes(e.code))throw e;};
   async function basic(path,ids){if(!ids.length)return new Map();const params=new URLSearchParams();for(const i of [...new Set(ids)])params.append('id',i);const data=await get(path+'?'+params,array);const result=new Map();for(const row of data){if(!object(row)||!id(row.id))throw format();result.set(id(row.id),row);}return result;}
   if(kind==='unread')return {kind,counts:await get('me/unread-count',d=>{try{return normalizeCounts(d);}catch{throw format();}})};
   if(kind==='profile')return {kind,profile:await get('me',profile)};
   if(kind==='signin')return {kind,...await get('me/signin',signIn)};
   if(kind==='month')return {kind,year:q.year,month:q.month,items:await get('me/signin-in-month?'+new URLSearchParams({year:q.year,month:q.month}),d=>monthItems(d,q))};
   if(kind==='boards'){
    const sections=await directory(ctx);return {kind,items:sections,rawCount:sections.length};
   }
   if(kind==='top'){
    const items=await get('config/index',d=>{normalizeTop(d);const seen=new Set();return d.hotTopic.filter(t=>{const key=id(t.id);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,10).map(t=>topic(t,boardNames));});
    let meta;try{meta=await basic('topic/basic',items.map(t=>t.id));}catch(e){recover(e);meta=new Map();}
    const merged=items.map(t=>{const b=meta.get(t.id);return b?{...t,boardId:t.boardId??id(b.boardId),boardName:t.boardName??boardNames.get(id(b.boardId))??null,lastPostTime:t.lastPostTime??time(b.lastPostTime)}:t;});
    // At most ten metadata GETs, at most two in flight; never /post or body APIs.
    let cursor=0;async function worker(){while(cursor<merged.length){const i=cursor++,t=merged[i];if(t.lastPostTime)continue;try{const extra=await get('topic/'+t.id,d=>topic(d,boardNames));merged[i]={...t,time:t.time??extra.time,hitCount:t.hitCount??extra.hitCount,lastPostTime:extra.lastPostTime,boardId:t.boardId??extra.boardId,boardName:t.boardName??extra.boardName,partial:!extra.lastPostTime};}catch(e){recover(e);merged[i]={...t,partial:true};}}}await Promise.all([worker(),worker()]);ctx.check();return list(merged);
   }
   if(kind==='new'&&(q.blocked||q.size===0))return list([]);
   if(kind==='new'||kind==='board'){
    const result=await get(pagePath(kind==='new'?'topic/new':'board/'+q.boardId+'/topic'),d=>array(d).map(t=>topic(t,boardNames)));
    if(result.some(t=>t.boardId&&!t.boardName)){try{await directory(ctx);}catch{ctx.check();}}
    ctx.check();return list(result.map(t=>({...t,boardName:t.boardName??boardNames.get(t.boardId)??null})));
   }
   if(kind==='contacts'){
    const rows=await get(pagePath('message/recent-contact-users'),d=>array(d).map(r=>{if(!object(r)||!id(r.userId))throw format();return {userId:id(r.userId),time:time(r.time),isRead:bool(r.isRead),lastContent:text(r.lastContent,1000)};}));let users;try{users=await basic('user/basic',rows.map(r=>r.userId));}catch(e){recover(e);users=new Map();}ctx.check();return list(rows.map(r=>({...r,name:text(users.get(r.userId)?.name),portraitUrl:portrait(users.get(r.userId)?.portraitUrl)})));
   }
   if(kind==='conversation')return list(await get(pagePath('message/user/'+q.peerId),d=>array(d).map(r=>{if(!object(r)||!id(r.id)||!id(r.senderId)||!id(r.receiverId)||typeof r.content!=='string')throw format();return {id:id(r.id),senderId:id(r.senderId),receiverId:id(r.receiverId),time:time(r.time),isRead:bool(r.isRead),content:text(r.content,12000),senderDeleted:bool(r.senderDeleted),receiverDeleted:bool(r.receiverDeleted),isBookMessage:bool(r.isBookMessage)};})));
   if(['replies','mentions','system'].includes(kind)){
    const rows=await get(pagePath('notification/'+({replies:'reply',mentions:'at',system:'system'})[kind]),d=>array(d).map(r=>{if(!object(r)||!id(r.id))throw format();const topicId=id(r.topicId);return {id:id(r.id),type:typeof r.type==='number'||typeof r.type==='string'?text(String(r.type),80):null,time:time(r.time),topicId,postId:id(r.postId),isRead:bool(r.isRead),url:topicId?forum+'topic/'+topicId:null,...(kind==='system'?{title:text(r.title),content:text(r.content,4000)}:{floor:number(r.postBasicInfo?.floor),userId:id(r.postBasicInfo?.userId),userName:text(r.postBasicInfo?.userName)})};}));
    if(kind==='system')return list(rows);let topics;try{topics=await basic('topic/basic',rows.map(r=>r.topicId).filter(Boolean));}catch(e){recover(e);topics=new Map();}ctx.check();return list(rows.map(r=>{const t=topics.get(r.topicId),boardId=id(t?.boardId);return {...r,title:text(t?.title),boardId,boardName:boardNames.get(boardId)??null,partial:!t};}));
   }
   throw fail('CC98 查询类型不支持','configuration');
  }
  async function start(){const g=++generation;await commit(()=>storage.session.remove(deviceKey));await vpn.ensure(true);const response=await request(WebVPNProvider.oidc+'.well-known/openid-configuration',{credentials:'include',redirect:'error'});if(!response.ok)throw fail('CC98 授权端点暂不可用');const metadata=await response.json(),endpoint=new URL(metadata.device_authorization_endpoint);if(endpoint.origin!=='https://openid.cc98.org'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw fail('CC98 设备授权端点不匹配');const {r,d}=await post(endpoint.pathname.replace(/^\//,''),{scope:'cc98-api offline_access'});if(!r.ok||typeof d.device_code!=='string'||typeof d.user_code!=='string'||!Number.isFinite(d.expires_in)||d.expires_in<=0)throw fail('CC98 设备授权申请失败');const verification=new URL(d.verification_uri);if(verification.origin!=='https://openid.cc98.org'||verification.username||verification.password)throw fail('CC98 验证地址不匹配');if(g!==generation)throw fail('授权已取消','cancelled');const interval=Math.max(5,Number(d.interval)||5),record={clientId:clientId(),code:d.device_code,userCode:d.user_code,url:WebVPNProvider.oidc+verification.pathname.replace(/^\//,'')+verification.search,expiresAt:now()+Math.min(d.expires_in,1800)*1000,interval,nextAt:now()+interval*1000};await commit(async()=>{if(g!==generation)throw fail('授权已取消','cancelled');await storage.session.set({[deviceKey]:record});});return deviceView(record);}
  function deviceView(d){return {status:'pending',userCode:d.userCode,url:d.url,expiresAt:d.expiresAt,interval:d.interval};}
  async function pollOnce(){const g=generation,d=await read('session',deviceKey);if(!d||d.clientId!==clientId())throw fail('设备授权尚未开始','configuration');if(now()>=d.expiresAt){await storage.session.remove(deviceKey);throw fail('设备授权已过期，请重新开始','auth-expired');}if(now()<d.nextAt)return deviceView(d);d.nextAt=now()+d.interval*1000;await storage.session.set({[deviceKey]:d});const {r,d:issued}=await post('connect/token',{grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:d.code});if(g!==generation)throw fail('授权已取消','cancelled');if(r.ok){await persist(issued,g);await storage.session.remove(deviceKey);return {status:'ready'};}if(['authorization_pending','slow_down'].includes(issued.error)){if(issued.error==='slow_down')d.interval+=5;d.nextAt=now()+d.interval*1000;await storage.session.set({[deviceKey]:d});return deviceView(d);}await storage.session.remove(deviceKey);throw fail(issued.error==='access_denied'?'CC98 授权被拒绝':'CC98 设备授权已结束，请重新开始','auth-expired');}
  function poll(){if(pollJob)return pollJob;const task=pollOnce().finally(()=>{if(pollJob===task)pollJob=null;});pollJob=task;return task;}
  async function status(){const d=await read('session',deviceKey),r=await read('local',localKey),a=await read('session',accessKey);return {configured:!!(r?.clientId===clientId()&&r.refresh||a?.clientId===clientId()&&a.access),...(d?.clientId===clientId()&&d.expiresAt>now()?{device:deviceView(d)}:{})};}
  return {unread,top,start,poll,forget,status,query};
 }
 root.CC98Provider={create,normalizeCounts,normalizeTop,forum};if(typeof module!=='undefined')module.exports=root.CC98Provider;
})(globalThis);
