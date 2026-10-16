const {test}=require('node:test'),assert=require('node:assert/strict');
global.ExternalCore=require('../external-core.js');
const C=require('../providers/cc98.js');
test('top topics use hotTopic order and forum URLs, never recommendation IDs or untrusted URLs',()=>{
 const d=C.normalizeTop({recommendationReading:[{id:99,title:'other'}],hotTopic:[{id:123,title:'First',url:'javascript:alert(1)'},{id:123,title:'duplicate'},{id:456,title:'Second'}]});
 assert.deepEqual(d.items.map(i=>i.id),['123','456']);assert.equal(d.items[0].url,C.forum+'topic/123');assert.deepEqual(C.normalizeTop({hotTopic:[]}).items,[]);assert.throws(()=>C.normalizeTop({recommendationReading:[]}));assert.throws(()=>C.normalizeTop({hotTopic:[{id:'bad',title:'bad'}]}));
});
test('top requests reuse bearer, refresh once on 401 and block VPN redirect',async()=>{
 const data={local:{cc98PrivateRefresh:{clientId:'fixture',refresh:'private'}},session:{cc98PrivateAccess:{clientId:'fixture',access:'old',expiresAt:Date.now()+3600000}}},storage={};
 for(const area of ['local','session'])storage[area]={setAccessLevel:async()=>{},get:async k=>({[k]:data[area][k]}),set:async v=>Object.assign(data[area],v),remove:async k=>delete data[area][k]};
 global.WebVPNProvider={oidc:'https://webvpn.zju.edu.cn/oidc/'};
 let gets=0,reset=0,redirect=false;const calls=[];
 const provider=C.create({storage,clientId:()=> 'fixture',vpn:{ensure:async()=>{},reset:()=>reset++},request:async(url,opts)=>{calls.push({url,opts});if(url.endsWith('connect/token'))return new Response(JSON.stringify({access_token:'fresh',token_type:'Bearer',expires_in:3600,refresh_token:'new'}));if(redirect)return {type:'opaqueredirect'};if(++gets===1)return new Response('',{status:401});return new Response(JSON.stringify({hotTopic:[{id:777,title:'Topic'}]}));}});
 assert.equal((await provider.top()).items[0].id,'777');assert.equal(gets,2);assert(calls[0].url.endsWith('config/index?vpn-12-o2-www.cc98.org'));assert.equal(calls[0].opts.headers.Authorization,'Bearer old');assert.equal(calls[2].opts.headers.Authorization,'Bearer fresh');assert.equal(calls[2].opts.redirect,'manual');redirect=true;await assert.rejects(provider.top());assert.equal(reset,1);
});
