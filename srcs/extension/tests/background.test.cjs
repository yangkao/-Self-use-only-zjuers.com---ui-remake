const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
test('browser create event during fallback cannot redirect the replacement tab', async () => {
  const calls=[];const state={};const records=new Map();
  const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn)},emit(...args){this.listeners.forEach(fn=>fn(...args))}});
  const tabs={onCreated:event(),onUpdated:event(),onRemoved:event(),
    get:async id=>({...records.get(id)}),
    update:async(id,options)=>{calls.push(['update',id,options.url]);records.get(id).url=options.url;},
    create:async options=>{calls.push(['create',options]);const tab={id:9,url:'edge://newtab/',windowId:2,index:3,active:true,pinned:false,groupId:-1};records.set(9,tab);tabs.onCreated.emit(tab);return tab;},
    remove:async id=>{calls.push(['remove',id]);records.delete(id);tabs.onRemoved.emit(id);},group:async()=>{}
  };
  const chrome={tabs,storage:{local:{setAccessLevel:async()=>{},get:async()=>({})},session:{setAccessLevel:async()=>{},get:async()=>structuredClone(state),set:async value=>Object.assign(state,structuredClone(value))}},webNavigation:{onCompleted:event(),onErrorOccurred:event()},action:{onClicked:event()},runtime:{onMessage:event(),onMessageExternal:event(),onInstalled:event()}};
  chrome.alarms={onAlarm:event()};chrome.runtime.onStartup=event();
  const context=vm.createContext({chrome,console,URL,Set,Promise});
  const base=path.join(__dirname,'..');
  context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context));
  vm.runInContext(fs.readFileSync(path.join(base,'background.js'),'utf8'),context);
  const drain=async()=>{for(let i=0;i<5;i++)await vm.runInContext('queue',context);};
  records.set(7,{id:7,url:'edge://newtab/',windowId:2,index:3,active:true,pinned:false,groupId:-1});
  tabs.onCreated.emit(records.get(7));await drain();
  chrome.webNavigation.onErrorOccurred.emit({tabId:7,frameId:0,url:'https://zjuers.com/',error:'net::ERR_CONNECTION_CLOSED'});await drain();
  assert.equal(calls.filter(c=>c[0]==='update').length,1);
  assert.equal(calls.find(c=>c[0]==='update')[1],7);
  assert.equal('url' in calls.find(c=>c[0]==='create')[1],false);
  assert.equal(state.entries[9].phase,'native-return');
  assert.equal(records.has(7),false);assert.equal(records.get(9).url,'edge://newtab/');
  chrome.webNavigation.onErrorOccurred.emit({tabId:7,frameId:0,url:'https://zjuers.com/',error:'net::ERR_CONNECTION_CLOSED'});await drain();
  assert.equal(calls.filter(c=>c[0]==='create').length,1);
});
