const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../external-core.js');
test('summary is bounded, omits semester/forecast detail and leaves the shared cache intact',()=>{
 const now=Date.parse('2026-10-15T07:00:00+08:00'),items=Array.from({length:300},(_,i)=>({title:'Course '+i,date:i<25?'2026-10-15':'2026-10-16',start:'2026-10-15T08:00:00+08:00',end:'2026-10-15T09:00:00+08:00',schedule:{weeks:Array.from({length:16},(_,i)=>i+1)}}));
 const full={config:{campusConfigured:true},entries:{courses:{status:'ready',data:{items,calendar:{large:true}}},daily7:{data:{days:Array(7).fill({})}},now:{data:{temperature:20,text:'晴',code:100,wind:{large:true}}}}};
 const summary=E.project(full,'summary',undefined,now);assert.equal(summary.entries.courses.data.items.length,20);assert(!summary.entries.courses.data.calendar);assert(!summary.entries.courses.data.items[0].schedule);assert(!summary.entries.daily7);assert(!summary.entries.now.data.wind);assert.equal(full.entries.courses.data.items.length,300);
 assert(JSON.stringify(summary).length<JSON.stringify(full).length/5);
 const day=E.project(full,'secondary','2026-10-15',now);assert.equal(day.entries.courses.data.items.length,25);assert.equal(day.entries.courses.data.dates.length,2);assert.equal(E.project(full),full);
 const status=E.project(full,'status');assert.equal(status.entries.courses.count,300);assert(!status.entries.courses.data);
});
