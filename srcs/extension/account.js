'use strict';
const $=id=>document.getElementById(id);
const operations=new Map();
const refreshSymbol=HomeIcons.element('refresh');refreshSymbol.classList.add('refresh-icon');$('cc98Refresh').replaceChildren(refreshSymbol);$('cc98Refresh').title='刷新未读';$('cc98Refresh').setAttribute('aria-label','刷新未读');
async function call(action,args={}) {
  const reply=await chrome.runtime.sendMessage({type:'HOME_EXTERNAL',action,...args,...(['snapshot','refresh'].includes(action)?{projection:'status'}:{})});
  if(!reply?.ok)throw new Error(reply?.error||'扩展后台未响应');
  const form={'save-campus':'campusForm','save-weather':'weatherForm','save-webvpn':'webvpnForm','cc98-client':'cc98Form','select-location':'cityForm'}[action];if(form)HomeFrameState.clean($(form));
  return reply.value;
}
function stateText(state) {
  return Object.entries({courses:'课表',exams:'考试',assignments:'作业'}).map(([key,name])=>{
    const entry=state.entries[key];
    return `${name}：${!entry?'等待获取':entry.status==='ready'?`已更新（${entry.count??entry.data?.items?.length??0} 项）`:entry.error||'正在连接'}`;
  }).join('\n');
}
async function load() {
  const config=await call('configuration');
  if(new URL(location.href).searchParams.get('section')==='cc98')void cc98Load();
  $('username').value=config.username;
  $('vpnUsername').value=config.webvpnUsername||'';$('vpnStatus').textContent=config.webvpnConfigured?'已保存独立 WebVPN 凭据':'尚未配置 WebVPN';
  $('host').value=config.host;
  $('key').placeholder=config.weatherConfigured?'已保存，留空保留原 Key':'填写 API Key';
  $('selectedLocation').textContent=config.location?`已选：${config.location.adm1} ${config.location.adm2} ${config.location.name}`:'尚未选择地点';
  $('campusStatus').textContent=config.campusConfigured?'已保存凭据，可自动连接':'尚未配置校内账户';
  const snapshot=await call('snapshot');
  if(config.campusConfigured)$('campusStatus').textContent+='\n'+stateText(snapshot);
  if(config.weatherConfigured)$('weatherStatus').textContent=['now','daily','rain'].map((key,i)=>{const entry=snapshot.entries[key];return `${['实况','逐日','降水'][i]}：${!entry?'等待获取':entry.error|| (entry.status==='ready'?'已取得数据':'等待更新')}`;}).join('\n');
}
async function run(area,task,{interrupt=false}={}) {
  const previous=operations.get(area);
  if(previous?.busy&&!interrupt)return;
  const operation={busy:true};operations.set(area,operation);
  HomeFrameState.busy(area,true);
  const output=$(area),buttons=[...output.closest('section').querySelectorAll('button')].filter(b=>b.id!=='logout'&&b.id!=='clearWeather');
  buttons.forEach(b=>b.disabled=true);output.classList.remove('is-error');output.textContent='正在处理…';
  try{const text=await task();if(operations.get(area)===operation&&text)output.textContent=text;}
  catch(error){if(operations.get(area)===operation){output.classList.add('is-error');output.textContent=error.message;}}
  finally{operation.busy=false;if(operations.get(area)===operation){buttons.forEach(b=>b.disabled=false);HomeFrameState.busy(area,false);}}
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

const selectedSection=new URL(location.href).searchParams.get('section');if(selectedSection)document.querySelectorAll('[data-source]').forEach(e=>e.hidden=e.dataset.source!==selectedSection);
$('webvpnForm').onsubmit=e=>{e.preventDefault();void run('vpnStatus',async()=>{await call('save-webvpn',{username:$('vpnUsername').value,password:$('vpnPassword').value});$('vpnPassword').value='';return 'WebVPN 凭据已保存。'+(await call('webvpn-connect')).status.replace('ready','已连接。');});};
$('clearVpn').onclick=()=>void run('vpnStatus',async()=>{await call('clear-webvpn');$('vpnUsername').value='';$('vpnPassword').value='';return 'WebVPN 凭据已清除。';});

$('connectVpn').onclick=()=>void run('vpnStatus',async()=>{await call('webvpn-connect');return 'WebVPN 已连接。';});
let cc98Timer,cc98Busy=false;
function cc98Device(d){HomeFrameState.busy('cc98-device',!!d);$('cc98Device').hidden=!d;if(!d){clearTimeout(cc98Timer);return;}$('cc98Code').textContent=d.userCode;const u=new URL(d.url);if(u.origin!=='https://webvpn.zju.edu.cn')throw Error('CC98 验证地址不匹配');$('cc98Verify').href=u.href;clearTimeout(cc98Timer);cc98Timer=setTimeout(cc98Poll,Math.max(5,d.interval)*1000);}
async function cc98Load(){try{const s=await call('cc98-status');$('cc98Client').value=s.clientId;cc98Device(s.device);const e=s.entry;const counts=e?.data;$('cc98Status').textContent=(s.configured?'已保存 CC98 授权':'尚未授权 CC98')+(counts?`\n系统 ${counts.systemCount} · 提及 ${counts.atCount} · 回复 ${counts.replyCount} · 私信 ${counts.messageCount}`:'')+(e?.error?'\n'+e.error:'');}catch(e){$('cc98Status').textContent=e.message;}}
async function cc98Poll(){if(cc98Busy)return;cc98Busy=true;try{const d=await call('cc98-poll');if(d.status==='ready'){cc98Device(null);await cc98Load();$('cc98Status').textContent='授权完成。\n'+$('cc98Status').textContent;}else{cc98Device(d);$('cc98Status').textContent='等待在 CC98 页面确认授权…';}}catch(e){cc98Device(null);$('cc98Status').classList.add('is-error');$('cc98Status').textContent=e.message;}finally{cc98Busy=false;}}
$('cc98Form').onsubmit=e=>{e.preventDefault();void run('cc98Status',async()=>{cc98Device(null);await call('cc98-client',{clientId:$('cc98Client').value});return '应用 ID 已保存，请开始授权。';});};
$('cc98Authorize').onclick=()=>void run('cc98Status',async()=>{const d=await call('cc98-start');cc98Device(d);return '请打开验证链接并输入设备代码。此页会自动检查授权结果。';});
$('cc98Poll').onclick=()=>{clearTimeout(cc98Timer);void cc98Poll();};
$('cc98Refresh').onclick=()=>void run('cc98Status',async()=>{await call('refresh',{keys:['cc98'],force:true});await cc98Load();return $('cc98Status').textContent;});
$('cc98Forget').onclick=()=>void run('cc98Status',async()=>{cc98Device(null);await call('cc98-forget');return '已清除本机令牌。CC98 服务端授权可在原站管理。';});
window.addEventListener('pagehide',()=>clearTimeout(cc98Timer),{once:true});
