(function(root){
 'use strict';
 const definitions={weather:{name:'天气',source:'now'},courses:{name:'当天课程',source:'courses',defaults:{limit:5}},exams:{name:'最近考试',source:'exams'},assignments:{name:'最近作业',source:'assignments',defaults:{limit:5}},cc98:{name:'CC98 未读',source:'cc98'},cc98Top:{name:'CC98 十大',source:'cc98Top'},focus:{name:'专注计时',multiple:true,defaults:{name:'专注',minutes:25}},stopwatch:{name:'秒表',defaults:{name:'秒表'}},date:{name:'日期倒计时',multiple:true,defaults:{name:'重要日期',target:''}},interval:{name:'学习间隔',defaults:{name:'学习间隔',minutes:25,rest:5,cycles:4}}};
 const fail=()=>{throw Error('小组件配置无效');};
 function validate(value){
  if(!value||value.schemaVersion!==1||!Array.isArray(value.instances)||value.instances.length>60||Object.keys(value).some(k=>!['schemaVersion','instances'].includes(k)))fail();
  const ids=new Set(),types=new Set();
  for(const i of value.instances){const d=definitions[i.kind];if(!d||typeof i.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(i.id)||ids.has(i.id)||(!d.multiple&&types.has(i.kind))||typeof i.enabled!=='boolean'||Object.keys(i).some(k=>!['id','kind','enabled','config'].includes(k)))fail();ids.add(i.id);types.add(i.kind);
   if(!i.config||typeof i.config!=='object'||Array.isArray(i.config))fail();const expected=Object.keys(d.defaults||{}),legacyList=['courses','assignments'].includes(i.kind)&&Object.keys(i.config).length===0;if(!legacyList&&(Object.keys(i.config).length!==expected.length||expected.some(k=>!Object.hasOwn(i.config,k))))fail();
   for(const [k,v]of Object.entries(i.config)){if(k==='name'){if(typeof v!=='string'||!v.trim()||v.length>60)fail();}else if(k==='target'){if(typeof v!=='string'||(v&&!Number.isFinite(Date.parse(v))))fail();}else if(typeof v!=='number'||!Number.isFinite(v)||v<1||v>(k==='limit'?20:k==='cycles'?100:1440)||!Number.isInteger(v))fail();}
  }const result=structuredClone(value);for(const i of result.instances)if(['courses','assignments'].includes(i.kind)&&!Object.hasOwn(i.config,'limit'))i.config.limit=5;return result;
 }
 function defaults(){return {schemaVersion:1,instances:['weather','courses','exams','assignments','cc98'].map(kind=>({id:crypto.randomUUID(),kind,enabled:true,config:{...definitions[kind].defaults}}))};}
 function listItems(kind,data,limit=5,now=Date.now()){
  const today=new Date(now+28800000).toISOString().slice(0,10),items=data?.items||[];
  if(kind==='cc98Top')return items.slice(0,10);
  const field=kind==='assignments'?'deadline':'start';
  return items.filter(i=>{const start=Date.parse(i[field]);if(!Number.isFinite(start))return false;if(kind==='assignments')return start>=now;const end=Date.parse(i.end);return new Date(start+28800000).toISOString().slice(0,10)===today&&(Number.isFinite(end)?end>now:start>=now);}).sort((a,b)=>Date.parse(a[field])-Date.parse(b[field])).slice(0,limit);
 }
 function duration(i){return i.kind==='focus'?i.config.minutes*60000:i.kind==='interval'?(i.config.minutes*i.config.cycles+i.config.rest*(i.config.cycles-1))*60000:Infinity;}
 function clock(i,r={},now=Date.now()){
  if(i.kind==='date'){const end=Date.parse(i.config.target);return {elapsed:0,remaining:Number.isFinite(end)?Math.max(0,end-now):null,done:Number.isFinite(end)&&end<=now,running:Number.isFinite(end),deadline:end};}
  const elapsed=Math.max(0,(r.elapsed||0)+(r.running?Math.max(0,now-r.started):0)),total=duration(i),done=elapsed>=total;
  let phase='work',cycle=1,remaining=Number.isFinite(total)?Math.max(0,total-elapsed):null;
  if(i.kind==='interval'){const span=(i.config.minutes+i.config.rest)*60000;cycle=Math.min(i.config.cycles,Math.floor(elapsed/span)+1);const into=elapsed%span;phase=done?'complete':into<i.config.minutes*60000?'work':'rest';if(!done)remaining=(phase==='work'?i.config.minutes*60000:span)-into;}
  return {elapsed,remaining,done,running:!!r.running&&!done,phase,cycle,deadline:r.running&&Number.isFinite(total)?r.started+total-(r.elapsed||0):null};
 }
 function operate(i,r,action,now=Date.now()){const c=clock(i,r,now);if(action==='reset')return {running:false,elapsed:0,started:now,notified:false};if(action==='pause')return {...r,running:false,elapsed:c.elapsed,started:now};if(action==='start')return {running:true,elapsed:c.done?0:c.elapsed,started:now,notified:false};throw Error('未知计时操作');}
 const api={definitions,validate,defaults,listItems,duration,clock,operate};root.HomeWidgetsCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
