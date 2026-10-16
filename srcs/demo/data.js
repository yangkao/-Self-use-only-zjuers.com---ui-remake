/* SPDX-License-Identifier: GPL-3.0-only
 * Entirely synthetic public examples, sized like a normally populated student dashboard.
 */
(function(root){
 'use strict';
 const DAY=86400000;
 const dayOf=n=>new Date(n+8*3600000).toISOString().slice(0,10);
 const times=[['00:00','00:00'],['08:00','08:45'],['08:50','09:35'],['10:00','10:45'],['10:50','11:35'],['11:40','12:25'],['13:25','14:10'],['14:15','15:00'],['15:05','15:50'],['16:15','17:00'],['17:05','17:50'],['18:50','19:35'],['19:40','20:25'],['20:30','21:15'],['21:20','22:05'],['22:10','22:55']];
 const names=['微积分','线性代数','程序设计基础','大学物理','学术英语','中国近现代史纲要','概率论与数理统计','数据结构','体育','工程与设计导论'];
 function create(now=Date.now(),base='https://example.invalid/demo/'){
  const day=dayOf(now),mid=Date.parse(day+'T12:00:00+08:00'),weekday=new Date(mid+8*3600000).getUTCDay()||7;
  const monday=mid-(weekday-1)*DAY-6*7*DAY,other=[1,2,3,4,5,6,7].filter(d=>d!==weekday).slice(0,4),slots=[[1,2],[3,5],[6,8],[9,10],[11,13]];
  const rules=slots.map((slot,i)=>({day:weekday,slot,title:i}));for(const [j,count]of [4,3,3,3].entries())for(let i=0;i<count;i++)rules.push({day:other[j],slot:slots[i],title:rules.length%10});
  const term=(()=>{const d=new Date(mid+8*3600000),y=d.getUTCFullYear(),m=d.getUTCMonth()+1;return `${m>=9?y:y-1}-${m>=2&&m<=8?2:1}`;})();
  const season=term.endsWith('-1')?'秋冬':'春夏',items=[];
  for(let w=0;w<16;w++)for(const [r,rule]of rules.entries()){
   const parity=r===16?0:r===17?1:2;if(parity!==2&&(w%2===0?0:1)!==parity)continue;
   const date=dayOf(monday+w*7*DAY+(rule.day-1)*DAY),[first,last]=rule.slot,campus=r%4===0?'玉泉':'紫金港';
   items.push({id:`demo-course-${r}-${w}`,title:names[rule.title],teacher:`示例教师 ${String(rule.title+1).padStart(2,'0')}`,place:campus==='玉泉'?'教七 205':`东${1+r%3}-${101+r*3}`,campus,source:'示例教务',date,start:date+'T'+times[first][0]+':00+08:00',end:date+'T'+times[last][1]+':00+08:00',url:'https://zdbk.zju.edu.cn/',schedule:{day:rule.day,first,last,season,halves:[true,true],parity,weeks:[]}});
  }
  const entry=data=>({status:'ready',updatedAt:now,data,example:true});
  const condition=[['多云',101],['晴',100],['小雨',305],['阴',104],['多云',101],['晴',100],['小雨',305]];
  const days=Array.from({length:7},(_,i)=>{const d=dayOf(mid+i*DAY);return {start:d+'T00:00:00+08:00',end:dayOf(mid+(i+1)*DAY)+'T00:00:00+08:00',max:24+[1,2,-2,-1,0,2,-1][i],min:16+[0,1,-1,0,1,1,0][i],text:condition[i][0],code:condition[i][1],night:{text:i%3===2?'小雨':'多云',code:i%3===2?305:151},probability:i%3===2?.75:.15,precipitation:{value:i%3===2?3.2:0,unit:'mm'},uv:i%3===2?2:5,sunrise:d+'T06:03:00+08:00',sunset:d+'T17:36:00+08:00'};});
  const hourly={hours:Array.from({length:24},(_,i)=>({time:new Date(now+i*3600000).toISOString(),temperature:Math.round(20+4*Math.sin(i/5)),text:i>=4&&i<=7?'小雨':'多云',code:i>=4&&i<=7?305:101,probability:i>=4&&i<=7?.7:.1}))};
  const rain={summary:'约30分钟后有短时小雨',points:Array.from({length:24},(_,i)=>({time:new Date(now+i*300000).toISOString(),precipitation:i>=6&&i<=16?Number((Math.sin((i-5)/12*Math.PI)*.6).toFixed(2)):0}))};
  const assignments=Array.from({length:12},(_,i)=>({id:'demo-assignment-'+i,title:['第三章习题','实验报告：数据分析','阅读与思考','程序设计练习','单元测验准备','课程项目阶段汇报'][i%6],course:names[i%10],deadline:new Date(now+(i===0?8:i*19+12)*3600000).toISOString(),url:'https://courses.zju.edu.cn/'}));
  const exams=Array.from({length:6},(_,i)=>{const date=dayOf(mid+(i*4+3)*DAY);return {id:'demo-exam-'+i,title:names[i],date,start:date+'T14:00:00+08:00',end:date+'T16:00:00+08:00',place:`紫金港 东${i%3+1}-${201+i*3}`,campus:'紫金港',url:'https://zdbk.zju.edu.cn/'};});
  const titles=['秋日校园摄影分享','图书馆学习空间使用体验','周末徒步路线交流','这周你读了什么书','课程项目中的小发现','校园音乐会观后感','食堂新菜体验记录','我的学期规划方法','运动搭子的日常','分享一段最近喜欢的旋律'];
  const topics=titles.map((title,i)=>({id:'demo-topic-'+i,title,url:new URL('post.html?id='+i,base).href}));
  return {example:true,config:{campusConfigured:true,weatherConfigured:true,webvpnConfigured:true,cc98Configured:true,location:{id:'demo-hangzhou',name:'西湖',adm1:'浙江',adm2:'杭州',lat:30.25,lon:120.13,tz:'Asia/Shanghai'}},entries:{
   now:entry({temperature:23,text:'多云',code:101,feelsLike:24,humidity:64,wind:{direction:{compass:'ne'},speed:{value:2.8,unit:'m/s'},scale:2},visibility:18,pressure:{value:1014,unit:'hPa'},uvIndex:4}),daily:entry({days:days.slice(0,3)}),daily7:entry({days}),hourly:entry(hourly),rain:entry({summary:rain.summary}),rainDetail:entry(rain),
   alerts:entry({alerts:[{title:'示例：短时降雨提醒',description:'以下为演示预警，请勿作为真实天气预警使用。午后可能出现短时降雨，外出可携带雨具。',sender:'演示数据'}]}),
   air:entry({indexes:[{name:'中国空气质量指数',code:'chn-mee',display:'38',aqi:38,category:'优',advice:'示例：适宜户外活动。'}],pollutants:[{name:'PM2.5',concentration:{value:18,unit:'μg/m³'}}]}),
   courses:entry({items,calendar:{sessionTime:times,startEnd:[dayOf(monday),dayOf(monday+55*DAY),dayOf(monday+56*DAY),dayOf(monday+111*DAY)],holiday:[],exchange:[]},academicTerm:term}),exams:entry({items:exams}),assignments:entry({items:assignments}),
   cc98:entry({systemCount:1,atCount:2,replyCount:3,messageCount:1,total:7,url:new URL('post.html',base).href}),cc98Top:entry({items:topics,url:new URL('post.html',base).href}),
   quote:entry({text:'给思考留一点空白，也给今天留一点期待。',author:'演示文案',from:'示例内容（非哲学家原句）'})}};
 }
 const api={create,dayOf};root.HomeDemoData=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
