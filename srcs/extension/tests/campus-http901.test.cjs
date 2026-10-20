const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../providers/campus.js');
const UG='https://zdbk.zju.edu.cn/jwglxt/';
function response(body,status=200,url=UG){
  // Native fetch can receive 901, but the Response constructor rejects it.
  return {status,ok:status>=200&&status<300,type:'basic',url,statusText:'',headers:new Headers(),
    text:async()=>body,clone(){return response(body,status,url);}};
}
function transport(fetch){
  const source=fs.readFileSync(path.join(__dirname,'../external-background.js'),'utf8');
  const code=source.slice(source.indexOf(' async function request('),source.indexOf(' function serviceCallback('));
  const scopes=Object.fromEntries(['campus','weather','quote','webvpn'].map(k=>[k,{epoch:0,controllers:new Set()}]));
  const request=vm.runInNewContext(code+';request',{fetch,URL,Response,AbortController,setTimeout,clearTimeout,config:{},scopes,limit:f=>f(),E:{problem:(m,c)=>Object.assign(Error(m),{code:c})}});
  return {request,scopes};
}
test('transport preserves native HTTP 901 without constructing an invalid Response',async()=>{
  const h=transport(async()=>response('',901));const r=await h.request(UG);
  assert.equal(r.status,901);assert.equal(await r.text(),'');assert.equal(h.scopes.campus.controllers.size,0);
});
for(const persistent of [false,true])test('undergraduate HTTP 901 runs one service recovery; persistent='+persistent,async()=>{
  let queries=0,services=0;
  const h=transport(async url=>{
    if(url.startsWith(UG)){queries++;return queries===1||persistent?response('',901,url):response('{"items":[]}',200,url);}
    assert.equal(new URL(url).hostname,'zjuam.zju.edu.cn');
    if(new URL(url).searchParams.has('service'))services++;
    return response('already signed in',200,url);
  });
  const provider=P.create({request:h.request});
  const result=provider.exams({username:'fixture',password:'fixture'});
  if(persistent)await assert.rejects(result,{code:'AUTH_EXPIRED'});
  else assert.deepEqual((await result).items,[]);
  assert.equal(queries,2);assert.equal(services,2);
});
test('ordinary HTTP 500 and non-undergraduate 901 do not trigger CAS recovery',async()=>{
  for(const status of [500,901]){
    let calls=0;const provider=P.create({request:async url=>{calls++;return response('',status,url);}});
    await assert.rejects(provider.assignments({username:'fixture',password:'fixture'}),{code:'NETWORK'});
    assert.equal(calls,1);
  }
});
test('CAS login GET and POST target undergraduate service instead of the default portal',async()=>{
  let queries=0,posts=0;
  const target=UG+'xtgl/login_ssologin.html';
  const provider=P.create({request:async(url,o={})=>{
    if(url.startsWith(UG))return ++queries===1?response('',901,url):response('{"items":[]}',200,url);
    const u=new URL(url);
    if(u.pathname==='/cas/v2/getKaptchaStatus')return response('false',200,url);
    if(u.pathname==='/cas/v2/getPubKey')return response('{"modulus":"ca1","exponent":"11"}',200,url);
    assert.equal(u.pathname,'/cas/login');assert.equal(u.searchParams.get('service'),target);
    if(o.method==='POST'){posts++;return response('logged in',200,target);}
    return posts?response('logged in',200,target):response('<input name="execution" value="fixture">',200,url);
  }});
  assert.deepEqual((await provider.exams({username:'fixture',password:'fixture'})).items,[]);
  assert.equal(posts,1);assert.equal(queries,2);
});
for(const state of ['false','true','"false"','unavailable'])test('CAS captcha status controls password submission: '+state,async()=>{
  let queries=0,posts=0,checks=0;
  const provider=P.create({request:async(url,o={})=>{
    if(url.startsWith(UG)){queries++;return queries===1?response('',901,url):response('{"items":[]}',200,url);}
    if(url.endsWith('/getKaptchaStatus')){checks++;if(state==='unavailable')throw Error('offline');return response(state,200,url);}
    if(url.endsWith('/getPubKey'))return response('{"modulus":"ca1","exponent":"11"}',200,url);
    if(o.method==='POST'){posts++;return response('signed in',200,url);}
    if(posts)return response('service ready',200,url);
    return response('<input name="execution" value="fixture"><div id="kaptcha">验证码<input name="authcode"></div>',200,url);
  }});
  const pending=provider.exams({username:'fixture',password:'fixture'});
  if(state==='false')assert.deepEqual((await pending).items,[]);
  else await assert.rejects(pending,{code:state==='true'?'CAPTCHA_REQUIRED':'CAPTCHA_STATUS_UNAVAILABLE'});
  assert.equal(checks,1);assert.equal(posts,state==='false'?1:0);
});
