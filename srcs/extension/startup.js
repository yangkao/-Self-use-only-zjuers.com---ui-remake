(function(root){
  function navigationComplete(doc) {
    // The footer follows all nine closed cards, before the trailing scripts.
    // Seeing cat9 alone is insufficient: its links may still be arriving.
    return Boolean(doc.querySelector('footer.footer')) && Array.from({length:9},(_,i)=>i+1)
      .every(i=>doc.getElementById(`cat${i}`)?.closest('.dh')?.querySelector('a[href]'));
  }
  function waitForDom(predicate,doc=document,Observer=MutationObserver,signal) {
    return new Promise((resolve,reject)=>{
      let observer;
      const cleanup=()=>{observer?.disconnect();doc.removeEventListener?.('DOMContentLoaded',check);signal?.removeEventListener('abort',abort);};
      const abort=()=>{cleanup();reject(new Error('界面准备已取消'));};
      function check() {
        if(signal?.aborted)return abort();
        if(predicate()){cleanup();resolve();return;}
        if(doc.readyState!=='loading'){cleanup();reject(new Error('原站结构未就绪，请检查页面是否变化'));}
      }
      if(signal?.aborted || predicate() || doc.readyState!=='loading'){check();return;}
      observer=new Observer(check);observer.observe(doc,{childList:true,subtree:true});
      doc.addEventListener('DOMContentLoaded',check);signal?.addEventListener('abort',abort,{once:true});
      check();
    });
  }
  root.HomeStartup={navigationComplete,waitForDom};
  if(typeof module!=='undefined')module.exports=root.HomeStartup;
})(globalThis);
