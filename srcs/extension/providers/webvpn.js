/* Verified WebVPN local-login protocol. Credentials remain in the background. */
(function(root){
 'use strict';
 const origin='https://webvpn.zju.edu.cn',oidc=origin+'/https/77726476706e69737468656265737421ffe744922e3426537d51d1e2974724/';
 function create({request,credentials,now=Date.now}){
  let pending=null,checkedAt=0,state={status:'idle'},generation=0;
  const fail=(message,code='webvpn')=>ExternalCore.problem(message,code);
  async function get(url,options={}){const r=await request(url,{credentials:'include',redirect:'follow',...options});if(r.type==='opaqueredirect')throw fail('WebVPN 登录已失效，请重新连接');if(!r.ok)throw fail('WebVPN 暂时无法访问');if(r.url&&new URL(r.url).origin!==origin)throw fail('WebVPN 返回了未授权地址');return {r,text:await r.text()};}
  async function accessible(){const {text}=await get(oidc+'.well-known/openid-configuration');try{return JSON.parse(text).issuer==='https://openid.cc98.org';}catch{return false;}}
  async function login(){
   if(await accessible())return {status:'ready',updatedAt:now()};
   const c=credentials();if(!c?.username||!c?.password)throw fail('请配置独立的 WebVPN 用户名和密码','configuration');
   const {text}=await get(origin+'/login'),form=text.match(/<form\b[^>]*id=["']form["'][^>]*>([\s\S]*?)<\/form>/i)?.[1];
   if(!form)throw fail('WebVPN 登录页面发生变化，请在原站完成登录','interaction');
   const attr=(tag,name)=>tag.match(new RegExp('\\b'+name+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]?.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")||'';
   const body=new URLSearchParams();for(const tag of form.match(/<input\b[^>]*>/gi)||[]){const name=attr(tag,'name');if(name)body.set(name,attr(tag,'value'));}
   if(body.get('needCaptcha')==='true')throw fail('WebVPN 需要验证码，请在 WebVPN 网站完成验证','interaction');
   if(!body.get('_csrf')||body.get('auth_type')!=='local'||!/encrypt\(data\[i\]\.value,\s*"wrdvpnisawesome!",\s*"wrdvpnisawesome!"\)/.test(text)||!/ModeOfOperation\.cfb/.test(text))throw fail('WebVPN 登录协议不匹配，请在原站登录','interaction');
   let encrypted;try{encrypted=await VpnAuthCrypto.encryptPassword(c.password);}catch{throw fail('当前 WebVPN 密码字符编码尚未验证，请在原站登录','interaction');}
   body.set('username',c.username);body.set('password',encrypted);
   const options={method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:body.toString()};
   let d;try{d=JSON.parse((await get(origin+'/do-login',options)).text);}catch(e){if(e.publicMessage)throw e;throw fail('WebVPN 登录响应不匹配');}
   // The user approved replacing the existing session once when NEED_CONFIRM occurs.
   if(d.success!==true&&d.error==='NEED_CONFIRM'){try{d=JSON.parse((await get(origin+'/do-confirm-login',{method:'POST',redirect:'error',headers:{'X-Requested-With':'XMLHttpRequest'}})).text);}catch{throw fail('WebVPN 顶替登录未完成，请在原站确认','interaction');}}
   if(d.success!==true)throw fail(['NEED_TWO_STEP','CAPTCHA_FAILED','NEED_CAPTCHA','NEED_CONFIRM'].includes(d.error)?'WebVPN 需要人工验证，请在原站处理后重试':'WebVPN 登录未通过，请检查独立账号', 'interaction');
   if(d.url){const next=new URL(d.url,origin);if(next.origin!==origin)throw fail('WebVPN 登录跳转地址不匹配');await get(next.href);}
   if(!await accessible())throw fail('WebVPN 登录尚未建立，请重试');
   return {status:'ready',updatedAt:now()};
  }
  function ensure(force=false){if(pending)return pending;if(!force&&checkedAt&&now()-checkedAt<60000)return Promise.resolve(state);const g=generation;state={status:'loading'};const task=login().then(value=>{if(g!==generation)throw fail('WebVPN 配置已变更，请重试','cancelled');checkedAt=now();state=value;return value;}).catch(e=>{if(g===generation)state={status:'error',error:e.publicMessage||'WebVPN 连接失败',code:e.code};throw e;}).finally(()=>{if(pending===task)pending=null;});pending=task;return task;}
  return {ensure,status:()=>({...state}),reset(){generation++;checkedAt=0;pending=null;state={status:'idle'};}};
 }
 root.WebVPNProvider={create,origin,oidc};if(typeof module!=='undefined')module.exports=root.WebVPNProvider;
})(globalThis);
