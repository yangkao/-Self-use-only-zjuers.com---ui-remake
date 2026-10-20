const {test}=require('node:test'),assert=require('node:assert/strict'),U=require('../ui/cc98-ui-core.js');
test('avatar URLs use only the two official WebVPN hostname encodings, including old cached direct URLs',()=>{
 const {createCipheriv}=require('node:crypto'),key=Buffer.from('wrdvpnisthebest!');
 for(const [host,expected] of [['www.cc98.org','e7e056d22433310830079bab'],['api.cc98.org','f1e748d22433310830079bab'],['openid.cc98.org','ffe744922e3426537d51d1e2974724'],['file.cc98.org','f6fe4d9969336b09264686be9f']]){
  const cipher=createCipheriv('aes-128-cfb',key,key);assert.equal(Buffer.concat([cipher.update(host),cipher.final()]).toString('hex'),expected);
 }
 for(const host of ['www.cc98.org','file.cc98.org']){const url=U.avatarURL('https://'+host+'/avatar/a.png?v=1');assert.equal(new URL(url).origin,'https://webvpn.zju.edu.cn');assert.equal(U.avatarURL(url),url);assert(url.endsWith('/avatar/a.png?v=1'));}
 for(const url of [null,'','https://evil.invalid/a','https://file.cc98.org.evil.invalid/a','https://name:secret@file.cc98.org/a','https://webvpn.zju.edu.cn/login','https://webvpn.zju.edu.cn/https/other/a'])assert.equal(U.avatarURL(url),null);
});
test('forum links remain within the known HTTPS proxy and timestamps use Beijing absolute dates',()=>{
 assert.equal(U.safeURL(U.forum+'topic/123'),U.forum+'topic/123');for(const u of ['javascript:alert(1)','https://evil.invalid','https://webvpn.zju.edu.cn/login','https://user:password@webvpn.zju.edu.cn/https/fixture'])assert.equal(U.safeURL(u),null);
 assert.match(U.time('2026-10-20T00:30:00Z'),/2026\/10\/20.*08:30/);assert.equal(U.time(null),'未知时间');
});
test('local UI cache bounds total pages, post items and bytes instead of retaining hidden data',()=>{
 const c=U.cache({maxPages:3,maxItems:40,maxBytes:100000});for(let page=0;page<30;page++)c.put(String(page),{data:{kind:'new',items:Array.from({length:20},(_,i)=>({id:page*20+i,title:'fixture'}))}});assert(c.stats().pages<=2);assert.equal(c.stats().items,40);assert.equal(c.get('0'),null);c.clear();assert.deepEqual(c.stats(),{pages:0,bytes:0,items:0});
 const small=U.cache({maxBytes:20});small.put('a',{data:{content:'x'.repeat(50)}});assert.equal(small.stats().pages,0);
});
test('adjacent forum batches preserve ordering, deduplicate IDs and retain error guidance',()=>{
 const e=(items,nextFrom,hasMore=true)=>({status:'ready',data:{kind:'new',items:items.map(id=>({id})),nextFrom,hasMore}});
 const result=U.combine([e(['4','3'],20),e(['3','2'],40),{status:'error',code:'TIMEOUT',error:'请重试'}]);assert.deepEqual(result.data.items.map(i=>i.id),['4','3','2']);assert.equal(result.data.nextFrom,40);assert.equal(result.code,'TIMEOUT');assert.equal(result.stale,true);
});
test('refresh invalidation removes only continuation pages of the active forum target',()=>{
 const c=U.cache(),queries=[{kind:'new',from:0},{kind:'new',from:20},{kind:'board',boardId:'182',from:20},{kind:'profile'}];
 for(const q of queries)c.put(U.key(q),{data:{kind:q.kind}});
 c.removeWhere(k=>{const q=JSON.parse(k);return q.kind==='new'&&q.from>0;});
 assert(c.get(U.key(queries[0])));assert.equal(c.get(U.key(queries[1])),null);assert(c.get(U.key(queries[2])));assert(c.get(U.key(queries[3])));
});
