'use strict';
const $=id=>document.getElementById(id);
const operations=new Map();
async function call(action,args={}) {
  const reply=await chrome.runtime.sendMessage({type:'HOME_EXTERNAL',action,...args});
  if(!reply?.ok)throw new Error(reply?.error||'扩展后台未响应');
  return reply.value;
}
function stateText(state) {
  return Object.entries({courses:'课表',exams:'考试',assignments:'作业'}).map(([key,name])=>{
    const entry=state.entries[key];
    return `${name}：${!entry?'等待获取':entry.status==='ready'?`已更新（${entry.data?.items?.length||0} 项）`:entry.error||'正在连接'}`;
  }).join('\n');
}
async function load() {
  const config=await call('configuration');
  $('username').value=config.username;
  $('host').value=config.host;
  $('key').placeholder=config.weatherConfigured?'已保存，留空保留原 Key':'填写 API Key';
  $('selectedLocation').textContent=config.location?`已选：${config.location.adm1} ${config.location.adm2} ${config.location.name}`:'尚未选择地点';
  $('campusStatus').textContent=config.campusConfigured?'已保存凭据，可自动连接':'尚未配置校内账户';
}
async function run(area,task,{interrupt=false}={}) {
  const previous=operations.get(area);
  if(previous?.busy&&!interrupt)return;
  const operation={busy:true};operations.set(area,operation);
  const output=$(area),buttons=[...output.closest('section').querySelectorAll('button')].filter(b=>b.id!=='logout'&&b.id!=='clearWeather');
  buttons.forEach(b=>b.disabled=true);output.textContent='正在处理…';
  try{const text=await task();if(operations.get(area)===operation&&text)output.textContent=text;}
  catch(error){if(operations.get(area)===operation)output.textContent=error.message;}
  finally{operation.busy=false;if(operations.get(area)===operation)buttons.forEach(b=>b.disabled=false);}
}
$('campusForm').addEventListener('submit',event=>{
  event.preventDefault();
  void run('campusStatus',async()=>{
    await call('save-campus',{username:$('username').value,password:$('password').value});
    $('password').value='';
    return stateText(await call('refresh',{keys:['courses','assignments','exams'],force:true}));
  });
});
$('login').addEventListener('click',()=>void run('campusStatus',async()=>stateText(await call('refresh',{keys:['courses','assignments','exams'],force:true}))));
$('logout').addEventListener('click',()=>void run('campusStatus',async()=>{
  await call('logout');$('username').value='';$('password').value='';
  return '已清除本扩展的凭据和校内缓存，停止自动登录。其他网页的登录状态不受影响。';
},{interrupt:true}));
$('weatherForm').addEventListener('submit',event=>{
  event.preventDefault();void run('weatherStatus',async()=>{
    await call('save-weather',{host:$('host').value,key:$('key').value});$('key').value='';
    return '天气凭据已保存，请查询并选择地点。';
  });
});
$('cityForm').addEventListener('submit',event=>{
  event.preventDefault();void run('weatherStatus',async()=>{
    const items=await call('lookup',{query:$('city').value});$('locations').replaceChildren();
    for(const location of items) {
      const button=document.createElement('button');button.type='button';button.textContent=`${location.adm1} · ${location.adm2} · ${location.name}`;
      button.addEventListener('click',()=>void run('weatherStatus',async()=>{
        await call('select-location',{location});$('selectedLocation').textContent=`已选：${button.textContent}`;
        const state=await call('refresh',{keys:['now','daily','rain'],force:true});
        return ['now','daily','rain'].map((key,index)=>`${['实时','每日','降水'][index]}：${state.entries[key]?.status==='ready'?'已连接':state.entries[key]?.error||'等待获取'}`).join('\n');
      }));$('locations').append(button);
    }
    return items.length?'请选择匹配的地点。':'没有找到地点，请换一个名称。';
  });
});
$('clearWeather').addEventListener('click',()=>void run('weatherStatus',async()=>{
  await call('clear-weather');$('key').value='';$('host').value='';$('locations').replaceChildren();$('selectedLocation').textContent='尚未选择地点';
  return '天气配置及缓存已清除。';
},{interrupt:true}));
load().catch(error=>{$('campusStatus').textContent=error.message;});
