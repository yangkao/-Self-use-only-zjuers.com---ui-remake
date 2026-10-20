/* Personal CC98 presentation. All reads and instance lifetime belong to the controller. */
(function(root){
 'use strict';
 const value=v=>v===null||v===undefined||v===''?'未知':String(v);
 function render(container,state={},actions={},H){
  const el=H.el,call=(name,...args)=>()=>actions[name]?.(...args);
  const button=(label,fn,cls='cc98-action')=>H.button(label,fn,cls);
  const forum=String(H.forum||'https://www.cc98.org/').replace(/\/?$/,'/');
  const link=(label,path)=>H.link(label,forum+path,'cc98-action');
  const tab=['profile','messages','signin'].includes(state.tab)?state.tab:'profile';
  const shell=el('section',null,'cc98-personal');
  shell.setAttribute('aria-label','CC98 个人内容');
  const tabs=el('div',null,'cc98-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','个人内容分类');
  for(const [key,label] of [['profile','概览'],['messages','消息'],['signin','签到']]){
   const b=button(label,call('tab',key),'cc98-tab'+(tab===key?' is-active':''));
   b.setAttribute('aria-pressed',String(tab===key));tabs.append(b);
  }
  const refresh=button('',call('refresh'),'cc98-action cc98-refresh');refresh.disabled=Boolean(state.loading);refresh.setAttribute('aria-label','刷新个人内容');refresh.title='刷新个人内容';refresh.append(H.icon('refresh'));
  const primary=tab==='profile'?state.profileEntry||state.entry:tab==='signin'?state.signinEntry:state.entry;
  const updatedAt=tab==='signin'?Math.max(primary?.updatedAt||0,state.monthEntry?.updatedAt||0):primary?.updatedAt;
  const updateRow=el('div',null,'cc98-update-row');updateRow.append(el('span',updatedAt?'更新于 '+H.time(updatedAt):state.loading?'正在加载…':'尚未更新','cc98-status'),refresh);
  shell.append(tabs,updateRow);
  function status(parent,entry,loading=state.loading){
   if(loading){const n=el('p','正在加载…','cc98-status');n.setAttribute('role','status');parent.append(n);}
   if(entry?.status==='error'){
    const code=String(entry.code||'').toLowerCase();
    const message=/auth|interaction|login/.test(code)?'登录或授权已失效，请重新连接后重试。':code==='cache_released'?'此处缓存已释放，请重新获取。':'加载失败，请重试。';
    const n=el('div',null,'cc98-status');n.setAttribute('role','status');n.append(el('p',message),button('重试',call('retry')));parent.append(n);
   }else if(!entry?.data&&!loading){parent.append(el('p','尚未获取此处内容。','cc98-status'),button('获取内容',call('retry')));}
   if(entry?.data&&entry.stale)parent.append(el('p','当前显示上次保留的内容。','cc98-status'));
  }
  function metric(parent,label,v){const n=el('div',null,'cc98-metric');n.append(el('span',label),el('strong',value(v)));parent.append(n);}
  function avatar(profile,parent){
   const old=container.querySelector?.('.cc98-avatar');
   const revision=state.profileEntry?.updatedAt;
   if(old&&old._portraitSource===String(profile.portraitUrl||'')&&old._portraitOwner===String(profile.id||'')&&(!old._portraitFailed||old._portraitRevision===revision)){parent.append(old);return;}
   const box=el('div',null,'cc98-avatar');box.setAttribute('aria-label','本人头像');
   box._portraitSource=String(profile.portraitUrl||'');box._portraitOwner=String(profile.id||'');
   box._portraitRevision=revision;
   const fallback=(state='unavailable')=>{box._portraitFailed=state==='error';const symbol=H.icon('user');box.replaceChildren(symbol);box.setAttribute('data-avatar-state',state);};fallback();
   const source=root.HomeCC98UICore.avatarURL(profile.portraitUrl);
   if(source){
    const image=el('img');image.alt=(profile.name||'本人')+'的头像';image.loading='eager';image.hidden=true;image.referrerPolicy='no-referrer';
    image.addEventListener('load',()=>{if(image.naturalWidth>0){image.hidden=false;box.replaceChildren(image);box.setAttribute('data-avatar-state','ready');}else fallback('error');},{once:true});
    image.addEventListener('error',()=>fallback('error'),{once:true});box.setAttribute('data-avatar-state','loading');box.append(image);image.src=source;
   }
   parent.append(box);
  }
  function profile(){
   const entry=state.profileEntry||state.entry;status(shell,entry);const p=entry?.data?.profile;if(!p)return;
   const area=el('div',null,'cc98-profile');avatar(p,area);area.append(el('h3',p.name||'未知用户'));
   const signature=el('p',p.signature||'暂无个性签名','cc98-signature');area.append(signature);
   const metrics=el('div',null,'cc98-metrics');
   for(const [key,label] of [['wealth','财富值'],['prestige','威望'],['fanCount','粉丝'],['popularity','风评'],['postCount','发帖数'],['receivedLikeCount','收到的赞']])metric(metrics,label,p[key]);
   area.append(metrics,link('前往个人中心','usercenter'));shell.append(area);
  }
  function pagination(entry){
   const n=el('div',null,'cc98-pagination');
   if(state.canPrevious){const b=button('上一批',call('previous'));b.disabled=Boolean(state.loading);n.append(b);}
   if(entry?.data?.hasMore){const b=button('加载更多',call('more'));b.disabled=Boolean(state.loading);n.append(b);}
   if(entry?.data?.items?.length&&entry.data.hasMore===false)n.append(el('span','已到本批内容末尾。','cc98-status'));
   shell.append(n);
  }
  function messages(){
   const category=['replies','mentions','system','contacts'].includes(state.category)?state.category:'replies';
   const categories=el('div',null,'cc98-tabs');categories.setAttribute('aria-label','消息分类');
   for(const [key,label] of [['replies','回复我的'],['mentions','@ 我的'],['system','系统通知'],['contacts','私信']]){const b=button(label,call('category',key),'cc98-tab'+(category===key?' is-active':''));b.setAttribute('aria-pressed',String(category===key));categories.append(b);}
   shell.append(categories);
   const conversation=category==='contacts'&&state.peer;
   if(conversation)shell.append(button('返回联系人',call('back')),el('h3','与 '+(state.peer.name||'该用户')+' 的会话'));
   const paths={replies:'message/response',mentions:'message/attme',system:'message/system',contacts:'message/message'};
   shell.append(link('前往原站消息',paths[category]));status(shell,state.entry);
   const data=state.entry?.data;if(!data)return;
   const list=el('div',null,conversation?'cc98-conversation':'cc98-messages');const items=Array.isArray(data.items)?data.items:[];
   if(!items.length)list.append(el('p',conversation?'此批暂无会话消息。':category==='contacts'?'暂无最近联系人。':'暂无此类消息。','cc98-empty'));
   for(const item of items){
    const row=el('article',null,'cc98-message');
    if(conversation){row.append(el('span','发送者 ID '+value(item.senderId)),el('time',H.time(item.time)),el('p',item.content||''));}
    else if(category==='contacts'){
     row.append(button(item.name||item.nickname||'未知联系人',call('peer',{id:String(item.userId),name:item.name||item.nickname||'未知联系人'})),el('time',H.time(item.time)),el('p',item.lastContent||''));
    }else{
     const title=item.title||(category==='system'?'系统通知':'帖子 '+value(item.topicId));
     row.append(item.url?H.link(title,item.url,'cc98-message-title'):el('strong',title),el('time',H.time(item.time)));
     if(category==='system')row.append(el('p',item.content||''));
     else row.append(el('span',(item.userName||'未知用户')+(item.floor===null||item.floor===undefined?'':' · '+item.floor+' 楼')));
    }
    list.append(row);
   }
   shell.append(list);pagination(state.entry);
  }
  function signin(){
   const entry=state.signinEntry||state.entry;status(shell,entry);const data=entry?.data;
   if(data){
    shell.append(el('p',data.hasSignedInToday===true?'今日已签到':data.hasSignedInToday===false?'今日未签到':'今日签到状态未知','cc98-status'));
    const metrics=el('div',null,'cc98-metrics');metric(metrics,'连续签到',data.lastSignInCount===null||data.lastSignInCount===undefined?null:value(data.lastSignInCount)+' 天');metric(metrics,'上次签到',data.lastSignInTime?H.time(data.lastSignInTime):null);metric(metrics,'上次奖励',data.lastReward);metric(metrics,'剩余补签卡',state.profileEntry?.data?.profile?.signInCardCount);shell.append(metrics);
   }
   shell.append(link('前往原站签到','signin'));
   const now=new Date();const beijing=new Date(now.getTime()+8*3600000);const today={year:beijing.getUTCFullYear(),month:beijing.getUTCMonth()+1,day:beijing.getUTCDate()};
   const year=Number.isInteger(state.year)&&state.year>=2000&&state.year<=2100?state.year:Math.max(2000,Math.min(2100,today.year));
   const month=Number.isInteger(state.month)&&state.month>=1&&state.month<=12?state.month:today.month;
   const header=el('div',null,'cc98-month-head');const previous=button('上个月',call('month',-1)),next=button('下个月',call('month',1));
   previous.disabled=year===2000&&month===1;next.disabled=year===2100&&month===12;
   const label=el('label','选择月份');const input=el('input');input.type='month';input.value=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0');input.min='2000-01';input.max='2100-12';input.setAttribute('aria-label','选择签到月份');
   input.addEventListener('change',()=>{const m=/^(\d{4})-(\d{2})$/.exec(input.value);if(m&&+m[1]>=2000&&+m[1]<=2100&&+m[2]>=1&&+m[2]<=12)actions.selectMonth?.(+m[1],+m[2]);});label.append(input);header.append(previous,label,next);shell.append(header);
   const monthEntry=state.monthEntry;status(shell,monthEntry);const records=monthEntry?.data;
   if(!records||records.year!==year||records.month!==month)return;
   const utc=(y,m,d)=>{const date=new Date(0);date.setUTCFullYear(y,m,d);return date;};
   const first=(utc(year,month-1,1).getUTCDay()+6)%7,days=utc(year,month,0).getUTCDate();
   const signed=new Map((Array.isArray(records.items)?records.items:[]).filter(x=>x.year===year&&x.month===month).map(x=>[x.day,x]));
   const grid=el('div',null,'cc98-month-grid');grid.setAttribute('aria-label',year+'年'+month+'月签到日历');
   for(const day of ['一','二','三','四','五','六','日'])grid.append(el('span',day,'cc98-day'));
   for(let i=0;i<first;i++){const blank=el('span',null,'cc98-day');blank.setAttribute('aria-hidden','true');grid.append(blank);}
   for(let day=1;day<=days;day++){
    const record=signed.get(day),isToday=year===today.year&&month===today.month&&day===today.day;
    const future=year>today.year||(year===today.year&&(month>today.month||(month===today.month&&day>today.day)));
    const statusText=record?(record.useCard?'补签':'已签'):future?'未来':'未签';
    const cell=el('div',null,'cc98-day'+(isToday?' is-today':'')+(record?' is-signed':'')+(record?.useCard?' is-makeup':'')+(future?' is-future':''));
    cell.append(el('span',String(day)),el('small',(isToday?'今天 · ':'')+statusText));
    if(record&&record.reward!==null&&record.reward!==undefined)cell.append(el('small','奖励 '+record.reward));
    cell.setAttribute('aria-label',month+'月'+day+'日 '+(isToday?'今天 ':'')+statusText+(record?.reward===null||record?.reward===undefined?'':' 奖励 '+record.reward));if(isToday)cell.setAttribute('aria-current','date');grid.append(cell);
   }
   shell.append(grid);
  }
  if(tab==='messages')messages();else if(tab==='signin')signin();else profile();
  container.replaceChildren(shell);
 }
 const api={render};root.HomeCC98Personal=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
