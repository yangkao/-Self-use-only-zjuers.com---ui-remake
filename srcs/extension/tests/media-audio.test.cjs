const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('custom video uses saved audio before loading; denial stays distinct and real retry restores sound',async()=>{
 const sent=[],events={},nodes=[],plays=[];let allowed=false;
 const parent={postMessage:m=>sent.push(m)},host={querySelectorAll:()=>nodes,replaceChildren(){nodes.length=0;},append:n=>nodes.push(n)};
 const node=()=>{const listeners={};return {tagName:'VIDEO',style:{},muted:true,pause(){},load(){},removeAttribute(){},addEventListener(k,fn){listeners[k]=fn;},removeEventListener(k){delete listeners[k];},set src(value){this.source=value;assert.equal(this.muted,false,'preference must be set before src');assert.equal(this.autoplay,false);queueMicrotask(()=>listeners.loadeddata?.());},play:async function(){plays.push(this.muted);if(!this.muted&&!allowed)throw Object.assign(Error('policy'),{name:'NotAllowedError'});}};};
 const ctx=vm.createContext({HomeMediaPlayback:require('../media-playback.js'),performance,parent,URL:{revokeObjectURL(){}},setTimeout,clearTimeout,setInterval,clearInterval,Promise,Number,Error,queueMicrotask,
  document:{getElementById:()=>host,createElement:()=>node(),addEventListener(){},hidden:false},window:{addEventListener:(k,f)=>events[k]=f},
  chrome:{storage:{local:{get:async()=>({update1Themes:{themes:[{id:'custom',wallpaper:{type:'video',path:'D:/video.mp4'}}]}})},session:{get:async()=>({})}}},HomeFileHandles:{url:async()=> 'file:///D:/video.mp4'}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../media.js'),'utf8'),ctx);
 const token='a'.repeat(32),send=data=>events.message({source:parent,origin:'https://zjuers.com',data:{token,requestId:1,...data}});
 send({type:'WALLPAPER_LOAD',themeId:'custom',analyze:false,muted:false});await new Promise(setImmediate);
 assert.deepEqual(plays,[false,true]);assert(sent.some(m=>m.status==='audio'&&m.blocked));assert(sent.some(m=>m.status==='ready'));
 allowed=true;send({type:'WALLPAPER_AUDIO',muted:false});await new Promise(setImmediate);
 assert.equal(nodes[0].muted,false);assert.equal(sent.at(-1).blocked,false);
 send({type:'WALLPAPER_AUDIO',muted:true});await new Promise(setImmediate);assert.equal(nodes[0].muted,true);
 events.pagehide();
});
