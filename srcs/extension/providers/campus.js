/* Campus adapters. Native browser cookies only; never stores credentials or response bodies.
 * request(url, options) must return Fetch Response and enforce global limits/timeouts.
 * Optional serviceCallback(service) returns a freshly captured CAS callback URL.
 */
(function (root) {
  'use strict';
  const CAS = 'https://zjuam.zju.edu.cn/cas/login';
  const UG = 'https://zdbk.zju.edu.cn/jwglxt/';
  const LMS = 'https://courses.zju.edu.cn/';
  const GRS = 'https://yjsy.zju.edu.cn/';
  const messages = { CANCELLED:'校内请求已取消', AUTH_REQUIRED:'请在扩展账号页填写学号和密码', AUTH_EXPIRED:'校内会话失效，请重新登录', BAD_CREDENTIALS:'认证未通过，请检查凭据或在学校认证页完成验证', CAPTCHA_REQUIRED:'教务网需要验证码，请在教务网完成验证后重试', CAPTCHA_STATUS_UNAVAILABLE:'无法确认统一身份认证的验证码状态，请稍后重试', SCHEMA_CHANGED:'校内接口格式发生变化，暂时无法解析', NETWORK:'校内服务暂时无法访问', GRADUATE_REDIRECT_UNAVAILABLE:'研究生认证跳转暂时无法在浏览器后台读取', CALENDAR_UNAVAILABLE:'校历未取得，课程日期和时间未确定' };
  function error(code) { const e=new Error(messages[code]||messages.NETWORK); e.code=code; e.publicMessage=e.message; return e; }
  function warning(code) { return {code,message:messages[code]||messages.NETWORK}; }
  function text(v) { return typeof v==='string'||typeof v==='number'?String(v):''; }
  function clean(v) { return text(v).replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').trim(); }
  function campus(place) { return (text(place).match(/紫金港|玉泉|西溪|华家池|之江|海宁|舟山/)||[])[0]||''; }
  function date(v) { const m=text(v).match(/^(\d{4})[-/.年]?(\d{2})[-/.月]?(\d{2})/); if(!m)return ''; const d=`${m[1]}-${m[2]}-${m[3]}`; const t=Date.parse(d+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===d?d:''; }
  function clock(v) { const m=text(v).match(/^(\d{1,2}):(\d{2})$/);return m&&+m[1]<24&&+m[2]<60?m[1].padStart(2,'0')+':'+m[2]:''; }
  function stamp(day,c) { return day&&clock(c)?`${day}T${clock(c)}:00+08:00`:undefined; }
  function chinaISO(value) { let s=text(value); if(!s)return undefined; if(!/(Z|[+-]\d\d:?\d\d)$/i.test(s))s+='+08:00'; const t=Date.parse(s);return Number.isFinite(t)?new Date(t+28800000).toISOString().replace(/\.\d{3}Z$/,'+08:00'):undefined; }
  function list(payload,key) { if(!payload||!Array.isArray(payload[key]))throw error('SCHEMA_CHANGED'); return payload[key]; }
  function calendarValid(c) { return c&&Array.isArray(c.startEnd)&&c.startEnd.length===4&&c.startEnd.every(date)&&Array.isArray(c.sessionTime); }
  function weeks(raw) { const result=new Set();text(raw).replace(/(\d+)\s*[-~至]\s*(\d+)/g,(_,a,b)=>{if(+b<=30&&+a>0)for(let n=+a;n<=+b;n++)result.add(n);return '';}).replace(/\d+/g,n=>{if(+n>0&&+n<=30)result.add(+n);return n;});return [...result].sort((a,b)=>a-b); }
  function expand(s,c) {
    const base={id:[s.id,s.day,s.first,s.last,s.place||'',s.season].join(':'),title:s.title,teacher:s.teacher||'',schedule:{day:s.day,first:s.first,last:s.last,season:s.season,halves:s.halves,parity:s.parity,weeks:s.weeks||[]},place:s.place||'',campus:campus(s.place),source:s.source,url:s.source==='研究生院'?GRS:UG};
    const period=`周${'零一二三四五六日'[s.day]}第${s.first}${s.last===s.first?'':'–'+s.last}节 · ${s.season}`;
    if(!calendarValid(c))return [{...base,period}];
    // Explicit graduate weeks use the source calendar's weekday buckets. They are
    // appended after holiday/exchange processing and retain their explicit dates.
    if(s.weeks?.length){
      const buckets=Array.from({length:2},()=>Array.from({length:2},()=>Array.from({length:8},()=>[])));
      for(let half=0;half<2;half++){
        const begin=Date.parse(date(c.startEnd[half*2])+'T00:00:00Z'),end=Date.parse(date(c.startEnd[half*2+1])+'T00:00:00Z');
        if(end<begin||end-begin>150*86400000)throw error('SCHEMA_CHANGED');
        const firstDay=new Date(begin).getUTCDay()||7;
        for(let t=begin;t<=end;t+=86400000){const day=new Date(t).getUTCDay()||7;const week=Math.floor(((t-begin)/86400000+firstDay-1)/7)+1;buckets[half][week%2===1?0:1][day].push(t);}
      }
      const anchor=buckets[1][1][7].at(-1);
      return s.weeks.map(week=>{
        const t=week>16?(anchor===undefined?undefined:anchor+((week-17)*7+s.day)*86400000):buckets[Math.floor((week-1)/8)][1-week%2][s.day][Math.floor(((week-1)%8)/2)];
        if(t===undefined)return {...base,id:base.id+':week:'+week,period:period+' · 第'+week+'周'};
        const actual=new Date(t).toISOString().slice(0,10),start=stamp(actual,c.sessionTime[s.first]?.[0]),finish=stamp(actual,c.sessionTime[s.last]?.[1]);
        const valid=start&&finish&&Date.parse(finish)>Date.parse(start);
        return {...base,id:base.id+':'+actual,date:actual,...(valid?{start,end:finish}:{period})};
      });
    }
    const out=[]; const exchanged={};for(const key of Object.keys(c.exchange||{})){if(key.length===16){exchanged[date(key.slice(0,8))]=date(key.slice(8));exchanged[date(key.slice(8))]=date(key.slice(0,8));}}
    for(let half=0;half<2;half++) {
      if(!s.halves[half])continue;
      const begin=Date.parse(date(c.startEnd[half*2])+'T00:00:00Z'),end=Date.parse(date(c.startEnd[half*2+1])+'T00:00:00Z');
      if(end<begin||end-begin>150*86400000)throw error('SCHEMA_CHANGED');
      const startWeekday=new Date(begin).getUTCDay()||7;
      for(let t=begin;t<=end;t+=86400000){
        const d=new Date(t),day=d.getUTCDay()||7; if(day!==s.day)continue;
        const localWeek=Math.floor(((t-begin)/86400000+startWeekday-1)/7)+1;
        if((s.parity===0&&localWeek%2===0)||(s.parity===1&&localWeek%2===1))continue;
        const original=d.toISOString().slice(0,10),compact=original.replace(/-/g,'');
        if(c.holiday?.[compact]||c.holiday?.[original])continue;
        const actual=exchanged[original]||original;
        const start=stamp(actual,c.sessionTime[s.first]?.[0]),finish=stamp(actual,c.sessionTime[s.last]?.[1]);
        const valid=start&&finish&&Date.parse(finish)>Date.parse(start);
        out.push({...base,id:base.id+':'+actual,date:actual,...(valid?{start,end:finish}:{period})});
      }
    }
    return out;
  }
  function parseUndergraduateCourses(payload,c) {
    if(payload===null)return {items:[],warnings:[]};
    const items=[];let malformed=0;
    for(const [index,r] of list(payload,'kbList').entries()){
      if(!r||text(r.sfyjskc)==='1'||text(r.sfqd)!=='1')continue;
      const parts=text(r.kcb).split(/<br\s*\/?\s*>/i);const first=+r.djj,last=first+(+r.skcd)-1,day=+r.xqj,season=text(r.xxq);
      if(parts.length<4||!first||last<first||last>15||day<1||day>7||!/[秋冬春夏]/.test(season)){malformed++;continue;}
      items.push(...expand({id:text(r.jxb_id||r.xkkh)||`ug:${clean(parts[0])}:${clean(parts[1])}`,title:clean(parts[0]),teacher:clean(r.jsxm),place:clean(parts[3].split('zwf')[0]),first,last,day,season,halves:[/[秋春]/.test(season),/[冬夏]/.test(season)],parity:text(r.dsz)==='0'?0:text(r.dsz)==='1'?1:2,source:'本科教务网'},c));
    }
    return {items,warnings:[...(!calendarValid(c)&&items.length?[warning('CALENDAR_UNAVAILABLE')]:[]),...(malformed?[warning('SCHEMA_CHANGED')]:[])]};
  }
  function examItem(r,raw,place,id,source) {
    const numeric=text(raw).match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
    const day=numeric?date(numeric[1]+numeric[2].padStart(2,'0')+numeric[3].padStart(2,'0')):'';
    const clocks=[...text(raw).matchAll(/\d{1,2}:\d{2}/g)].map(m=>clock(m[0]));
    const a=stamp(day,clocks[0]),b=stamp(day,clocks[1]);
    return {id,title:clean(r.kcmc),place:clean(place),campus:campus(place),source,url:source==='研究生院'?GRS:UG,...(day?{date:day}:{}),...(a&&b&&Date.parse(b)>Date.parse(a)?{start:a,end:b}:{period:clean(raw)||'时间未公布'})};
  }
  function parseExams(payload) {const items=[];for(const r of list(payload,'items')){if(!r||!r.xkkh)continue;for(const [k,p] of [['qzkssj','qzjsmc'],['kssj','jsmc']])if(text(r[k]))items.push(examItem(r,r[k],r[p],text(r.xkkh)+':'+k,'本科教务网'));}return {items,warnings:[]};}
  function parseAssignments(payload) {const items=[];let bad=0;for(const r of list(payload,'todo_list')){if(!r||!(r.is_student===true||r.is_student==='true'||r.is_student===1)||!text(r.id))continue;const deadline=chinaISO(r.end_time);if(r.end_time&&!deadline)bad++;items.push({id:text(r.id),title:clean(r.title)||'未命名作业',course:clean(r.course_name),...(deadline?{deadline}:{}),url:r.type==='homework'&&/^\d+$/.test(text(r.course_id))&&/^\d+$/.test(text(r.id))?LMS+'course/'+text(r.course_id)+'/learning-activity#/'+text(r.id):LMS+'user/index'});}items.sort((a,b)=>(Date.parse(a.deadline)||Infinity)-(Date.parse(b.deadline)||Infinity));return {items,warnings:bad?[warning('SCHEMA_CHANGED')]:[]};}
  function parseGraduateCourses(payload,c,seasonCode) {
    const map=payload?.result?.kcbMap;if(!map||typeof map!=='object'||Array.isArray(map))throw error('SCHEMA_CHANGED');const sessions=new Map();
    for(let day=1;day<=7;day++)for(let p=1;p<=15;p++)for(const r of map[day]?.[p]?.pyKcbjSjddVOList||[]){if(!r||text(r.xkzt)==='12'||!text(r.bjbh))continue;const key=day+':'+r.bjbh;let s=sessions.get(key);if(s){s.first=Math.min(s.first,p);s.last=Math.max(s.last,p);continue;}const code=+r.pkxq||seasonCode;s={id:'gr:'+r.bjbh+':'+day,title:clean(r.kcmc),teacher:clean(r.jsxm||r.jzgxm),place:clean(r.cdmc),first:p,last:p,day,halves:[code===11||code===13||code===15||code===16,code===12||code===14||code===15||code===16],season:({11:'春',12:'夏',13:'秋',14:'冬',15:'春夏',16:'秋冬'})[code]||'',weeks:weeks(r.zc),parity:2,source:'研究生院'};sessions.set(key,s);}
    const items=[...sessions.values()].flatMap(s=>expand(s,c));return {items,warnings:!calendarValid(c)&&items.length?[warning('CALENDAR_UNAVAILABLE')]:[]};
  }
  function parseGraduateExams(payload,year) {const rows=Array.isArray(payload?.result)?payload.result:payload?.result?.records;if(!Array.isArray(rows))throw error('SCHEMA_CHANGED');const items=[];for(const r of rows){if(!r||text(r.xn)!==text(year)||!text(r.kcbh))continue;const d=date(r.rq);if(!d)continue;let times=text(r.ksTime);if(!times&&r.kssj&&r.jssj){const cv=v=>{const s=text(v);return /^\d{3,4}$/.test(s)?s.padStart(4,'0').replace(/(..)(..)/,'$1:$2'):s;};times=cv(r.kssj)+'-'+cv(r.jssj);}items.push(examItem(r,d+' '+times,r.mc||r.ksdd,'gr:'+text(r.id||r.kcbh),'研究生院'));}return {items,warnings:[]};}
  function encryptPassword(password,key) {
    try{const n=BigInt('0x'+key.modulus),e=BigInt('0x'+key.exponent);const hex=[...new TextEncoder().encode(password)].map(b=>b.toString(16).padStart(2,'0')).join('');let b=BigInt('0x'+hex)%n,p=e,r=1n;if(n<2n||e<1n||e>0xffffffffn)throw 0;while(p){if(p&1n)r=r*b%n;b=b*b%n;p>>=1n;}return r.toString(16).padStart(128,'0');}catch{throw error('BAD_CREDENTIALS');}
  }
  function authBody(body) {return /name\s*=\s*["']execution["']|统一身份认证|登录超时|未登录|请先登录|登录已失效|认证失败|unauthorized|authserver|kickout\s*=\s*1|session\s*(?:has\s*)?expired/i.test(body)||(/name\s*=\s*["']username["']/i.test(body)&&/name\s*=\s*["']password["']/i.test(body));}
  function authJson(d,graduate=false) {
    if(!d||typeof d!=='object')return false;
    if(Number(d.kickout)===1||Number(d.result?.kickout)===1||Number(d.data?.kickout)===1)return true;
    const code=Number(d.code??d.status),failed=d.success===false||d.success==='false';
    const message=[d.message,d.msg,d.error].map(text).join(' ');
    return [401,403,901].includes(code)||(failed&&/token|登录|认证|过期|unauthorized|kickout/i.test(message))||(graduate&&failed&&code===500);
  }
  function create({request,now=()=>Date.now(),serviceCallback}={}) {
    if(typeof request!=='function')throw new TypeError('request is required');
    let account='',loginPromise=null,loginFailure=null,graduatePromise=null,graduateFailure=null,graduateRetryAt=0,token=null,graduateVisible=false,loginUntil=0;const servicePromises=new Map();
    let generation=0;
    function check(g){if(g!==generation)throw error('CANCELLED');}
    function reset(){generation++;account='';loginPromise=null;loginFailure=null;graduatePromise=null;graduateFailure=null;graduateRetryAt=0;token=null;graduateVisible=false;loginUntil=0;servicePromises.clear();}
    function credentials(c){if(!c?.username||!c?.password)throw error('AUTH_REQUIRED');if(account!==c.username){reset();account=c.username;}if(loginFailure)throw loginFailure;}
    async function fetchText(url,options={}) {const g=generation;check(g);let r;try{r=await request(url,{credentials:'include',redirect:'follow',...options});}catch{check(g);throw error('NETWORK');}check(g);if(r.type==='opaqueredirect')throw error('GRADUATE_REDIRECT_UNAVAILABLE');if(r.status===401||r.status===403||(r.status===901&&url.startsWith(UG)))throw error('AUTH_EXPIRED');if(!r.ok)throw error('NETWORK');let body;try{body=await r.text();}catch{check(g);throw error('NETWORK');}check(g);return {r,body};}
    async function json(url,options={}) {const g=generation;const {body}=await fetchText(url,options);check(g);if(body.includes('captcha_error'))throw error('CAPTCHA_REQUIRED');if(authBody(body))throw error('AUTH_EXPIRED');let d;try{d=JSON.parse(body);}catch{throw error('SCHEMA_CHANGED');}if(authJson(d,url.startsWith(GRS)))throw error('AUTH_EXPIRED');return d;}
    async function login(c){credentials(c);if(loginPromise)return loginPromise;if(+now()<loginUntil)return;const g=generation;const active=loginPromise=(async()=>{const loginURL=CAS+'?service='+encodeURIComponent(UG+'xtgl/login_ssologin.html');const {body}=await fetchText(loginURL);const tag=(body.match(/<input\b[^>]*name\s*=\s*["']execution["'][^>]*>/i)||[])[0];const execution=(tag?.match(/value\s*=\s*["']([^"']*)["']/i)||[])[1];if(!execution){if(authBody(body))throw error('BAD_CREDENTIALS');return;}let captcha;try{captcha=await json('https://zjuam.zju.edu.cn/cas/v2/getKaptchaStatus',{cache:'no-store'});}catch(e){check(g);throw error('CAPTCHA_STATUS_UNAVAILABLE');}check(g);if(typeof captcha!=='boolean')throw error('CAPTCHA_STATUS_UNAVAILABLE');if(captcha)throw error('CAPTCHA_REQUIRED');const key=await json('https://zjuam.zju.edu.cn/cas/v2/getPubKey');const bodyPost=new URLSearchParams({username:c.username,password:encryptPassword(c.password,key),execution,_eventId:'submit',rememberMe:'true'}).toString();const result=await fetchText(loginURL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:bodyPost});if(authBody(result.body))throw error('BAD_CREDENTIALS');})();try{await active;check(g);loginUntil=+now()+120000;}catch(e){check(g);if(['BAD_CREDENTIALS','CAPTCHA_REQUIRED'].includes(e.code))loginFailure=e;throw e;}finally{if(loginPromise===active)loginPromise=null;}}
    async function service(name,c){if(servicePromises.has(name))return servicePromises.get(name);const g=generation;const promise=(async()=>{await login(c);check(g);let url=name==='ug'?CAS+'?service='+encodeURIComponent(UG+'xtgl/login_ssologin.html'):LMS+'user/index';for(let hops=0;hops<8;hops++){const {r,body}=await fetchText(url);if(authBody(body))throw error('AUTH_EXPIRED');const tag=[...body.matchAll(/<meta\b[^>]*>/gi)].find(m=>/http-equiv\s*=\s*["']?refresh/i.test(m[0]));const target=tag&&/url\s*=\s*["']?([^"' >;]+)/i.exec(tag[0]);if(!target)return;const next=new URL(target[1].replace(/&amp;/g,'&'),r.url||url);if(next.protocol!=='https:'||!['courses.zju.edu.cn','identity.zju.edu.cn','zjuam.zju.edu.cn'].includes(next.hostname))throw error('SCHEMA_CHANGED');url=next.href;}throw error('AUTH_EXPIRED');})();servicePromises.set(name,promise);try{return await promise;}finally{if(servicePromises.get(name)===promise)servicePromises.delete(name);}}
    async function business(name,c,url,options){credentials(c);const g=generation;try{return await json(url,options);}catch(e){if(e.code!=='AUTH_EXPIRED')throw e;}check(g);await service(name,c);check(g);return json(url,options);}
    async function graduateLogin(c){if(token)return;if(graduatePromise)return graduatePromise;const g=generation;const active=graduatePromise=(async()=>{await login(c);check(g);let callback;if(serviceCallback){try{callback=await serviceCallback(GRS);}catch(e){check(g);throw error(e?.code==='GRADUATE_REDIRECT_UNAVAILABLE'?'GRADUATE_REDIRECT_UNAVAILABLE':'NETWORK');}check(g);}else{const {r}=await fetchText(CAS+'?service='+encodeURIComponent(GRS));callback=r.url;}let u;try{u=new URL(callback);}catch{throw error('GRADUATE_REDIRECT_UNAVAILABLE');}if(u.origin!==new URL(GRS).origin||u.pathname!=='/'||!u.searchParams.get('ticket'))throw error('GRADUATE_REDIRECT_UNAVAILABLE');const info=await json(GRS+'dataapi/sys/cas/client/validateLogin?'+new URLSearchParams({ticket:u.searchParams.get('ticket'),service:GRS}));if(info?.success!==true||!text(info.result?.token))throw error('AUTH_EXPIRED');check(g);token=text(info.result.token);})();try{await active;check(g);}finally{if(graduatePromise===active)graduatePromise=null;}}
    async function graduateBusiness(c,url){const g=generation;await graduateLogin(c);check(g);try{return await json(url,{headers:{'X-Access-Token':token}});}catch(e){if(e.code!=='AUTH_EXPIRED')throw e;}check(g);token=null;await graduateLogin(c);check(g);return json(url,{headers:{'X-Access-Token':token}});}
    async function graduate(c,term,cal,force=false){const g=generation;if(force||(+now()>=graduateRetryAt&&graduateRetryAt)){graduateFailure=null;graduateRetryAt=0;token=null;}if(graduateFailure)return {items:[],warnings:[graduateFailure],graduateVisible:false};try{await graduateLogin(c);check(g);const codes=term.term===1?[13,14]:[11,12];const results=[];for(const code of codes){const d=await graduateBusiness(c,GRS+`dataapi/py/pyKcbj/queryXskbByLoginUser?xn=${term.year}&pkxq=${code}`);if(d?.success!==true)throw error('NETWORK');results.push(parseGraduateCourses(d,cal,code));}const items=results.flatMap(r=>r.items);return {items,warnings:results.flatMap(r=>r.warnings),graduateVisible:items.length>0};}catch(e){check(g);if(e.code==='CANCELLED')throw e;graduateFailure=warning(e.code||'NETWORK');graduateRetryAt=['NETWORK','AUTH_EXPIRED'].includes(e.code)?+now()+300000:0;return {items:[],warnings:[graduateFailure],graduateVisible:false};}}
    function term(target){const valid=date(target);const d=valid?new Date(valid+'T00:00:00Z'):new Date(+now()+28800000),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,year=m>=9?y:y-1;return {year,term:m>=2&&m<=8?2:1};}
    async function courses(c,{force=false,date:targetDate,onPartial}={}){credentials(c);const g=generation;const t=term(targetDate);let cal=null;const warnings=[];try{cal=await json(`http://calendar.celechron.top/${t.year}-${t.year+1}-${t.term}.json`);check(g);if(!calendarValid(cal))throw error('SCHEMA_CHANGED');}catch(e){if(e.code==='CANCELLED')throw e;warnings.push(warning('CALENDAR_UNAVAILABLE'));}const results=[];for(const season of t.term===1?['秋','冬']:['春','夏']){const body=new URLSearchParams({xnm:`${t.year}-${t.year+1}`,xqm:`${t.term}|${season}`,captcha_value:''}).toString();const d=await business('ug',c,UG+'kbcx/xskbcx_cxXsKb.html',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body});results.push(parseUndergraduateCourses(d,cal));}if(typeof onPartial==='function'){check(g);await onPartial({items:[...new Map(results.flatMap(r=>r.items).map(i=>[i.id,i])).values()],academicTerm:`${t.year}-${t.term}`,calendar:calendarValid(cal)?{startEnd:cal.startEnd.map(date),sessionTime:cal.sessionTime}:null,range:calendarValid(cal)?{start:date(cal.startEnd[0]),end:date(cal.startEnd[3])}:null,warnings:[...warnings,...results.flatMap(r=>r.warnings)],graduateVisible:false});check(g);}const graduateResult=await graduate(c,t,cal,force);check(g);graduateVisible=graduateResult.graduateVisible;const items=[...new Map(results.flatMap(r=>r.items).concat(graduateResult.items).map(i=>[i.id,i])).values()];return {items,academicTerm:`${t.year}-${t.term}`,calendar:calendarValid(cal)?{startEnd:cal.startEnd.map(date),sessionTime:cal.sessionTime}:null,range:calendarValid(cal)?{start:date(cal.startEnd[0]),end:date(cal.startEnd[3])}:null,warnings:[...warnings,...results.flatMap(r=>r.warnings),...graduateResult.warnings],graduateVisible:graduateResult.graduateVisible};}
    async function exams(c,{force=false}={}){credentials(c);const d=await business('ug',c,UG+'xskscx/kscx_cxXsgrksIndex.html?doType=query&queryModel.showCount=5000',{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'}});const result=parseExams(d);if(graduateVisible){const t=term();try{await graduateLogin(c);const query=new URLSearchParams({dm:'py_grks',mode:'2',role:'1',column:'createTime',order:'desc',queryMode:'1',field:'id,,kcbh,kcmc,rq,ksTime,xn,xq_dictText,ksdd,zwh',pageNo:'1',pageSize:'100',xn:text(t.year),xq:text(t.term===1?12:11)});const data=await graduateBusiness(c,GRS+'dataapi/py/pyKsxsxx/queryPageByXs?'+query);if(data?.success!==true)throw error('NETWORK');result.items.push(...parseGraduateExams(data,t.year).items);}catch(e){if(e.code==='CANCELLED')throw e;result.warnings.push(warning(e.code||'NETWORK'));}}return {...result,graduateVisible};}
    async function assignments(c){credentials(c);return parseAssignments(await business('lms',c,LMS+'api/todos'));}
    return {courses,exams,assignments,reset};
  }
  const api={create,parseUndergraduateCourses,parseGraduateCourses,parseGraduateExams,parseExams,parseAssignments,encryptPassword};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.CampusProvider=api;
})(typeof globalThis!=='undefined'?globalThis:this);
