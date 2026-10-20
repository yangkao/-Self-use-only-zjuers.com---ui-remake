/* Pure DOM view: requests, cache lifetime and navigation belong to the controller. */
(function(root){
 'use strict';
 function issue(entry){
  const code=String(entry?.code||'').toUpperCase();
  if(code==='CACHE_RELEASED')return '此批缓存已释放，请重新获取。';
  if(/AUTH|TOKEN|LOGIN|UNAUTHORIZED/.test(code))return 'CC98 登录已失效或尚未登录，请在设置中检查登录状态。';
  if(/CONFIG/.test(code)||entry?.status==='configuration')return '请先在设置中完成 CC98 配置。';
  if(/FORBIDDEN|PERMISSION/.test(code))return '当前账号无权访问此内容。';
  if(/FORMAT|INVALID_RESPONSE/.test(code))return 'CC98 返回的数据暂时无法显示，请重试。';
  return 'CC98 暂时无法连接，请重试。';
 }
 function render(container,state,actions,H){
  const {el,button,link,icon,time}=H,mode=state.mode||'top',entry=state.entry;
  const data=entry?.data,items=Array.isArray(data?.items)?data.items:[];
  const nodes=[],tabs=el('div',undefined,'cc98-tabs');
  tabs.setAttribute('role','group');tabs.setAttribute('aria-label','论坛浏览方式');
  for(const [value,label]of [['top','十大'],['new','新帖'],['board','版面']]){
   const b=button(label,()=>actions.mode(value),'cc98-tab'+(mode===value?' is-active':''));
   b.setAttribute('aria-pressed',String(mode===value));tabs.append(b);
  }
  const refresh=button('',()=>actions.refresh(),'cc98-action');refresh.title='刷新论坛';refresh.setAttribute('aria-label','刷新论坛');refresh.disabled=!!state.loading||(mode==='board'&&!state.board);
  const refreshIcon=icon('refresh');refreshIcon.setAttribute('aria-hidden','true');refresh.append(refreshIcon);tabs.append(refresh);nodes.push(tabs);
  if(mode==='board'){
   const choose=button(state.board?.name||'选择版面',()=>state.directoryOpen?actions.closeDirectory():actions.openDirectory(),'cc98-action');
   choose.setAttribute('aria-expanded',String(!!state.directoryOpen));nodes.push(choose);
   if(state.directoryOpen)nodes.push(directory());
  }
  const content=el('div',undefined,'cc98-forum-content');content.setAttribute('aria-busy',String(!!state.loading));
  if(state.loading)status(content,items.length?'正在加载，保留当前帖子…':'正在加载帖子…');
  if(entry?.status==='error'||entry?.status==='configuration'||entry?.error){
   status(content,issue(entry)+(items.length?' 当前显示上次获取的内容。':''));
   const retry=button(entry?.code==='CACHE_RELEASED'?'重新获取':'重试',()=>actions.retry(),'cc98-action');retry.disabled=!!state.loading;content.append(retry);
  }
  if(entry?.updatedAt)status(content,'更新于 '+time(entry.updatedAt)+'（北京时间）');
  if(entry?.newItemsDetected)status(content,'发现新帖，已更新本轮浏览。');
  if(mode!=='top'&&state.canPrevious){const previous=button('加载上一批',()=>actions.previous(),'cc98-action');previous.disabled=!!state.loading;const top=el('div',undefined,'cc98-pagination cc98-pagination-previous');top.append(previous);content.append(top);}
  const boardNames=new Map();for(const section of state.directoryEntry?.data?.items||[])for(const b of section.boards||[])boardNames.set(String(b.id),b.name);
  if(state.board)boardNames.set(String(state.board.id),state.board.name);
  for(const item of items)if(item.boardId&&item.boardName)boardNames.set(String(item.boardId),item.boardName);
  for(const item of items){
   const post=el('article',undefined,'cc98-post'),heading=el('h3',undefined,'cc98-post-title');
   heading.append(link(item.title||'无标题',item.url||H.forum+'topic/'+item.id,'cc98-post-title'));post.append(heading);
   const meta=el('div',undefined,'cc98-meta'),author=el('span'),user=icon('user');user.setAttribute('aria-hidden','true');
   author.append(user,el('span',item.isAnonymous?'匿名':item.authorName||'未知作者'));
   meta.append(author,el('span','发布 '+time(item.time)),el('span','浏览 '+(item.hitCount??'未知')),el('span','最后回复 '+time(item.lastPostTime)),el('span',item.boardName||boardNames.get(String(item.boardId))||(item.boardId?'版面名称暂不可用':'未知版面')));
   post.append(meta);content.append(post);
  }
  if(!items.length&&!state.loading&&!entry?.error&&entry?.status!=='error'&&entry?.status!=='configuration'){
   const message=mode==='board'&&!state.board?'选择一个版面开始浏览。':data?'暂无帖子。':'等待加载帖子。';content.append(el('p',message,'cc98-empty'));
  }
  if(mode!=='top'&&data){
   const pagination=el('div',undefined,'cc98-pagination');
   if(data.hasMore&&!data.limitReached){const more=button('加载更多',()=>actions.more(),'cc98-action');more.disabled=!!state.loading;pagination.append(more);}
   else if(mode==='new'&&data.limitReached)pagination.append(el('p','小水怡情，可不要沉迷哟。','cc98-status'));
   else if(data.hasMore===false&&items.length)pagination.append(el('p','已到本轮浏览末尾。','cc98-status'));
   content.append(pagination);
  }
  nodes.push(content);container.replaceChildren(...nodes);
  function status(parent,message){const p=el('p',message,'cc98-status');p.setAttribute('role','status');parent.append(p);}
  function directory(){
   const panel=el('section',undefined,'cc98-directory');panel.setAttribute('aria-label','版面目录');
   const label=el('label','搜索分区或版面','cc98-directory-search'),input=el('input',undefined,'cc98-directory-search');
   input.type='search';input.value=state.directorySearch||'';input.placeholder='输入分区或版面名称';input.dataset.cc98DirectorySearch='true';
   input.addEventListener('input',e=>actions.searchDirectory(e.target.value));label.append(input);panel.append(label,button('关闭目录',()=>actions.closeDirectory(),'cc98-action'));
   const directoryEntry=state.directoryEntry,sections=directoryEntry?.data?.items,query=(state.directorySearch||'').trim().toLocaleLowerCase();
   if(!directoryEntry||directoryEntry.status==='loading')status(panel,'正在加载版面目录…');
   if(directoryEntry?.status==='error'||directoryEntry?.status==='configuration'){
    status(panel,issue(directoryEntry)+(sections?' 当前显示已缓存目录。':''));panel.append(button(directoryEntry.code==='CACHE_RELEASED'?'重新获取目录':'重试目录',()=>actions.openDirectory(),'cc98-action'));
   }
   let matched=0;
   if(Array.isArray(sections))for(const section of sections){
    const sectionMatches=String(section.name||'').toLocaleLowerCase().includes(query),boards=(section.boards||[]).filter(b=>!query||sectionMatches||String(b.name||'').toLocaleLowerCase().includes(query));
    if(!boards.length)continue;matched+=boards.length;
    panel.append(el('h4',section.name||'未命名分区'));
    const list=el('div',undefined,'cc98-boards');
    for(const board of boards){const option=button(board.name||'未命名版面',()=>actions.selectBoard({id:board.id,name:board.name}),'cc98-board-option');option.setAttribute('aria-pressed',String(String(state.board?.id)===String(board.id)));list.append(option);}
    panel.append(list);
   }
   if(Array.isArray(sections)&&!matched)panel.append(el('p',query?'没有匹配的分区或版面。':'暂无可访问版面。','cc98-empty'));
   return panel;
  }
 }
 const api={render};root.HomeCC98Forum=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
