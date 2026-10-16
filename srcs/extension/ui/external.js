/* All remote values are rendered as text. This file never receives credentials. */
(function(root){
 'use strict';
 async function call(action,args={}){
  let r;try{r=await chrome.runtime.sendMessage({type:'HOME_EXTERNAL',action,...args});}
  catch(error){if(/Extension context invalidated/i.test(error?.message||''))throw new Error('扩展已重新加载，当前首页的连接已失效。请刷新当前首页后重试。');throw error;}
  if(!r?.ok)throw new Error(r?.error||'扩展后台暂未响应');return r.value;
 }
 const dateOf=(value=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 function clock(value){return value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'';}
 function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'?u.href:null;}catch{return null;}}
 function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
 function link(text,url){const e=element('a',text);const safe=safeLink(url);if(safe){e.href=safe;e.target='_blank';e.rel='noopener noreferrer';}return e;}
 function selectCourses(items,day,now=Date.now()){
  const current=[],past=[],unknown=[];
  for(const item of items||[]){if(!item.date&&!item.start){unknown.push(item);continue;}if((item.date||dateOf(item.start))!==day)continue;(item.end&&Date.parse(item.end)<=now?past:current).push(item);}
  const rank=i=>i.start&&i.end&&Date.parse(i.start)<=now&&Date.parse(i.end)>now?0:1;
  current.sort((a,b)=>rank(a)-rank(b)||(Date.parse(a.start)||Infinity)-(Date.parse(b.start)||Infinity));past.sort((a,b)=>(Date.parse(a.start)||0)-(Date.parse(b.start)||0));return {current,past,unknown};
 }
 function selectExams(items,all=false,now=Date.now()){
  const today=dateOf(now),limit=dateOf(now+14*86400000);
  return [...items].filter(i=>!i.date||(i.date>=today&&(!i.end||!Number.isFinite(Date.parse(i.end))||Date.parse(i.end)>now)&&(all||i.date<limit))).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(Date.parse(a.start)||0)-(Date.parse(b.start)||0));
 }
 function calendarDays(month){const [y,m]=month.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1)),offset=(first.getUTCDay()+6)%7;return Array.from({length:42},(_,i)=>new Date(Date.UTC(y,m-1,1-offset+i)).toISOString().slice(0,10));}
 function quoteAttribution(q){return [q.author,q.from?(/^《.*》$/.test(q.from)?q.from:`《${q.from}》`):null].filter(Boolean).join(' · ');}
 function compactRain(value){return String(value||'短时降水等待更新').replace(/未来两小时/g,'未来2小时').replace(/间歇性降雨还将持续(\d+)分钟/g,'间歇降雨约$1分钟').replace(/降雨还将持续(\d+)分钟/g,'降雨持续约$1分钟').replace(/(\d+)分钟后开始下雨/g,'约$1分钟后降雨');}
 function watchVideo(video,doc,report){
  let disposed=false,pending=false,lastTime=-1,stalls=0;video.loop=true;
  const resume=()=>{if(disposed||doc.hidden||video.style?.display==='none'||pending||(!video.paused&&!video.ended))return;pending=true;try{Promise.resolve(video.play()).then(()=>report('视频恢复播放'),()=>report('视频播放尝试失败')).finally(()=>{pending=false;});}catch{pending=false;report('视频播放尝试失败');}};
  const handlers={canplay:resume,pause:()=>{report('视频暂停');resume();},waiting:()=>report('视频缓冲等待'),stalled:()=>report('视频缓冲停滞'),error:()=>report('视频解码或资源错误'),playing:()=>{stalls=0;report('视频正在播放');}};
  for(const [name,fn]of Object.entries(handlers))video.addEventListener(name,fn);doc.addEventListener('visibilitychange',resume);resume();
  const timer=setInterval(()=>{if(doc.hidden||disposed||video.style?.display==='none')return;if(video.paused){resume();return;}if(video.readyState>=3&&video.currentTime===lastTime){if(++stalls===2){report('视频进度停滞，尝试恢复');video.pause();resume();}}else stalls=0;lastTime=video.currentTime;},10000);
  return ()=>{disposed=true;clearInterval(timer);for(const [name,fn]of Object.entries(handlers))video.removeEventListener(name,fn);doc.removeEventListener('visibilitychange',resume);};
 }
 function icon(kind){if(kind==='calendar'){const e=HomeIcons.element('schedule');e.classList.add('detail-icon');return e;}const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('detail-icon');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',kind==='place'?'M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13Zm0-16a3 3 0 1 0 0 6 3 3 0 0 0 0-6':kind==='calendar'?'M4 5h16v16H4ZM4 10h16M8 3v5M16 3v5M8 14h2M14 14h2M8 18h2':'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v6l4 2');svg.append(path);return svg;}
 function weatherIcon(text='',code,daytime=false){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 160 120');svg.setAttribute('aria-hidden','true');svg.classList.add('weather-symbol');
  const shape=(tag,attrs,cls)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));node.setAttribute('class',cls);svg.append(node);};
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  const night=!daytime&&(Number(code)>=150&&Number(code)<200||hour>=19||hour<7),fog=/雾|霾/.test(text),cloudy=/云|阴|雨|雷|雪/.test(text);
  if(fog){const bands=/薄雾|轻雾/.test(text)?[[32,32,86],[57,60,80],[28,88,105]]:[[55,22,83],[24,46,102],[57,70,102],[24,94,104]];for(const [i,[x,y,w]]of bands.entries())shape('rect',{x,y,width:w,height:12,rx:6},i%2?'weather-cloud-front':'weather-fog-band');return svg;}
  if(/云/.test(text)&&!/阴|雨|雷|雪/.test(text)&&!night){
   // Geometry and colors from the accepted MVP .sun/.cloud and its two shadows.
   svg.setAttribute('viewBox','0 0 150 120');shape('circle',{cx:100,cy:40,r:38},'weather-orb');shape('rect',{x:56,y:65,width:84,height:24,rx:12},'weather-cloud-shadow');shape('rect',{x:3,y:39,width:96,height:36,rx:18},'weather-cloud-back');shape('rect',{x:22,y:48,width:102,height:42,rx:21},'weather-cloud-front');return svg;
  }
  if(!cloudy){if(night)shape('path',{d:'M92 15a39 39 0 1 0 30 61 38 38 0 0 1-30-61Z'},'weather-orb');else shape('circle',{cx:80,cy:56,r:38},'weather-orb');return svg;}
  if(night&&/云/.test(text)&&!/阴|雨|雷|雪/.test(text))shape('path',{d:'M109 4a34 34 0 1 0 28 52 33 33 0 0 1-28-52Z'},'weather-orb');
  shape('rect',{x:68,y:13,width:64,height:32,rx:16},'weather-cloud-top');
  shape('rect',{x:20,y:35,width:96,height:36,rx:18},'weather-cloud-back');
  shape('rect',{x:47,y:50,width:105,height:38,rx:19},'weather-cloud-front');
  const mixed=/雨夹雪|雨雪/.test(text),heavy=/大雨|暴雨/.test(text),thunder=/雷/.test(text);
  if(mixed){for(const x of [42,73])shape('path',{d:`M${x} 101l-5 9`},'weather-rain');for(const x of [106,135])shape('circle',{cx:x,cy:106,r:4},'weather-cloud-back');}
  else if(/雨/.test(text))for(const x of heavy?[32,57,82,107,132]:thunder?[39,128]:[48,83,118])shape('path',{d:`M${x} 101l-5 9`},'weather-rain');
  else if(/雪/.test(text))for(const [x,y]of [[48,105],[83,112],[118,105]])shape('circle',{cx:x,cy:y,r:4},'weather-cloud-back');
  if(thunder)shape('path',{d:'M89 82 72 103h13l-7 15 25-26H90l7-10Z'},'weather-orb');return svg;
 }
 function initialize(view){
  const app=view.querySelector('.app'),settings=view.getElementById('settingsBody');
  let state={entries:{},config:{}},day=dateOf(),followToday=true,allExams=false,busy=0,timer,quoteRequested=false,quoteFinal=null,disposed=false,bootstrapped=false;
  const cards={now:view.querySelector('.weather-card'),courses:view.querySelector('.schedule-card'),exams:view.querySelector('.exam-card'),assignments:view.querySelector('.assignments-card')};
  const headings={now:['WEATHER / 天气','https://www.qweather.com/'],courses:['SCHEDULE / 今日课表','https://zdbk.zju.edu.cn/'],exams:['EXAMS / 近期考试','https://zdbk.zju.edu.cn/'],assignments:['COURSES / 近期作业','https://courses.zju.edu.cn/']};
  const bodies={};
  let calendarMonth=day.slice(0,7),calendarPanel,calendarButton;
  let stateVersion='',paintVersion='',snapshotFlight=null,startFlight=null;const cardVersions={};
  const projection=()=>app.classList.contains('is-secondary')?'secondary':'summary';
  function accept(result){if(result.projection&&result.projection!==projection()){void snapshot().catch(()=>{});return;}state=result;render();}
  function chooseDay(value){day=value;followToday=value===dateOf();if(calendarPanel){calendarPanel.hidden=true;calendarButton.setAttribute('aria-expanded','false');}void snapshot().then(()=>refresh(['courses'])).catch(()=>{});}
  function drawCalendar(){
   calendarPanel.replaceChildren();const bar=element('div',undefined,'calendar-bar');
   for(const [label,offset]of [['‹',-1],[calendarMonth,0],['›',1]]){const b=element('button',label,'small-action');b.type='button';if(offset){b.setAttribute('aria-label',offset<0?'上个月':'下个月');b.onclick=()=>{const [y,m]=calendarMonth.split('-').map(Number);calendarMonth=new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,7);drawCalendar();};}else b.disabled=true;bar.append(b);}calendarPanel.append(bar);
   const grid=element('div',undefined,'calendar-grid');for(const weekday of ['一','二','三','四','五','六','日'])grid.append(element('span',weekday,'calendar-weekday'));
   const dates=new Set(state.entries.courses?.data?.dates||(state.entries.courses?.data?.items||[]).map(i=>i.date||i.start&&dateOf(i.start)).filter(Boolean));
   for(const value of calendarDays(calendarMonth)){const b=element('button',String(Number(value.slice(-2))),'calendar-day');b.type='button';b.setAttribute('aria-label',value);b.classList.toggle('outside-month',!value.startsWith(calendarMonth));b.classList.toggle('selected',value===day);b.classList.toggle('today',value===dateOf());b.classList.toggle('has-course',dates.has(value));b.onclick=()=>chooseDay(value);grid.append(b);}calendarPanel.append(grid);const today=element('button','回到今天','small-action');today.onclick=()=>chooseDay(dateOf());calendarPanel.append(today);
  }
  for(const [key,card] of Object.entries(cards)){
   const headingIcon=card.querySelector('.eyebrow svg')?.cloneNode(true);card.replaceChildren();
   const top=element('div',undefined,'card-top'),heading=link(headings[key][0],headings[key][1]);heading.className='eyebrow source-heading';if(headingIcon)heading.prepend(headingIcon);top.append(heading);
   const controls=element('div',undefined,'card-controls');top.append(controls);card.append(top);
   bodies[key]=element('div',undefined,'live-content');card.append(bodies[key]);
   card.append(element('div',undefined,'card-source live-status'));
   if(key==='courses'){
    for(const [text,offset]of [['‹',-1],['今天',0],['›',1]]){const b=element('button',text,'small-action');b.type='button';b.setAttribute('aria-label',offset<0?'前一天':offset>0?'后一天':'今天');b.onclick=()=>{followToday=offset===0;day=offset?new Date(Date.parse(day+'T12:00:00+08:00')+offset*86400000).toISOString().slice(0,10):dateOf();void snapshot().then(()=>refresh(['courses'])).catch(()=>{});};controls.append(b);}
    calendarButton=element('button',undefined,'small-action calendar-toggle');calendarButton.type='button';calendarButton.append(icon('calendar'));calendarButton.setAttribute('aria-label','选择课表日期');calendarButton.setAttribute('aria-expanded','false');
    calendarPanel=element('div',undefined,'calendar-panel preview-control');calendarPanel.hidden=true;calendarPanel.setAttribute('role','group');calendarPanel.setAttribute('aria-label','课表日期选择');controls.append(calendarButton,calendarPanel);
    calendarButton.onclick=()=>{calendarPanel.hidden=!calendarPanel.hidden;calendarButton.setAttribute('aria-expanded',String(!calendarPanel.hidden));if(!calendarPanel.hidden){calendarMonth=day.slice(0,7);drawCalendar();}};
   }
   if(key==='exams'){const b=element('button','全部未来考试','small-action');b.type='button';b.onclick=()=>{allExams=!allExams;b.textContent=allExams?'未来 14 天':'全部未来考试';render();};controls.append(b);}
  }
  const heading=view.querySelector('.secondary-heading h1');heading.classList.add('quote-text');heading.textContent='';
  const quoteMeta=element('div',undefined,'quote-meta preview-control');heading.after(quoteMeta);
  function statusText(entry){if(!entry)return '等待更新';const updated=entry.updatedAt?new Date(entry.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';if(entry.status==='loading')return entry.data?`更新中 · 缓存 ${updated}`:'正在加载…';if(entry.status!=='ready')return `${entry.error||'暂不可用'}${entry.data?` · 旧缓存 ${updated}`:''}`;return updated?`更新于 ${updated}`:'已连接';}
  function foot(key){const e=state.entries[key],footer=cards[key].querySelector('.live-status');footer.textContent=statusText(e);footer.classList.toggle('is-error',!!e&&['error','configuration'].includes(e.status));if(e?.data?.warnings?.length){const warnings=e.data.warnings.filter(w=>!String(w.code).startsWith('GRADUATE')&&!['AUTH_EXPIRED','NETWORK'].includes(w.code));if(warnings.length)footer.append(element('div',[...new Set(warnings.map(w=>w.message||String(w)))].join('；')));}}
  function empty(target,text){target.append(element('p',text,'empty-state'));}
  function row(item,kind){
   const el=element('div',undefined,`live-row ${kind}-row`);
   if(kind==='course'&&item.start&&item.end&&Date.parse(item.start)<=Date.now()&&Date.parse(item.end)>Date.now())el.classList.add('ongoing');
   if(kind==='course'){const time=element('time',undefined,'course-time');time.append(icon('clock'),element('span',item.start?`${clock(item.start)} — ${clock(item.end)}`:item.period||'时间未确定'));el.append(time);}
   if(kind==='exam'&&item.date){const date=element('div',undefined,'date-block');date.append(element('strong',String(Number(item.date.slice(-2))).padStart(2,'0')),element('span',new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',month:'short'}).format(new Date(item.date+'T12:00:00+08:00')).toUpperCase()));el.append(date);}
   const content=element('div',undefined,'row-content'),title=element('div',undefined,kind==='exam'?'item-title exam-title':'item-title');if(kind!=='exam')title.append(element('span',undefined,'item-bullet'));title.append(link(item.title||'未命名',item.url||headings[kind==='assignment'?'assignments':kind==='exam'?'exams':'courses'][1]));content.append(title);
   const line=(text,kind)=>{const r=element('small',undefined,'item-detail');r.append(icon(kind),element('span',text));content.append(r);};
   if(kind==='assignment'){if(item.course)content.append(element('small',item.course,'item-course'));line(item.deadline?`截止 ${dateOf(item.deadline)} ${clock(item.deadline)}`:'无截止时间','clock');}
   else if(kind==='exam'){const details=element('small',undefined,'exam-details');const time=element('span',undefined,'inline-detail');const date=item.date?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',weekday:'short'}).format(new Date(item.date+'T12:00:00+08:00')):'日期未公布';time.append(icon('clock'),element('span',`${date} ${item.start?clock(item.start):item.period||'时间未公布'}${item.end?` — ${clock(item.end)}`:''}`));const place=element('span',undefined,'inline-detail');place.append(icon('place'),element('span',item.place||'地点未公布'));details.append(time,place);content.append(details);}
   else line([item.campus&&!item.place?.includes(item.campus)?item.campus:'',item.place||'地点未公布',item.source==='研究生院'?'研究生院':''].filter(Boolean).join(' · '),'place');
   el.append(content);
   if(kind==='assignment'&&item.deadline){const remaining=Date.parse(item.deadline)-Date.now();el.append(element('em',remaining<0?'已过截止':remaining<86400000?'不足 1 天':`${Math.ceil(remaining/86400000)} 天`));}
   return el;
  }
  function render(){
   const version=JSON.stringify({state,quoteFinal});
   if(version!==stateVersion){stateVersion=version;view.dispatchEvent(new CustomEvent('home-external-state',{detail:state}));}
   renderSettingsStatus();
   if(document.hidden||!app.classList.contains('is-secondary'))return;
   if(followToday)day=dateOf();
   const next=version+'|'+day+'|'+allExams+'|'+Math.floor(Date.now()/60000);
   if(next===paintVersion)return;paintVersion=next;
   const positions=Object.fromEntries(Object.entries(bodies).map(([key,b])=>[key,{scroll:b.scrollTop,details:[...b.querySelectorAll('details')].map(d=>d.open)}]));
   const signatures={now:JSON.stringify([state.config.location,state.config.weatherConfigured,state.entries.now,state.entries.daily,state.entries.rain]),courses:JSON.stringify([state.config.campusConfigured,state.entries.courses,day,Math.floor(Date.now()/60000)]),exams:JSON.stringify([state.config.campusConfigured,state.entries.exams,allExams,dateOf()]),assignments:JSON.stringify([state.config.campusConfigured,state.entries.assignments,Math.floor(Date.now()/60000)])};
   const changed=new Set(Object.keys(bodies).filter(k=>cardVersions[k]!==signatures[k]));for(const k of changed){bodies[k].replaceChildren();cardVersions[k]=signatures[k];}
   const e=state.entries,p=state.config.location;
   if(changed.has('now')){const weather=bodies.now;
   weather.append(element('div',p?`${p.adm2||p.adm1||''} · ${p.name}`:'尚未选择地点','weather-location'));
   if(e.now?.data){const d=e.now.data;const main=element('div',undefined,'weather-main'),readout=element('div',undefined,'weather-readout');readout.append(element('div',`${Math.round(d.temperature)}°`,'weather-temp'));const description=element('div',d.text,'weather-description');if(d.feelsLike!=null)description.append(element('small',`体感 ${Math.round(d.feelsLike)}°`));readout.append(description);main.append(readout,weatherIcon(d.text,d.code));weather.append(main);
    const metrics=element('div',undefined,'weather-metrics');const winds={n:'北',nne:'东北偏北',ne:'东北',ene:'东北偏东',e:'东',ese:'东南偏东',se:'东南',sse:'东南偏南',s:'南',ssw:'西南偏南',sw:'西南',wsw:'西南偏西',w:'西',wnw:'西北偏西',nw:'西北',nnw:'西北偏北',none:'无持续风向',vrb:'风向不定'};
    if(d.wind?.speed?.value!=null)metrics.append(element('span',`${winds[d.wind.direction?.compass]||'风速'} ${d.wind.speed.value} ${d.wind.speed.unit||''}`));if(d.humidity!=null)metrics.append(element('span',`湿度 ${d.humidity}%`));if(d.visibility!=null)metrics.append(element('span',`能见度 ${Number(d.visibility.toFixed(1))} km`));if(metrics.childNodes.length)weather.append(metrics);
   }else empty(weather,state.config.weatherConfigured?'实时天气等待更新':'请在设置中配置天气');
   const daily=e.daily?.data?.days?.find(d=>Date.parse(d.start)<=Date.now()&&Date.parse(d.end)>Date.now());
   const bottom=element('div',undefined,'weather-bottom');bottom.append(element('span',daily?`最高 ${daily.max==null?'—':Math.round(daily.max)}° / 最低 ${daily.min==null?'—':Math.round(daily.min)}°`:'今日最高／最低温暂无数据'),element('span',compactRain(e.rain?.data?.summary),'rain-summary'));weather.append(bottom);
   if(e.daily?.data?.days?.length){const forecast=element('div',undefined,'weather-forecast');for(const d of e.daily.data.days.slice(0,3)){if(!d.start||!Number.isFinite(Date.parse(d.start)))continue;const cell=element('div',undefined,'forecast-day'),top=element('div',undefined,'forecast-top');top.append(element('span',dateOf(d.start)===dateOf()?'今天':dateOf(d.start).slice(5)));if(d.text)top.append(weatherIcon(d.text,d.code,true));const description=element('div',undefined,'forecast-summary');if(d.text)description.append(element('span',d.text));description.append(element('small',`${d.max==null?'—':Math.round(d.max)}° / ${d.min==null?'—':Math.round(d.min)}°`));cell.append(top,description);forecast.append(cell);}weather.append(forecast);}
   const updates=element('small',undefined,'sub-source-status weather-updates');updates.append(element('span',`每日：${statusText(e.daily)}`),element('span',`降水：${statusText(e.rain)}`));weather.append(updates);
   const attribution=element('div',undefined,'weather-attribution');attribution.append(link('和风天气','https://www.qweather.com/'));weather.append(attribution);
   }
   if(changed.has('courses')){const courses=e.courses?.data;
   bodies.courses.append(element('div',day,'selected-day'));
   if(courses){const selected=selectCourses(courses.items,day);if(!selected.current.length&&!selected.past.length&&!selected.unknown.length)empty(bodies.courses,'当天没有课程');for(const item of selected.current)bodies.courses.append(row(item,'course'));if(selected.past.length){const details=element('details');details.append(element('summary',`已结束 · ${selected.past.length} 节`));for(const item of selected.past)details.append(row(item,'course'));bodies.courses.append(details);}if(selected.unknown.length){const details=element('details');details.append(element('summary',`日期待确定 · ${selected.unknown.length} 项`));for(const item of selected.unknown)details.append(row(item,'course'));bodies.courses.append(details);}if(courses.graduateVisible)bodies.courses.append(link('研究生信息源','https://yjsy.zju.edu.cn/'));}else empty(bodies.courses,state.config.campusConfigured?'课表等待更新':'请在设置中配置校内账户');
   }
   if(changed.has('exams')){if(e.exams?.data){const items=selectExams(e.exams.data.items,allExams);const known=items.filter(i=>i.date),unknown=items.filter(i=>!i.date);if(!known.length)empty(bodies.exams,allExams?'没有已公布的未来考试':'未来 14 天没有考试');for(const item of known)bodies.exams.append(row(item,'exam'));if(unknown.length){const details=element('details');details.append(element('summary',`时间待公布 · ${unknown.length} 项`));for(const item of unknown)details.append(row(item,'exam'));bodies.exams.append(details);}}else empty(bodies.exams,state.config.campusConfigured?'考试等待更新':'请先配置校内账户');
   }
   if(changed.has('assignments')){if(e.assignments?.data){const items=[...e.assignments.data.items].sort((a,b)=>(Date.parse(a.deadline)||Infinity)-(Date.parse(b.deadline)||Infinity));if(!items.length)empty(bodies.assignments,'学在浙大暂无学生待办');for(const item of items)bodies.assignments.append(row(item,'assignment'));}else empty(bodies.assignments,state.config.campusConfigured?'作业等待更新':'请先配置校内账户');
   }
   for(const key of changed){foot(key);bodies[key].querySelectorAll('details').forEach((d,i)=>{d.open=positions[key].details[i]===true;});bodies[key].scrollTop=positions[key].scroll;}
   const q=quoteFinal||e.quote;const quoteKey=JSON.stringify(q??null);if(heading.dataset.quote!==quoteKey){heading.dataset.quote=quoteKey;heading.textContent=q?.data?.text||'名句暂未加载';quoteMeta.replaceChildren();if(q?.data)quoteMeta.append(element('span',quoteAttribution(q.data)));if(q?.status!=='ready')quoteMeta.append(element('small',statusText(q)));}
   renderSettingsStatus();
  }
  function renderSettingsStatus(){settings.querySelectorAll('[data-source-status]').forEach(el=>{el.textContent=statusText(state.entries[el.dataset.sourceStatus]);});settings.querySelectorAll('[data-config-status]').forEach(el=>{el.textContent=el.dataset.configStatus==='campus'?(state.config.campusConfigured?'已保存账户 · 自动连接':'尚未配置账户'):(state.config.location?`${state.config.location.adm2||''} ${state.config.location.name}`:'尚未配置地点');});settings.querySelectorAll('[data-weather-references]').forEach(el=>{el.replaceChildren();const refs=[...new Set(['now','daily','rain'].flatMap(k=>state.entries[k]?.data?.attributions||[]))];if(!refs.length)el.textContent='暂无额外归属说明';for(const [i,url]of refs.entries()){if(i)el.append(' · ');el.append(link(`来源说明${refs.length>1?i+1:''}`,url));}});}
  function button(text,action,keys){const b=element('button',text,'setting-button');b.type='button';b.dataset.externalAction=action;if(keys)b.dataset.keys=keys.join(',');return b;}
  function settingsSection(title){const section=element('section',undefined,'settings-section');section.append(element('h3',title,'settings-section-title'));settings.append(section);return section;}
  function settingRow(parent,label,control){const r=element('div',undefined,'setting-row');r.append(element('div',label),control);parent.append(r);return r;}
  function renderSettings(){
   if(view.__settingsRouter)return;
   const tab=view.querySelector('.settings-tab.active')?.dataset.tab;if(['appearance','themes','visual','greeting'].includes(tab))return;
   settings.replaceChildren();
   if(tab==='campus'){
    const s=settingsSection('浙大统一身份认证');const status=element('span',undefined,'setting-status');status.dataset.configStatus='campus';settingRow(s,'当前账户',status);settingRow(s,'学号与密码在独立扩展页面配置',button('配置账户','open-account'));settingRow(s,'重新连接各信息源',button('重新登录','refresh',['courses','assignments','exams']));settingRow(s,'退出并清除本扩展的凭据与校内缓存',button('退出并清除','logout'));
    const sources=settingsSection('信息源');for(const [key,label]of [['courses','课表'],['exams','考试'],['assignments','学在浙大作业']]){const output=element('span',undefined,'setting-status');output.dataset.sourceStatus=key;settingRow(sources,label,output);}settingRow(sources,'手动刷新校内信息',button('刷新','refresh',['courses','assignments','exams']));
   }else if(tab==='weather'){
    const s=settingsSection('和风天气');const status=element('span');status.dataset.configStatus='weather';settingRow(s,'显示地点',status);settingRow(s,'API Host、Key 与地点',button('配置天气','open-account'));for(const [key,label]of [['now','实时天气'],['daily','每日预报'],['rain','短时降水']]){const output=element('span',undefined,'setting-status');output.dataset.sourceStatus=key;settingRow(s,label,output);}settingRow(s,'更新天气',button('刷新','refresh',['now','daily','rain']));
    const refs=element('span',undefined,'setting-status');refs.dataset.weatherReferences='';settingRow(s,'来源归属说明',refs);
   }else{
    const s=settingsSection('数据管理');settingRow(s,'导出、导入及恢复首页配置',button('管理配置','open-data'));settingRow(s,'清除天气、校内信息与名句缓存，保留凭据',button('清除缓存','clear-cache'));settingRow(s,'清除校内凭据与校内缓存',button('退出并清除','logout'));const reset=button('重置','');reset.dataset.action='reset';settingRow(s,'重置界面偏好',reset);
    const about=settingsSection('关于此首页');settingRow(about,'版本',element('span','正式版 · 0.4.0'));settingRow(about,'页面基础',link('ZJUers 轻首页','https://zjuers.com/'));settingRow(about,'天气',link('和风天气','https://www.qweather.com/'));settingRow(about,'哲学名句',link('一言','https://hitokoto.cn/'));settingRow(about,'校内接入参考',link('Celechron','https://github.com/Celechron/Celechron'));settingRow(about,'权限与来源说明',link('查看',chrome.runtime.getURL('sources.html')));const sourceLink=about.lastElementChild.querySelector('a');sourceLink.href=chrome.runtime.getURL('sources.html');
   }
   const out=element('output',undefined,'settings-message');out.setAttribute('aria-live','polite');settings.append(out);renderSettingsStatus();
  }
  function snapshot(){
   if(snapshotFlight?.day===day&&snapshotFlight.projection===projection())return snapshotFlight.promise;
   const request={day,projection:projection(),promise:null};request.promise=readSnapshot().finally(()=>{if(snapshotFlight===request)snapshotFlight=null;});snapshotFlight=request;return request.promise;
  }
  async function readSnapshot(){
   const requestedDay=day,mode=projection();
   try{const result=await call('snapshot',{date:requestedDay,projection:mode});if(day===requestedDay)accept(result);}
   catch(error){for(const key of ['now','daily','rain','courses','exams','assignments'])state.entries[key]={...state.entries[key],status:'error',error:error.message};render();throw error;}
  }
  async function refresh(keys,force=false){const requestedDay=day;busy++;clearTimeout(timer);timer=setTimeout(tick,800);try{const result=await call('refresh',{keys,force,automatic:!force,date:requestedDay,projection:projection()});if(day===requestedDay)accept(result);}catch(error){const output=settings.querySelector('.settings-message');if(output)output.textContent=error.message;}finally{busy--;}}
  view.addEventListener('home-widgets-changed',()=>{if(bootstrapped&&!disposed&&!document.hidden)void start();});
  function start(){if(startFlight)return startFlight;startFlight=startSources().finally(()=>{startFlight=null;});return startFlight;}
  async function startSources(){
   if(disposed||document.hidden)return;
   if(followToday)day=dateOf();
   if(!bootstrapped){bootstrapped=true;await snapshot();}
   const primary=refresh(['now','daily','rain','courses','assignments','exams']);
   if(state.config.cc98Configured)void primary.then(()=>{if(!disposed&&!document.hidden)return refresh(['cc98',...(view.__widgets?.enabledSources.includes('cc98Top')?['cc98Top']:[])]);});
   if(!quoteRequested){
    quoteRequested=true;
    void primary.then(async()=>{
     if(disposed||document.hidden){quoteRequested=false;return;}
     busy++;clearTimeout(timer);timer=setTimeout(tick,800);
     try{const result=await call('refresh',{keys:['quote'],date:day,projection:projection()});quoteFinal=result.entries.quote;state.entries.quote=quoteFinal;render();}
     catch{quoteFinal={status:'error',error:'一言暂不可用'};render();}
     finally{busy--;}
    });
   }
   await primary;
  }
  settings.addEventListener('click',async event=>{const b=event.target.closest('[data-external-action]');if(event.target.dataset.action==='reset'){queueMicrotask(renderSettings);return;}if(!b?.dataset.externalAction)return;b.disabled=true;const output=settings.querySelector('.settings-message');try{if(b.dataset.externalAction==='refresh'){if(output)output.textContent='正在刷新…';await refresh(b.dataset.keys.split(','),true);if(output)output.textContent='刷新完成，结果见各来源状态。';}else {const result=await call(b.dataset.externalAction);if(result?.entries){state=result;if(b.dataset.externalAction==='clear-cache')quoteFinal=null;render();}if(output)output.textContent=b.dataset.externalAction==='open-account'?'已打开扩展配置页。':'操作完成。';}}catch(error){if(output)output.textContent=error.message;}finally{b.disabled=false;}});
  view.querySelectorAll('.settings-tab').forEach(b=>b.addEventListener('click',renderSettings));
  view.addEventListener('home-secondary-open',()=>{render();void snapshot().then(start).catch(()=>{});});
  view.addEventListener('click',event=>{if(calendarPanel&&!event.target.closest('.calendar-panel,.calendar-toggle')){calendarPanel.hidden=true;calendarButton.setAttribute('aria-expanded','false');}});
  view.addEventListener('keydown',event=>{if(event.key==='Escape'&&calendarPanel&&!calendarPanel.hidden){calendarPanel.hidden=true;calendarButton.setAttribute('aria-expanded','false');calendarButton.focus();event.stopImmediatePropagation();}},true);
  let resumeTimer;
  function resume(){clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{if(!document.hidden&&!disposed){render();void snapshot().then(start).catch(()=>{});}},80);}
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);clearTimeout(resumeTimer);if(!document.hidden){resume();timer=setTimeout(tick,60000);}});
  window.addEventListener('focus',resume);
  let dataTimer;const dataChanged=m=>{if(m.type!=='HOME_DATA_CHANGED')return;clearTimeout(dataTimer);if(!document.hidden)dataTimer=setTimeout(()=>void snapshot().catch(()=>{}),100);};chrome.runtime.onMessage?.addListener(dataChanged);
  window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(timer);clearTimeout(resumeTimer);clearTimeout(dataTimer);chrome.runtime.onMessage?.removeListener(dataChanged);},{once:true});
  async function tick(){if(disposed)return;if(!document.hidden){try{if(busy)await snapshot();else if(app.classList.contains('is-secondary')||view.__widgets?.hasSources)await start();}catch{}}if(!document.hidden)timer=setTimeout(tick,busy?1500:60000);}
  if(globalThis.HomeDetails)HomeDetails.initialize(view,{getState:()=>state,call,statusText,weatherIcon});
  render();renderSettings();void snapshot().catch(()=>{});
  if(app.classList.contains('is-secondary'))void start();
  setTimeout(()=>{if('requestIdleCallback'in window)requestIdleCallback(()=>{void start();},{timeout:1000});else void start();},1500);
  timer=setTimeout(tick,1500);
 }
 root.HomeExternal={call,initialize,selectCourses,selectExams,calendarDays,quoteAttribution,compactRain,weatherIcon,watchVideo,dateOf,safeLink};if(typeof module!=='undefined')module.exports=root.HomeExternal;
})(globalThis);
