const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../external-core.js');
test('request pool never exceeds two requests',async()=>{
  let active=0,peak=0;const pool=E.pool(2);
  await Promise.all(Array.from({length:8},()=>pool(async()=>{peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,5));active--;})));
  assert.equal(peak,2);
});
test('cache shares in-flight request and keeps old data with failure/backoff',async()=>{
 let time=1000,calls=0;const cache=E.cache({now:()=>time});
 const task=()=>{calls++;return Promise.resolve({items:[1]});};
 await Promise.all([cache.get('x',100,task),cache.get('x',100,task)]);assert.equal(calls,1);
 time=1200;await cache.get('x',100,()=>{throw new Error('secret network text');});
 assert.deepEqual(cache.entries.x.data,{items:[1]});assert.equal(cache.entries.x.status,'error');
 assert.equal(cache.entries.x.error,'连接失败，请稍后重试');
 await cache.get('x',100,task);assert.equal(calls,1);
});
test('reset prevents outstanding request restoring cleared cache',async()=>{
 const cache=E.cache({});let resolve;const pending=cache.get('x',100,()=>new Promise(r=>resolve=r));
 await Promise.resolve();cache.clear();resolve({private:true});await pending;assert.deepEqual(cache.entries,{});
});
test('clearing weather does not invalidate an independent campus refresh',async()=>{
 const cache=E.cache({});let resolve;const pending=cache.get('courses',100,()=>new Promise(r=>resolve=r));
 await Promise.resolve();cache.clear(['now']);resolve({items:[1]});await pending;assert.deepEqual(cache.entries.courses.data,{items:[1]});
});
test('manual refresh respects rate-limit cooldown',async()=>{
 const cache=E.cache({now:()=>1000,entries:{quote:{status:'error',code:'rate-limit',retryAt:5000}}});let calls=0;
 await cache.get('quote',0,()=>{calls++;return {};},{force:true});assert.equal(calls,0);
});
test('weather host rejects arbitrary destinations and embedded credentials',()=>{
 assert.equal(E.weatherHost('abc.qweatherapi.com'),'abc.qweatherapi.com');
 assert.equal(E.weatherHost('h2a9cf3mhs.xy.qweatherapi.com'),'h2a9cf3mhs.xy.qweatherapi.com');
 assert.equal(E.weatherHost(' https://H2A9CF3MHS.XY.qweatherapi.com/ '),'h2a9cf3mhs.xy.qweatherapi.com');
 for(const host of ['.qweatherapi.com','abc..xy.qweatherapi.com','-abc.xy.qweatherapi.com','abc-.xy.qweatherapi.com','https://abc.xy.qweatherapi.com:443'])assert.throws(()=>E.weatherHost(host));
 for(const host of ['evil.com','https://key@abc.qweatherapi.com','abc.qweatherapi.com.evil.com','abc.qweatherapi.com/path'])assert.throws(()=>E.weatherHost(host));
});
test('weather v1 fields are normalized without invented values',()=>{
 const result=E.weatherNow({condition:{text:'晴',code:'100'},temperature:{value:21.3},feelsLike:{value:22},humidity:.69,visibility:{value:29020,unit:'m'},wind:{direction:{compass:'sw'},speed:{value:4.74,unit:'m/s'}}});
 assert.equal(result.humidity,69);assert.equal(result.visibility,29.02);assert.equal(result.code,'100');assert.equal(result.wind.speed.value,4.74);
 const missing=E.weatherNow({condition:{text:'晴'},temperature:{value:21.3}});assert.equal(missing.humidity,null);assert.equal(missing.visibility,null);
 assert.throws(()=>E.weatherNow({}));
});
test('quote preserves original text and missing attribution',()=>{
 assert.deepEqual(E.quote({type:'k',hitokoto:' 原文。 ',from:null,from_who:null}),{text:' 原文。 ',from:null,author:null});
 assert.throws(()=>E.quote({type:'d',hitokoto:'文学'}));
});
test('daily forecast uses actual daytime condition and preserves unavailable values',()=>{
 const result=E.weatherDaily({days:[{forecastStartTime:'2026-10-02T00:00:00+08:00',forecastEndTime:'2026-10-03T00:00:00+08:00',temperatureMax:{value:24},temperatureMin:{value:19},daytime:{condition:{text:'阴',code:'104'}}}]});
 assert.equal(result.days[0].text,'阴');assert.equal(result.days[0].code,'104');assert.equal(result.days[0].max,24);
 const missing=E.weatherDaily({days:[{}]}).days[0];assert.equal(missing.text,null);assert.equal(missing.max,null);
});
test('academic term uses Shanghai date across academic year and half-semester boundaries',()=>{
 assert.equal(E.academicTerm('2026-09-01T00:00:00+08:00'),'2026-1');
 assert.equal(E.academicTerm('2027-01-31T12:00:00+08:00'),'2026-1');
 assert.equal(E.academicTerm('2027-02-01T00:00:00+08:00'),'2026-2');
});
