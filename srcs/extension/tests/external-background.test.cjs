const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function harness(initial={},network=async()=>{throw Error('unexpected request');}){
 const data=structuredClone(initial),listeners=[],calls=[],storageReads=[];let requests=0;
 const chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,getManifest:()=>({version:'0.2.0'}),onMessage:{addListener:f=>listeners.push(f)}},storage:{local:{setAccessLevel:async()=>{},get:async keys=>{storageReads.push(keys);return structuredClone(data);},set:async patch=>{Object.assign(data,structuredClone(patch));}}},tabs:{create:async()=>{}},webRequest:{}};
 const context=vm.createContext({chrome,URL,Response,AbortController,structuredClone,setTimeout,clearTimeout,console,Date,CampusProvider:{create:()=>({reset(){},courses:async()=>({items:[]}),exams:async()=>({items:[]}),assignments:async()=>({items:[]})})}});
 context.fetch=async(...args)=>{requests++;calls.push(args);return network(...args);};
 for(const file of ['core.js','external-core.js','details-core.js','external-background.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 const home={id:'test',url:'https://zjuers.com/',frameId:0,tab:{id:1}},account={id:'test',url:'chrome-extension://test/account.html',frameId:0};
 const send=(action,args={},sender=home)=>new Promise(resolve=>listeners[0]({type:'HOME_EXTERNAL',action,...args},sender,resolve));
 return {send,data,calls,storageReads,account,requests:()=>requests};
}
test('startup preference read neither fetches sources nor loads private cache',async()=>{
 const h=harness({preferences:{engine:'Google'},privateConfig:{campus:{username:'fixture',password:'never-return'}}});const result=await h.send('preferences-get');assert.equal(result.value.engine,'Google');assert.equal(h.requests(),0);assert.deepEqual(h.storageReads,['preferences']);
});
test('home cannot configure credentials and snapshot contains no credential values',async()=>{
 const h=harness({privateConfig:{campus:{username:'fixture',password:'never-return'},weather:{host:'abc.qweatherapi.com',key:'private-key'}}});
 assert.equal((await h.send('save-campus',{username:'injection',password:'x'})).ok,false);
 const s=await h.send('snapshot');assert.equal(s.ok,true);assert.equal(JSON.stringify(s).includes('never-return'),false);assert.equal(JSON.stringify(s).includes('private-key'),false);assert.equal(JSON.stringify(s).includes('fixture'),false);
 assert.equal((await h.send('snapshot',{}, {id:'test',url:'https://evil.example/',frameId:0})).ok,false);
});
test('logout clears campus cache while retaining weather configuration',async()=>{
 const h=harness({privateConfig:{campus:{username:'fixture',password:'never-return'},weather:{key:'private-key'}},externalCache:{courses:{data:{items:[1]}},now:{data:{temperature:1}}}});
 const s=await h.send('logout');assert.equal(s.ok,true);assert.equal(h.data.privateConfig.campus,undefined);assert.equal(h.data.privateConfig.weather.key,'private-key');assert.equal(h.data.externalCache.courses,undefined);assert.ok(h.data.externalCache.now);
});
test('weather key sent in header only and concurrent refresh shares request',async()=>{
 const h=harness({privateConfig:{weather:{host:'abc.qweatherapi.com',key:'private-key',location:{lat:30,lon:120}}}},async()=>new Response(JSON.stringify({condition:{text:'晴'},temperature:{value:25}})));
 const r=await Promise.all([h.send('refresh',{keys:['now']}),h.send('refresh',{keys:['now']})]);assert.equal(r[0].value.entries.now.status,'ready');assert.equal(h.requests(),1);assert.equal(h.calls[0][0].includes('private-key'),false);assert.equal(h.calls[0][1].headers['X-QW-Api-Key'],'private-key');
});

test('summary reads do not request weather; rain summary and detail share one HTTP request across tabs',async()=>{
 const h=harness({privateConfig:{weather:{host:'abc.qweatherapi.com',key:'private-key',location:{lat:30,lon:120}}}},async()=>new Response(JSON.stringify({summary:'未来2小时无降水',minutely:[{fxTime:'2026-10-15T12:00:00+08:00',precip:'0'}]})));
 for(let i=0;i<4;i++)assert.equal((await h.send('snapshot',{projection:'summary'})).ok,true);assert.equal(h.requests(),0);
 const both=await Promise.all([h.send('refresh',{keys:['rain'],projection:'secondary'}),h.send('refresh',{keys:['rainDetail']})]);assert.equal(h.requests(),1);assert.equal(both[1].value.entries.rainDetail.data.points.length,1);
 await h.send('refresh',{keys:['rainDetail']});assert.equal(h.requests(),1);
 await h.send('refresh',{keys:['rainDetail'],force:true});assert.equal(h.requests(),2,'explicit force refresh remains effective');
});

test('a valid seven-day cache supplies the three-day card without a network request',async()=>{
 const days=Array.from({length:7},(_,i)=>({start:'2026-10-'+String(15+i),max:20+i}));
 const h=harness({externalCache:{daily7:{status:'ready',updatedAt:Date.now(),data:{days}}}});
 const result=await h.send('refresh',{keys:['daily']});assert.equal(result.value.entries.daily.data.days.length,3);assert.equal(h.requests(),0);
});

test('weather card, details and another tab stay within seven distinct requests for a cold full flow',async()=>{
 const h=harness({privateConfig:{weather:{host:'abc.qweatherapi.com',key:'private-key',location:{lat:30,lon:120}}}},async url=>{
  const u=new URL(url);let data;
  if(u.pathname.includes('/minutely/'))data={summary:'未来2小时无降水',minutely:[]};
  else if(u.pathname.includes('/daily/'))data={days:Array.from({length:Number(u.searchParams.get('days'))},(_,i)=>({forecastStartTime:'2026-10-15T00:00:00+08:00',forecastEndTime:'2026-10-16T00:00:00+08:00',temperatureMax:{value:25},daytime:{condition:{text:'晴'}}}))};
  else if(u.pathname.includes('/hourly/'))data={hours:[]};
  else if(u.pathname.includes('/weatheralert/'))data={alerts:[]};
  else if(u.pathname.includes('/airquality/'))data={indexes:[]};
  else data={condition:{text:'晴'},temperature:{value:25}};
  return new Response(JSON.stringify(data));
 });
 await h.send('refresh',{keys:['now','daily','rain'],automatic:true,projection:'summary'});assert.equal(h.requests(),3);
 await Promise.all([h.send('weather-details',{layer:'primary'}),h.send('weather-details',{layer:'auxiliary'})]);assert.equal(h.requests(),6);
 await h.send('weather-details',{layer:'hourly'});assert.equal(h.requests(),7);
 await h.send('refresh',{keys:['now','daily','rain'],automatic:true,projection:'summary'});await h.send('snapshot',{projection:'secondary'});
 await h.send('weather-details',{layer:'primary'});assert.equal(h.requests(),7,'reopening and another tab must reuse valid weather caches');
 assert.equal(new Set(h.calls.map(([url])=>url)).size,7,'no identical endpoint+parameters requested twice');
});

test('location lookup reaches configured multi-level QWeather host',async()=>{
 const h=harness({privateConfig:{weather:{host:'abc.xy.qweatherapi.com',key:'private-key'}}},async()=>new Response(JSON.stringify({code:'200',location:[{id:'101210101',name:'杭州',lat:'30.25',lon:'120.15'}]})));
 const result=await h.send('lookup',{query:'杭州'},h.account);
 assert.equal(result.ok,true);assert.equal(result.value[0].name,'杭州');assert.equal(h.requests(),1);
 assert.equal(new URL(h.calls[0][0]).hostname,'abc.xy.qweatherapi.com');
 assert.equal(new URL(h.calls[0][0]).searchParams.get('location'),'杭州');
 assert.equal(h.calls[0][1].headers['X-QW-Api-Key'],'private-key');
});
