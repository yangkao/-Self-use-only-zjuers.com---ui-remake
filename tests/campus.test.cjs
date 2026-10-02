const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../srcs/extension/providers/campus.js');
const P = fs.existsSync(file) ? require(file) : {};
const calendar = {startEnd:['20260921','20261115','20261116','20270110'],sessionTime:[['00:00','00:00'],['08:00','08:45'],['08:50','09:35']],holiday:{'20260928':'假日'},exchange:{'2026100520261010':'调休'}};
const row = {kcb:'数学<br>班<br>教师<br>紫金港东1-101zwf',xxq:'秋',djj:'1',skcd:'2',xqj:'1',dsz:'2',sfqd:'1'};
test('maps verified calendar periods, holidays and exchange dates',()=>{
  assert.equal(typeof P.parseUndergraduateCourses,'function');
  const r=P.parseUndergraduateCourses({kbList:[row]},calendar);
  assert.equal(r.items[0].start,'2026-09-21T08:00:00+08:00');
  assert.equal(r.items[0].end,'2026-09-21T09:35:00+08:00');
  assert.equal(r.items[0].campus,'紫金港');
  assert.ok(!r.items.some(i=>i.date==='2026-09-28'));
  assert.ok(r.items.some(i=>i.date==='2026-10-10'));
});
test('missing calendar preserves period without inventing dates',()=>{
  assert.equal(typeof P.parseUndergraduateCourses,'function');
  const r=P.parseUndergraduateCourses({kbList:[row]},null);
  assert.equal(r.items[0].period,'周一第1–2节 · 秋');
  assert.equal(r.items[0].start,undefined);
  assert.ok(r.warnings.length);
});
test('exams keep unpublished date labels without placeholder dates',()=>{
  assert.equal(typeof P.parseExams,'function');
  const r=P.parseExams({items:[{xkkh:'course',kcmc:'数学',kssj:'2026年10月12日(09:00-11:00)',jsmc:'玉泉教室',qzkssj:'秋学期第3天(09:00-11:00)'}]});
  assert.equal(r.items[1].start,'2026-10-12T09:00:00+08:00');
  assert.equal(r.items[0].start,undefined);
  assert.match(r.items[0].period,/秋学期/);
});
test('student todos only, deadlines normalized and absent last',()=>{
  assert.equal(typeof P.parseAssignments,'function');
  const r=P.parseAssignments({todo_list:[{id:1,title:'无期限',is_student:true},{id:2,title:'作业',course_name:'数学',is_student:true,end_time:'2026-10-02T01:00:00Z'},{id:3,is_student:false}]});
  assert.equal(r.items.length,2);
  assert.equal(r.items[0].deadline,'2026-10-02T09:00:00+08:00');
  assert.equal(r.items[1].deadline,undefined);
  assert.throws(()=>P.parseAssignments({}),{code:'SCHEMA_CHANGED'});
});
test('CAS textbook RSA implements nonpadded modular exponentiation',()=>{
  assert.equal(typeof P.encryptPassword,'function');
  assert.equal(P.encryptPassword('A',{modulus:'ca1',exponent:'11'}).slice(-4),'0ae6');
});
function response(body,status=200,url='') { const r=new Response(typeof body==='string'?body:JSON.stringify(body),{status}); Object.defineProperty(r,'url',{value:url}); return r; }
test('existing cookies reused, independent graduate failure remembered until force',async()=>{
  assert.equal(typeof P.create,'function'); let grad=0;
  const request=async(url,options)=>{assert.equal(options.credentials,'include'); if(url.includes('calendar.'))return response(calendar); if(url.includes('xskbcx'))return response({kbList:[row]}); if(url.includes('yjsy')||url.includes('service=https%3A%2F%2Fyjsy')){grad++; return response('graduate unavailable',503);} if(url==='https://zjuam.zju.edu.cn/cas/login')return response('signed in'); throw new Error('unexpected request');};
  const p=P.create({request,now:()=>Date.parse('2026-10-02T00:00:00Z')});
  const a=await p.courses({username:'fixture',password:'fixture'});
  assert.ok(a.items.length); assert.equal(a.graduateVisible,false);
  await p.courses({username:'fixture',password:'fixture'}); assert.equal(grad,1);
  await p.courses({username:'fixture',password:'fixture'},{force:true}); assert.equal(grad,2);
});
test('bad credentials block further automatic posts and never leak response secrets',async()=>{
  assert.equal(typeof P.create,'function'); let posts=0;
  const request=async(url,o)=>{if(url.includes('xskbcx'))return response('<input name="execution" value="login">'); if(url.includes('getPubKey'))return response({modulus:'ca1',exponent:'11'}); if(o.method==='POST'){posts++;return response('<input name="execution" value="failed"> password fixture');}return response('<input name="execution" value="login">');};
  const p=P.create({request});
  await assert.rejects(p.courses({username:'fixture',password:'fixture'}),{code:'BAD_CREDENTIALS'});
  await assert.rejects(p.exams({username:'fixture',password:'fixture'}),e=>e.code==='BAD_CREDENTIALS'&&!e.message.includes('fixture'));
  assert.equal(posts,1);
});
test('graduate real token exchange, valid courses and exams without fabricated clocks',async()=>{
  assert.equal(typeof P.parseGraduateExams,'function');
  const parsed=P.parseGraduateExams({success:true,result:{records:[{id:'exam',xn:'2026',kcbh:'1234567',kcmc:'研究课程',rq:'20261012',ksTime:'',ksdd:'玉泉'}]}},2026);
  assert.equal(parsed.items[0].date,'2026-10-12'); assert.equal(parsed.items[0].start,undefined);
  let exchanges=0;
  const g={success:true,result:{kcbMap:{1:{1:{pyKcbjSjddVOList:[{bjbh:'1234567',kcmc:'研究课程',pkxq:13,zc:'1-2',cdmc:'玉泉'}]}}}}};
  const p=P.create({now:()=>Date.parse('2026-10-02T00:00:00Z'),serviceCallback:async()=> 'https://yjsy.zju.edu.cn/?ticket=fixture-ticket',request:async(url)=>{
    if(url.includes('calendar.'))return response(calendar);
    if(url.includes('xskbcx'))return response({kbList:[]});
    if(url.includes('validateLogin')){exchanges++;return response({success:true,result:{token:'fixture-token'}});}
    if(url.includes('queryXskb'))return response(g);
    if(url.includes('queryPageByXs')){assert.equal(new URL(url).searchParams.get('xq'),'12');return response({success:true,result:{records:[{xn:'2026',id:'exam',kcbh:'1234567',kcmc:'研究课程',rq:'20261012',ksTime:'09:00-11:00'}]}});}
    if(url.includes('kscx'))return response({items:[]});
    return response('signed in');
  }});
  const a=await p.courses({username:'fixture',password:'fixture'});assert.equal(a.graduateVisible,true);
  const b=await p.exams({username:'fixture',password:'fixture'});assert.equal(b.items[0].start,'2026-10-12T09:00:00+08:00');assert.equal(exchanges,1);
});
test('graduate transient failures retry after cooldown and public errors sanitized',async()=>{
  let time=Date.parse('2026-10-02T00:00:00Z'),attempts=0;
  const p=P.create({now:()=>time,request:async url=>{if(url.includes('calendar.'))return response(calendar);if(url.includes('xskbcx'))return response({kbList:[]});if(url.includes('service=')){attempts++;return response('temporary failure',503);}return response('signed in');}});
  await p.courses({username:'fixture',password:'fixture'});time+=360000;
  await p.courses({username:'fixture',password:'fixture'});assert.equal(attempts,2);
  await assert.rejects(p.assignments({}),e=>e.publicMessage==='请在扩展账号页填写学号和密码');
});
test('same undergraduate class retains distinct meetings and fallback class identities',()=>{
  const rows=[{...row,jxb_id:'shared'},{...row,jxb_id:'shared',djj:2,skcd:1},{...row,kcb:'另一课程<br>班<br>教师<br>玉泉zwf'}];
  const a=P.parseUndergraduateCourses({kbList:rows},calendar).items.filter(i=>i.date==='2026-09-21');
  assert.equal(new Set(a.map(i=>i.id)).size,3);
  const autumn=P.parseUndergraduateCourses({kbList:[row]},null).items[0];
  const other=P.parseUndergraduateCourses({kbList:[rows[2]]},null).items[0];
  assert.notEqual(autumn.id,other.id);
});
test('graduate winter absolute weeks 9 through 16 map to winter dates',()=>{
  const g={result:{kcbMap:{1:{1:{pyKcbjSjddVOList:[{bjbh:'winter',kcmc:'冬课',pkxq:14,zc:'9-16'}]}}}}};
  const a=P.parseGraduateCourses(g,calendar,14);
  assert.equal(a.items[0].date,'2026-11-16');assert.equal(a.items.at(-1).date,'2027-01-04');
});
for(const payload of [{kickout:'1'},{code:'901'},{status:'401'},{data:{kickout:1}},'<form action="https://identity.zju.edu.cn/auth"><input name="username"><input name="password"></form>']){
  test('recognizes authentication expiry '+JSON.stringify(payload),async()=>{
    let reads=0,cas=0;const p=P.create({request:async url=>{
      if(url.endsWith('/api/todos'))return response(++reads===1?payload:{todo_list:[]});
      if(url==='https://zjuam.zju.edu.cn/cas/login')cas++;
      return response('signed in');
    }});
    assert.deepEqual((await p.assignments({username:'fixture',password:'fixture'})).items,[]);assert.equal(cas,1);
  });
}
test('graduate token expiry renews once while callback network failure retries after cooldown',async()=>{
  let time=Date.parse('2026-10-02T00:00:00Z'),callbacks=0,reads=0;
  const g={success:true,result:{kcbMap:{1:{1:{pyKcbjSjddVOList:[{bjbh:'1234567',kcmc:'研究课程',pkxq:13,zc:'1-2'}]}}}}};
  const p=P.create({now:()=>time,serviceCallback:async()=>{callbacks++;if(callbacks===1)throw new Error('temporary timeout');return 'https://yjsy.zju.edu.cn/?ticket=fixture';},request:async url=>{
    if(url.includes('calendar.'))return response(calendar);if(url.includes('xskbcx'))return response({kbList:[]});
    if(url.includes('validateLogin'))return response({success:true,result:{token:'token-'+callbacks}});
    if(url.includes('queryXskb'))return response(++reads===1?{success:false,code:500}:g);
    return response('signed in');
  }});
  await p.courses({username:'fixture',password:'fixture'});time+=360000;
  const a=await p.courses({username:'fixture',password:'fixture'});assert.equal(a.graduateVisible,true);assert.equal(callbacks,3);
});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
test('undergraduate partial result publishes before optional graduate request finishes',async()=>{
  const gate=deferred(),started=deferred();let partial,finished=false;
  const p=P.create({now:()=>Date.parse('2026-10-02T00:00:00Z'),serviceCallback:async()=> 'https://yjsy.zju.edu.cn/?ticket=fixture',request:async url=>{
    if(url.includes('calendar.'))return response(calendar);
    if(url.includes('xskbcx'))return response({kbList:[row]});
    if(url.includes('validateLogin'))return response({success:true,result:{token:'fixture'}});
    if(url.includes('queryXskb')){started.resolve();return gate.promise;}
    return response('signed in');
  }});
  const work=p.courses({username:'fixture',password:'fixture'},{onPartial:async value=>{partial=value;}}).then(value=>{finished=true;return value;});
  await started.promise;assert.equal(finished,false);assert.ok(partial.items.length>0);
  assert.equal(partial.items[0].start,'2026-09-21T08:00:00+08:00');
  assert.equal(partial.academicTerm,'2026-1');assert.equal(partial.graduateVisible,false);
  assert.equal(new Set(partial.items.map(i=>i.id)).size,partial.items.length);
  gate.resolve(response({success:true,result:{kcbMap:{}}}));
  assert.deepEqual((await work).items,partial.items);
});
test('partial callback errors propagate and reset during callback cancels graduate work',async()=>{
  let graduateRequests=0;
  const p=P.create({request:async url=>{
    if(url.includes('calendar.'))return response(calendar);
    if(url.includes('xskbcx'))return response({kbList:[row]});
    graduateRequests++;return response('signed in');
  }});
  const failure=new Error('fixture callback failure');
  await assert.rejects(p.courses({username:'fixture',password:'fixture'},{onPartial:async()=>{throw failure;}}),e=>e===failure);
  await assert.rejects(p.courses({username:'fixture',password:'fixture'},{onPartial:async()=>{p.reset();}}),{code:'CANCELLED'});
  assert.equal(graduateRequests,0);
});
test('graduate explicit weeks preserve dates and extend weeks 17 and 18 from last even Sunday',()=>{
  const payload={result:{kcbMap:{1:{1:{pyKcbjSjddVOList:[{bjbh:'extension',kcmc:'延长课程',pkxq:13,zc:'9,17-18'}]}}}}};
  const c={...calendar,holiday:{'20261116':'假日','20270111':'假日'},exchange:{'2026111620261118':'调休','2027011120270113':'调休'}};
  const result=P.parseGraduateCourses(payload,c,13);
  assert.deepEqual(result.items.map(i=>i.date),['2026-11-16','2027-01-11','2027-01-18']);
  assert.equal(result.items[1].start,'2027-01-11T08:00:00+08:00');
  assert.equal(result.items[2].end,'2027-01-18T08:45:00+08:00');
  const missing=P.parseGraduateCourses(payload,null,13);
  assert.equal(missing.items.length,1);assert.equal(missing.items[0].date,undefined);
});
test('requested course date selects academic term and reports verified calendar range',async()=>{
  const queries=[];const spring={...calendar,startEnd:['20270201','20270328','20270329','20270523']};
  const p=P.create({now:()=>Date.parse('2026-10-02T00:00:00Z'),serviceCallback:async()=>{throw Object.assign(new Error('no redirect'),{code:'GRADUATE_REDIRECT_UNAVAILABLE'});},request:async(url,options)=>{
    queries.push({url,body:options.body});
    if(url.includes('calendar.'))return response(spring);
    if(url.includes('xskbcx'))return response({kbList:[]});
    return response('signed in');
  }});
  const a=await p.courses({username:'fixture',password:'fixture'},{date:'2027-02-01'});
  assert.equal(a.academicTerm,'2026-2');assert.deepEqual(a.range,{start:'2027-02-01',end:'2027-05-23'});
  assert.ok(queries.some(q=>q.url.endsWith('/2026-2027-2.json')));
  assert.deepEqual(queries.filter(q=>q.url.includes('xskbcx')).map(q=>new URLSearchParams(q.body).get('xqm')),['2|春','2|夏']);
});
test('repeated graduate expiry renews once and then enters cooldown',async()=>{
  let callbacks=0,reads=0;
  const p=P.create({now:()=>Date.parse('2026-10-02T00:00:00Z'),serviceCallback:async()=>{callbacks++;return 'https://yjsy.zju.edu.cn/?ticket=fixture';},request:async url=>{
    if(url.includes('calendar.'))return response(calendar);
    if(url.includes('xskbcx'))return response({kbList:[]});
    if(url.includes('validateLogin'))return response({success:true,result:{token:'fixture'}});
    if(url.includes('queryXskb')){reads++;return response({success:false,code:500});}
    return response('signed in');
  }});
  const a=await p.courses({username:'fixture',password:'fixture'});
  assert.equal(a.warnings.at(-1).code,'AUTH_EXPIRED');assert.equal(callbacks,2);assert.equal(reads,2);
  await p.courses({username:'fixture',password:'fixture'});assert.equal(callbacks,2);assert.equal(reads,2);
});
test('reset during CAS login stops public key and password requests',async()=>{
  const gate=deferred(),started=deferred();let credentialRequests=0;
  const p=P.create({request:async url=>{
    if(url.endsWith('/api/todos'))return response({code:401});
    if(url==='https://zjuam.zju.edu.cn/cas/login'){started.resolve();return gate.promise;}
    credentialRequests++;return response({modulus:'ca1',exponent:'11'});
  }});
  const work=p.assignments({username:'fixture',password:'fixture'});await started.promise;p.reset();
  gate.resolve(response('<input name="execution" value="login">'));
  await assert.rejects(work,{code:'CANCELLED'});assert.equal(credentialRequests,0);
});
test('reset during graduate token exchange cannot revive token or start course requests',async()=>{
  const gate=deferred(),started=deferred();let graduateReads=0;
  const p=P.create({serviceCallback:async()=> 'https://yjsy.zju.edu.cn/?ticket=fixture',request:async url=>{
    if(url.includes('calendar.'))return response(calendar);if(url.includes('xskbcx'))return response({kbList:[]});
    if(url.includes('validateLogin')){started.resolve();return gate.promise;}
    if(url.includes('queryXskb'))graduateReads++;
    return response('signed in');
  }});
  const work=p.courses({username:'fixture',password:'fixture'});await started.promise;p.reset();gate.resolve(response({success:true,result:{token:'stale'}}));
  await assert.rejects(work,{code:'CANCELLED'});assert.equal(graduateReads,0);
});
