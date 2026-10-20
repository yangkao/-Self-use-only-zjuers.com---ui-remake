/* Read-only CC98 query policy and bounded, instance-local memory. No storage API. */
(function (root) {
  'use strict';
  const kinds = new Set(['top','new','boards','board','profile','unread','contacts','conversation','replies','mentions','system','signin','month']);
  const paged = new Set(['top','new','board','contacts','conversation','replies','mentions','system']);
  function integer(value, fallback, min, max) {
    if (value === undefined) return fallback;
    if (!['number','string'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)<min || Number(value)>max) throw new TypeError('Invalid CC98 query number');
    return Number(value);
  }
  function normalizeQuery(input) {
    if (!input || typeof input !== 'object' || !kinds.has(input.kind)) throw new TypeError('Unknown CC98 query');
    const allowed = new Set(['kind']);
    if (input.kind==='board') allowed.add('boardId');
    if (input.kind==='conversation') allowed.add('peerId');
    if (paged.has(input.kind)) { allowed.add('from'); allowed.add('size'); }
    if (input.kind==='month') { allowed.add('year'); allowed.add('month'); }
    for (const key of Object.keys(input)) if (!allowed.has(key)) throw new TypeError('Unexpected CC98 query field');
    const q={kind:input.kind};
    for (const key of ['boardId','peerId']) if (allowed.has(key)) {
      if (input[key]===undefined) throw new TypeError('Missing CC98 identifier');
      q[key]=String(integer(input[key],null,1,Number.MAX_SAFE_INTEGER));
    }
    if (paged.has(q.kind)) {
      q.from=integer(input.from,0,0,10000);
      q.size=Math.min(20,integer(input.size,20,1,Number.MAX_SAFE_INTEGER));
      q.size=Math.max(0,Math.min(q.size,(q.kind==='new'?500:10000)-q.from));
    }
    if (q.kind==='month') {
      if (input.year===undefined || input.month===undefined) throw new TypeError('Missing CC98 month');
      q.year=integer(input.year,null,2000,2100); q.month=integer(input.month,null,1,12);
    }
    return q;
  }
  // Re-normalization accepts the internally capped zero size only at a blocked offset.
  function normalized(input) {
    if (input && input.size===0 && ((input.kind==='new' && input.from>=500) || input.from===10000)) {
      const q=normalizeQuery({...input,size:1}); return {...q,size:0};
    }
    return normalizeQuery(input);
  }
  function requestKey(input) { return JSON.stringify(normalized(input)); }
  function paging(input,rawCount=0) {
    const q=normalized(input), from=q.from||0, size=q.size===undefined?20:q.size;
    const limit=q.kind==='new'?500:10000;
    const count=integer(rawCount,0,0,Number.MAX_SAFE_INTEGER);
    const nextFrom=Math.min(limit,from+Math.min(size,count));
    return {from,size,nextFrom,hasMore:size>0 && count>=size && nextFrom<limit,limitReached:nextFrom>=limit,blocked:from>=limit};
  }
  const copy = value => value===undefined ? undefined : JSON.parse(JSON.stringify(value));
  const abortError = () => Object.assign(new Error('CC98 request cancelled'),{name:'AbortError',code:'ABORTED'});
  const entry = (data=null,updatedAt=null,code=null) => ({status:code?'error':'ready',data,updatedAt,stale:!!code,error:code?'CC98 data unavailable':null,code,newItemsDetected:false});
  const errorCodes = Object.freeze({
    'auth-required':'AUTH_REQUIRED','auth-expired':'AUTH_EXPIRED',configuration:'CONFIGURATION_REQUIRED',
    forbidden:'FORBIDDEN','not-found':'NOT_FOUND','rate-limit':'RATE_LIMIT',format:'INVALID_RESPONSE',
    'interaction-required':'INTERACTION_REQUIRED',interaction:'INTERACTION_REQUIRED',cancelled:'CANCELLED',
    unavailable:'UNAVAILABLE',timeout:'TIMEOUT',network:'NETWORK_ERROR',
    AUTH_REQUIRED:'AUTH_REQUIRED',AUTH_EXPIRED:'AUTH_EXPIRED',CONFIGURATION_REQUIRED:'CONFIGURATION_REQUIRED',
    FORBIDDEN:'FORBIDDEN',NOT_FOUND:'NOT_FOUND',RATE_LIMIT:'RATE_LIMIT',INVALID_RESPONSE:'INVALID_RESPONSE',
    INTERACTION_REQUIRED:'INTERACTION_REQUIRED',CANCELLED:'CANCELLED',UNAVAILABLE:'UNAVAILABLE',TIMEOUT:'TIMEOUT',NETWORK_ERROR:'NETWORK_ERROR'
  });
  const targetKey = q => JSON.stringify([q.kind,q.boardId||null,q.peerId||null,q.year||null,q.month||null]);
  function createDataLayer(options={}) {
    if (typeof options.read!=='function') throw new TypeError('CC98 read is required');
    const now=options.now||Date.now, instances=new Map();
    const defaults={maxTargets:8,maxPages:10,maxItems:200,maxBytes:262144,maxConversations:4,maxInstances:8,maxAnchors:512,maxInflight:8};
    const limits={};
    for (const [key,value] of Object.entries(defaults)) limits[key]=integer(options[key],value,1,value);
    let sequence=0;
    function release(id) {
      const state=instances.get(id); if (!state) return;
      state.closed=true; instances.delete(id);
      for (const task of [...state.inflight.values()]) cancel(task);
      state.pages.clear(); state.anchors.clear();
    }
    function stateFor(id) {
      if (typeof id!=='string' || !id || id.length>128) throw new TypeError('Invalid CC98 instance');
      const time=now();
      for (const [key,state] of instances) if (key!==id && !state.inflight.size && time-state.lastUsed>1800000) release(key);
      let state=instances.get(id);
      if (!state) {
        while(instances.size>=limits.maxInstances) release(instances.keys().next().value);
        state={pages:new Map(),anchors:new Map(),inflight:new Map(),lastUsed:time,closed:false,newProgress:{round:0,nextFrom:0,latestId:null,limitReached:false}};
      }
      state.lastUsed=time; instances.delete(id); instances.set(id,state); return state;
    }
    function counts(state) {
      const targets=new Set(),conversations=new Set(); let items=0,bytes=0;
      for (const page of state.pages.values()) { targets.add(page.target); if(page.kind==='conversation') conversations.add(page.target); items+=page.items; bytes+=page.bytes; }
      return {targets:targets.size,conversations:conversations.size,pages:state.pages.size,items,bytes};
    }
    function trim(state) {
      while(state.pages.size) {
        const c=counts(state);
        if(c.targets<=limits.maxTargets && c.conversations<=limits.maxConversations && c.pages<=limits.maxPages && c.items<=limits.maxItems && c.bytes<=limits.maxBytes) break;
        state.pages.delete(state.pages.keys().next().value);
      }
    }
    function touch(state,key) {
      const page=state.pages.get(key);
      if(page) { state.pages.delete(key); state.pages.set(key,page); return copy(page.entry); }
      const anchor=state.anchors.get(key);
      return {...entry(null,anchor?.updatedAt??null,'CACHE_RELEASED'),paging:copy(anchor?.paging)};
    }
    function cancel(task) {
      if(task.done) return;
      task.done=true; task.controller.abort();
      if(task.state.inflight.get(task.key)===task) task.state.inflight.delete(task.key);
      for(const sub of [...task.subscribers]) sub.finish(false,abortError());
    }
    function subscribe(task,signal) {
      return new Promise((resolve,reject)=>{
        const sub={finish(ok,value) { if(!task.subscribers.delete(sub)) return; signal?.removeEventListener('abort',onAbort); ok?resolve(copy(value)):reject(value); }};
        const onAbort=()=>{sub.finish(false,abortError()); if(!task.subscribers.size) cancel(task);};
        task.subscribers.add(sub); signal?.addEventListener('abort',onAbort,{once:true});
        if(signal?.aborted) onAbort();
      });
    }
    function finish(task,ok,value) {
      if(task.done || task.state.closed) return;
      task.done=true; const state=task.state;
      state.inflight.delete(task.key);
      let result;
      if(ok) {
        try {
          const data=copy(value), q=task.q;
          if(!data || data.kind!==q.kind) throw new TypeError('Invalid normalized CC98 response');
          let p=null;
          if(Array.isArray(data.items) && paged.has(q.kind) && q.from!==undefined && q.size!==undefined) {
            const rawCount=integer(data.rawCount,data.items.length,0,Number.MAX_SAFE_INTEGER);
            p=paging(q,rawCount);
            const seen=new Set();
            for(const [key,page] of state.pages) if(key!==task.key && page.target===task.target && !(q.kind==='new' && q.from===0 && task.force)) for(const item of page.entry.data?.items||[]) if(item.id!=null) seen.add(String(item.id));
            data.items=data.items.filter(item=>{if(item.id==null) return true; const id=String(item.id); if(seen.has(id)) return false; seen.add(id); return true;});
            Object.assign(data,p,{rawCount});
          }
          result=entry(data,now());
          if(q.kind==='new') {
            const progress=state.newProgress;
            const latest=value.items?.[0]?.id;
            if(q.from===0 && task.force) {
              result.newItemsDetected=progress.latestId!=null && latest!=null && Number.isSafeInteger(Number(latest)) && Number(latest)>Number(progress.latestId);
              progress.round++; progress.nextFrom=0; progress.limitReached=false;
              // A manual refresh starts a new offset round; release old pages and anchors.
              for(const [key,a] of state.anchors) if(a.kind==='new' && key!==task.key) {state.anchors.delete(key);state.pages.delete(key);}
            }
            if(q.from===0 && latest!=null) progress.latestId=String(latest);
            if(p) {progress.nextFrom=Math.max(progress.nextFrom,p.nextFrom);progress.limitReached=progress.nextFrom>=500;}
          }
          const bytes=new TextEncoder().encode(JSON.stringify(result)).length;
          state.pages.delete(task.key); state.pages.set(task.key,{entry:result,kind:q.kind,target:task.target,items:data.items?.length||0,bytes});
          state.anchors.set(task.key,{kind:q.kind,updatedAt:result.updatedAt,paging:p}); trim(state);
        } catch (_) { ok=false; value={code:'INVALID_RESPONSE'}; }
      }
      if(!ok) {
        const old=state.pages.get(task.key)?.entry;
        const known=Object.hasOwn(errorCodes,value?.code), code=known?errorCodes[value.code]:value?.name==='TypeError'?'NETWORK_ERROR':'READ_FAILED';
        result=entry(old?.data||null,old?.updatedAt??null,code);
        // Only provider-marked public guidance from recognized error categories crosses this boundary.
        if(known && typeof value.publicMessage==='string') result.error=value.publicMessage.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,300).trim()||result.error;
        if(old) {
          const page=state.pages.get(task.key); page.entry=result;
          page.bytes=new TextEncoder().encode(JSON.stringify(result)).length; trim(state);
        }
        state.anchors.set(task.key,{kind:task.q.kind,updatedAt:result.updatedAt,code:result.code,error:result.error});
      }
      for(const sub of [...task.subscribers]) sub.finish(true,result);
    }
    function query(id,spec,{force=false,signal}={}) {
      try {
        if(signal?.aborted) return Promise.reject(abortError());
        const q=normalizeQuery(spec), key=requestKey(q), state=stateFor(id);
        if(paged.has(q.kind) && q.size===0) return Promise.resolve({...entry({kind:q.kind,items:[],rawCount:0,...paging(q,0)},null,'LIMIT_REACHED')});
        const active=state.inflight.get(key); if(active) return subscribe(active,signal);
        if(!force && state.anchors.has(key)) {
          if(state.pages.has(key)) return Promise.resolve(touch(state,key));
          const anchor=state.anchors.get(key);
          return Promise.resolve(anchor.code?{...entry(null,anchor.updatedAt,anchor.code),error:anchor.error}:touch(state,key));
        }
        if(state.inflight.size>=limits.maxInflight || (!state.anchors.has(key) && state.anchors.size+state.inflight.size>=limits.maxAnchors)) return Promise.resolve(entry(null,null,'CAPACITY_REACHED'));
        if(force && q.kind==='new' && q.from===0) for(const task of [...state.inflight.values()]) if(task.q.kind==='new') cancel(task);
        const task={id:++sequence,state,q,key,target:targetKey(q),force,controller:new AbortController(),subscribers:new Set(),done:false};
        state.inflight.set(key,task);
        const promise=subscribe(task,signal);
        Promise.resolve().then(()=>{if(task.done) throw abortError(); return options.read(copy(q),{signal:task.controller.signal});}).then(value=>finish(task,true,value),error=>finish(task,false,error));
        return promise;
      } catch(error) {return Promise.reject(error);}
    }
    function stats(id) {
      if(id===undefined) return {instances:instances.size,limits:{...limits}};
      const state=instances.get(id);
      return state?{...counts(state),anchors:state.anchors.size,inflight:state.inflight.size,newProgress:{...state.newProgress}}:{targets:0,conversations:0,pages:0,items:0,bytes:0,anchors:0,inflight:0,newProgress:null};
    }
    return {query,release,clear(){for(const id of [...instances.keys()]) release(id);},stats};
  }
  const api={normalizeQuery,requestKey,paging,createDataLayer};
  if(typeof module==='object' && module.exports) module.exports=api;
  root.CC98Core=api;
})(typeof globalThis==='object'?globalThis:this);
