(()=>{
 const status=document.getElementById('status');let busy=false,hasBackup=false;
 function updateButtons(){document.getElementById('backup').disabled=busy||!hasBackup;document.getElementById('restore').disabled=busy||!hasBackup;}
 async function checkBackup(){const data=await call('portable-backup');hasBackup=!!data;document.getElementById('backupState').textContent=data?'已保存导入前副本，可下载或恢复。':'暂无导入前副本。首次导入配置后会自动生成。';updateButtons();}
 document.getElementById('chooseFile').onclick=()=>document.getElementById('file').click();
 async function call(action,args={}){const r=await chrome.runtime.sendMessage({type:'HOME_EXTERNAL',action,...args});if(!r?.ok)throw Error(r?.error||'扩展未响应');return r.value;}
 function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 async function run(task){if(busy)return;busy=true;HomeFrameState.busy('data',true);document.querySelectorAll('button,input').forEach(e=>e.disabled=true);try{await task();HomeFrameState.clean(document);await checkBackup();}catch(e){status.textContent=e.message||'操作失败';}finally{busy=false;HomeFrameState.busy('data',false);document.querySelectorAll('button,input').forEach(e=>e.disabled=false);updateButtons();}}
 document.getElementById('export').onclick=()=>run(async()=>{download(await call('portable-export'),'zjuers-home-config.json');status.textContent='已导出首页配置。';});
 document.getElementById('backup').onclick=()=>run(async()=>{const data=await call('portable-backup');if(!data)throw Error('暂无导入前副本');download(data,'zjuers-home-before-import.json');status.textContent='已下载导入前副本。';});
 document.getElementById('restore').onclick=()=>run(async()=>{await call('portable-restore');status.textContent='已恢复导入前配置；刚才的配置成为唯一副本。已打开的首页正在刷新。';});
 document.getElementById('file').onchange=()=>run(async()=>{const input=document.getElementById('file'),file=input.files[0];if(!file)return;if(file.size>4*1024*1024)throw Error('配置文件不能超过4MB');let data;try{data=JSON.parse(await file.text());}catch{throw Error('无法读取 JSON 配置文件');}await call('portable-import',{data});input.value='';status.textContent='配置已导入，已保存导入前副本。已打开的首页正在刷新；请核对本机壁纸路径及信息源配置。';});
 document.getElementById('file').addEventListener('change',event=>{document.getElementById('fileName').textContent=event.target.files[0]?.name||'尚未选择文件';});
 void checkBackup().catch(e=>{document.getElementById('backupState').textContent=e.message;});
})();
