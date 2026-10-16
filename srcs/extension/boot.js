(function(root){
  const controller=new AbortController();
  let finished=false;
  document.documentElement.setAttribute('data-zjuers-state','loading');
  const timer=setTimeout(()=>{
    fail();
    const notice=document.createElement('div');
    notice.id='zjuers-startup-notice';
    notice.textContent='个人首页准备超时，已恢复原站。请复制扩展诊断记录。';
    notice.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:12px;background:#281733;color:white';
    (document.body || document.documentElement).prepend(notice);
  },8000);
  function fail(){
    if(finished)return;
    finished=true;clearTimeout(timer);controller.abort();
    document.documentElement.setAttribute('data-zjuers-state','failed');
    document.getElementById('zjuers-personal-host')?.remove();
  }
  root.HomeBoot={controller,fail,ready(){
    if(finished)throw new Error('启动保护已恢复原站，取消本次挂载');
    finished=true;clearTimeout(timer);document.documentElement.setAttribute('data-zjuers-state','ready');
  }};
})(globalThis);
