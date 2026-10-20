(async () => {
  if (!['/','/index.html'].includes(location.pathname) || document.getElementById('zjuers-personal-host')) return;
  const startedAt = performance.now();
  const controller = HomeBoot.controller;
  let host;
  let fonts;
  let fontPreload;
  function report(stage,error = '') {
    const navigationMs = Math.round(performance.now());
    try{chrome.runtime.sendMessage({type:'HOME_UI_STATUS',stage,error,navigationMs,elapsedMs:Math.round(navigationMs-startedAt)}).catch(() => {});}catch{}
  }
  report('提前启动资源准备');
  try {
    const resource = path => chrome.runtime.getURL(path);
    const wait = predicate => HomeStartup.waitForDom(predicate,document,MutationObserver,controller.signal);
    const navigationReady = wait(()=>HomeStartup.navigationComplete(document)).then(()=>report('原站导航结构完整'));
    host = document.createElement('div'); host.id = 'zjuers-personal-host';
    host.style.visibility = 'hidden';
    const root = host.attachShadow({mode:'open'});
    const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = resource('ui/style.css');
    const styleReady = new Promise((resolve,reject) => {
      let pending=8;const loaded=()=>{if(--pending===0)resolve();};
      stylesheet.onload = () => {report('内置样式加载完成');loaded();};
      stylesheet.onerror = () => reject(new Error('无法加载界面样式'));
      root.append(stylesheet);
      const controls=document.createElement('link');controls.rel='stylesheet';controls.href=resource('ui/controls.css');controls.onload=loaded;controls.onerror=()=>reject(new Error('无法加载控件样式'));root.append(controls);
      const custom=document.createElement('link');custom.rel='stylesheet';custom.href=resource('ui/customization.css');
      custom.onload=loaded;custom.onerror=()=>reject(new Error('无法加载主题样式'));root.append(custom);
      const detailStyle=document.createElement('link');detailStyle.rel='stylesheet';detailStyle.href=resource('ui/details.css');detailStyle.onload=loaded;detailStyle.onerror=()=>reject(new Error('无法加载详情样式'));root.append(detailStyle);
      const widgetStyle=document.createElement('link');widgetStyle.rel='stylesheet';widgetStyle.href=resource('ui/widgets.css');widgetStyle.onload=loaded;widgetStyle.onerror=()=>reject(new Error('无法加载组件样式'));root.append(widgetStyle);
      const navStyle=document.createElement('link');navStyle.rel='stylesheet';navStyle.href=resource('ui/navigation.css');navStyle.onload=loaded;navStyle.onerror=()=>reject(new Error('无法加载导航样式'));root.append(navStyle);
      const cc98Style=document.createElement('link');cc98Style.rel='stylesheet';cc98Style.href=resource('ui/cc98.css');cc98Style.onload=loaded;cc98Style.onerror=()=>reject(new Error('无法加载论坛样式'));root.append(cc98Style);
      const surfaceStyle=document.createElement('link');surfaceStyle.rel='stylesheet';surfaceStyle.href=resource('ui/surfaces.css');surfaceStyle.onload=loaded;surfaceStyle.onerror=()=>reject(new Error('无法加载材质样式'));root.append(surfaceStyle);
    });
    const bodyReady = wait(()=>Boolean(document.body)).then(()=>document.body.append(host));
    // Fonts must be registered outside the shadow tree for browser font lookup.
    fonts = document.createElement('style');
    fonts.textContent = `@font-face{font-family:'ZJUers Josefin';src:url('${resource('ui/media/JosefinSans.ttf')}') format('truetype');font-weight:100 700;font-display:swap}`;
    fontPreload = document.createElement('link');fontPreload.rel='preload';fontPreload.as='font';fontPreload.type='font/ttf';fontPreload.crossOrigin='anonymous';fontPreload.href=resource('ui/media/JosefinSans.ttf');
    const fontsReady = wait(()=>Boolean(document.head)).then(()=>{document.head.append(fonts,fontPreload);});
    const templateReady = (async () => {
      const response = await fetch(resource('ui/template.html'),{signal:controller.signal});
      if (!response.ok) throw new Error('无法读取内置界面');
      const template = document.createElement('template');
      template.innerHTML = await response.text();
      report('内置模板读取完成');
      root.append(template.content.cloneNode(true));
      const video=root.querySelector('video');video.muted=true;
      video.addEventListener('loadeddata',()=>report('视频首帧可用'),{once:true});
      root.querySelectorAll('img').forEach(img => {img.src=resource('ui/media/zjuers.png');});
    })();
    const preferencesReady = HomeExternal.call('preferences-get').then(preferences=>({preferences})).then(value => {report('界面偏好读取完成');return value;});
    const themeReady = HomeExternal.call('themes-get').then(result=>{const theme=result.state.themes.find(t=>t.id===result.state.activeId)||HomeThemeCore.defaultTheme();for(const [key,value]of Object.entries(theme.colors))host.style.setProperty('--theme-'+key,value);document.documentElement.style.setProperty('--home-background',theme.colors.background);return result;});
    const [, {preferences:stored},initialThemeSettings] = await Promise.all([templateReady,preferencesReady,themeReady,styleReady,bodyReady,fontsReady,navigationReady]);
    const categories = {};
    for (let index=1;index<=9;index++) {
      const key=`cat${index}`;
      categories[key]=[...document.getElementById(key).closest('.dh').querySelectorAll('a[href]')].map(a=>({
        id:a.id,label:a.textContent.trim(),href:a.href,target:a.target || '_blank',title:a.getAttribute('title') || a.dataset.zjgTip || ''
      })).filter(a=>/^https?:\/\//i.test(a.href));
    }
    const navReply=await chrome.runtime.sendMessage({type:'HOME_NAV',action:'read',categories});
    if(!navReply?.ok)throw new Error(navReply?.error||'导航读取失败');
    const groups=navReply.value.groups;
    const guide=document.getElementById('info0');
    const guideInfo={href:guide?.href || 'https://zjuers.com/welcome/',title:guide?.title || ''};
    report('原站导航读取完成');
    const prefs = HomeCore.preferences(stored);
    initializeHome(root,{groups,guideInfo,prefs,resource,categories,navigationState:navReply.value.state,initialThemeSettings});
    // Commit the selected theme while transitions are still disabled, before reveal.
    getComputedStyle(root.querySelector('.app')).backgroundColor;
    host.dataset.themeReady='true';
    report('界面交互初始化完成');
    document.body.style.margin = '0'; document.body.style.background = 'var(--home-background,#17191f)';
    document.documentElement.style.background = 'var(--home-background,#17191f)';
    Object.assign(host.style,{display:'block',position:'relative',minHeight:'100vh',isolation:'isolate',visibility:'visible'});
    document.title = 'ZJUers 轻首页';
    document.querySelectorAll('link[rel~="icon"]').forEach(icon => icon.remove());
    const favicon = document.createElement('link'); favicon.rel = 'icon'; favicon.href = resource('ui/media/favicon.ico'); document.head.append(favicon);
    HomeBoot.ready();
    report('界面挂载完成');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(host.isConnected){
        report('界面显示帧检查点');
        const video=root.querySelector('video');
        if(video?.getAttribute?.('src')){const stopVideo=HomeExternal.watchVideo(video,document,stage=>report(stage));window.addEventListener('pagehide',stopVideo,{once:true});}
        try{HomeExternal.initialize(root);report('外部信息界面初始化完成');}
        catch(error){
          report('外部信息界面初始化失败',String(error?.message||'未知初始化错误').slice(0,160));
          for(const card of root.querySelectorAll('.info-card')){
            const message=document.createElement('p');message.className='empty-state';message.textContent='真实数据界面初始化失败，请刷新首页；若仍失败，请查看加载诊断。';
            card.replaceChildren(message);
          }
        }
      }
    }));
  } catch (error) {
    HomeBoot.fail();
    report('界面挂载失败',error.message);
    host?.remove();
    fonts?.remove();fontPreload?.remove();
    console.error('个人首页未挂载，保留原站页面',error);
    const notice = document.createElement('div');
    notice.textContent = '个人首页界面加载失败，当前显示原站。请在扩展管理页查看错误。';
    notice.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:12px;background:#281733;color:white';
    const target=document.body || document.documentElement;
    target?.prepend(notice);
  }
})();
