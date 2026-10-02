(function(root){
 'use strict';
 function problem(message,code='unavailable'){return Object.assign(new Error(message),{publicMessage:message,code});}
 function pool(limit){let active=0;const queue=[];function next(){while(active<limit&&queue.length){const {task,resolve,reject}=queue.shift();active++;Promise.resolve().then(task).then(resolve,reject).finally(()=>{active--;next();});}}return task=>new Promise((resolve,reject)=>{queue.push({task,resolve,reject});next();});}
 function cache({now=Date.now,entries={},save=async()=>{}}){
  const jobs=new Map(),versions=new Map();let generation=0;
  const api={entries,invalidate(keys){for(const key of keys){versions.set(key,(versions.get(key)||0)+1);jobs.delete(key);}},clear(keys){if(!keys){generation++;for(const key of Object.keys(entries))delete entries[key];jobs.clear();}else for(const key of keys){versions.set(key,(versions.get(key)||0)+1);delete entries[key];jobs.delete(key);}},async get(key,ttl,task,{force=false}={}){
   if(jobs.has(key))return jobs.get(key);const old=entries[key];
   if(old?.code==='rate-limit'&&old.retryAt>now())return old;
   if(!force&&old&&(old.retryAt>now()||(old.status==='ready'&&now()-old.updatedAt<ttl)))return old;
   const version=generation,keyVersion=versions.get(key)||0;
   const work=Promise.resolve().then(async()=>{
    entries[key]={...old,status:'loading'};
    let result;
    try{const data=await task();result={data,status:'ready',updatedAt:now(),retryAt:0};}
    catch(error){result={...old,status:error.code==='configuration'?'configuration':'error',error:error.publicMessage||'连接失败，请稍后重试',code:error.code||'unavailable',retryAt:now()+(error.code==='rate-limit'?900000:120000)};}
    if(generation===version&&(versions.get(key)||0)===keyVersion){entries[key]=result;await save(entries);}
    return result;
   }).finally(()=>{if(jobs.get(key)===work)jobs.delete(key);});jobs.set(key,work);return work;
  }};return api;
 }
 function weatherHost(value){
  const raw=String(value||'').trim().replace(/^https:\/\//i,'').replace(/\/$/,'');
  if(raw.length>253||!/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+qweatherapi\.com$/i.test(raw))throw problem('请复制控制台的完整 API Host 域名（例如 xxx.xy.qweatherapi.com），不要附加接口路径','configuration');return raw.toLowerCase();
 }
 function weatherNow(data){if(!Number.isFinite(data?.temperature?.value)||!data.condition?.text)throw problem('实时天气返回格式不匹配');return {temperature:data.temperature.value,text:data.condition.text,code:data.condition.code||null,feelsLike:data.feelsLike?.value??null,humidity:Number.isFinite(data.humidity)?Math.round(data.humidity*100):null,wind:data.wind||null,visibility:Number.isFinite(data.visibility?.value)?data.visibility.value/(data.visibility.unit==='m'?1000:1):null,attributions:data.metadata?.attributions||[]};}
 function weatherDaily(data){if(!Array.isArray(data?.days)||!data.days.length)throw problem('每日预报暂无数据');return {days:data.days.map(day=>({start:day.forecastStartTime,end:day.forecastEndTime,max:day.temperatureMax?.value??null,min:day.temperatureMin?.value??null,text:day.daytime?.condition?.text||null,code:day.daytime?.condition?.code||null})),attributions:data.metadata?.attributions||[]};}
 function quote(data){if(data?.type!=='k'||typeof data.hitokoto!=='string'||!data.hitokoto.trim())throw problem('一言未返回有效哲学名句');return {text:data.hitokoto,from:data.from||null,author:data.from_who||null};}
 function academicTerm(value=Date.now()){const d=new Date(value);if(!Number.isFinite(d.getTime()))throw problem('课表日期无效');const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'numeric'}).formatToParts(d);const y=Number(parts.find(p=>p.type==='year').value),m=Number(parts.find(p=>p.type==='month').value);return `${m>=9?y:y-1}-${m>=2&&m<=8?2:1}`;}
 const api={problem,pool,cache,weatherHost,weatherNow,weatherDaily,quote,academicTerm};root.ExternalCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
