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
 function weatherNow(data){if(!Number.isFinite(data?.temperature?.value)||!data.condition?.text)throw problem('实时天气返回格式不匹配');return {temperature:data.temperature.value,text:data.condition.text,code:data.condition.code||null,feelsLike:data.feelsLike?.value??null,pressure:data.pressure||null,uvIndex:data.uvIndex??null,humidity:Number.isFinite(data.humidity)?Math.round(data.humidity*100):null,wind:data.wind||null,visibility:Number.isFinite(data.visibility?.value)?data.visibility.value/(data.visibility.unit==='m'?1000:1):null,attributions:data.metadata?.attributions||[]};}
 function weatherDaily(data){if(!Array.isArray(data?.days)||!data.days.length)throw problem('每日预报暂无数据');return {days:data.days.map(day=>({start:day.forecastStartTime,end:day.forecastEndTime,max:day.temperatureMax?.value??null,min:day.temperatureMin?.value??null,text:day.daytime?.condition?.text||null,code:day.daytime?.condition?.code||null})),attributions:data.metadata?.attributions||[]};}
 function quote(data){if(data?.type!=='k'||typeof data.hitokoto!=='string'||!data.hitokoto.trim())throw problem('一言未返回有效哲学名句');return {text:data.hitokoto,from:data.from||null,author:data.from_who||null};}
 function academicTerm(value=Date.now()){const d=new Date(value);if(!Number.isFinite(d.getTime()))throw problem('课表日期无效');const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'numeric'}).formatToParts(d);const y=Number(parts.find(p=>p.type==='year').value),m=Number(parts.find(p=>p.type==='month').value);return `${m>=9?y:y-1}-${m>=2&&m<=8?2:1}`;}
 function project(snapshot,mode='full',date,now=Date.now()){
  if(!['summary','secondary','status','full'].includes(mode))throw problem('数据视图无效');if(mode==='full')return snapshot;
  if(mode==='status')return {config:snapshot.config,projection:mode,entries:Object.fromEntries(Object.entries(snapshot.entries).filter(([,v])=>v).map(([k,v])=>[k,{status:v.status,updatedAt:v.updatedAt,error:v.error,count:v.data?.items?.length}]))};
  const day=date||new Date(now+28800000).toISOString().slice(0,10),entries={};
  const keys=mode==='summary'?['now','courses','exams','assignments','cc98','cc98Top','quote']:['now','daily','rain','courses','exams','assignments','quote'];
  for(const key of keys){const value=snapshot.entries[key];if(!value)continue;entries[key]={...value};const data=value.data;if(!data)continue;
   if(key==='courses'){
    const dates=[...new Set((data.items||[]).map(i=>i.date||i.start?.slice(0,10)).filter(Boolean))];
    let items=(data.items||[]).filter(i=>!(i.date||i.start)||(i.date||i.start.slice(0,10))===day);
    if(mode==='summary')items=items.filter(i=>!i.end||Date.parse(i.end)>now).sort((a,b)=>(Date.parse(a.start)||Infinity)-(Date.parse(b.start)||Infinity)).slice(0,20);
    entries[key].data={items:items.map(({schedule,...item})=>item),...(mode==='secondary'?{dates}:{}),graduateVisible:data.graduateVisible,partial:true};
   }else if(key==='rain'){entries[key].data={summary:data.summary,attributions:data.attributions};}
   else if(mode==='summary'&&key==='now'){entries[key].data={temperature:data.temperature,text:data.text,code:data.code};}
   else if(mode==='summary'&&key==='assignments'){entries[key].data={items:[...(data.items||[])].filter(i=>!i.deadline||Date.parse(i.deadline)>now).sort((a,b)=>(Date.parse(a.deadline)||Infinity)-(Date.parse(b.deadline)||Infinity)).slice(0,20)};}
   else if(mode==='summary'&&key==='exams'){entries[key].data={items:[...(data.items||[])].filter(i=>i.start&&Date.parse(i.start)>=now).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).slice(0,1)};}
  }
  return {entries,config:snapshot.config,projection:mode};
 }
 const api={problem,pool,cache,weatherHost,weatherNow,weatherDaily,quote,academicTerm,project};root.ExternalCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
