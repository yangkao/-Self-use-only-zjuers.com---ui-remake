(function(scope){
 'use strict';
 function create(video,{visible=()=>!document.hidden,now=()=>performance.now(),play=()=>video.play(),onFailure=()=>{},playTimeout=4000}={}){
  let disposed=false,busy=false,lastTime=video.currentTime,lastFrames=0,lastProgress=now(),attempt=0,reloads=0;
  const reset=()=>{lastTime=video.currentTime;lastFrames=video.getVideoPlaybackQuality?.().totalVideoFrames||0;lastProgress=now();};
  async function attemptPlay(){let timer;try{await Promise.race([play(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('play-timeout')),playTimeout);})]);}finally{clearTimeout(timer);if(!visible())video.pause();}}
  async function sync(){if(disposed)return;if(!visible()){video.pause();reset();return;}attempt=0;reloads=0;try{await attemptPlay();reset();}catch(e){onFailure(e);}}
  async function check(){
   if(disposed||busy)return;if(!visible()){video.pause();reset();return;}
   const frames=video.getVideoPlaybackQuality?.().totalVideoFrames||0;
   if(video.currentTime!==lastTime||frames!==lastFrames){reset();attempt=0;reloads=0;return;}
   if(now()-lastProgress<5000)return;
   busy=true;lastProgress=now();try{
    if(attempt++===0){video.pause();await attemptPlay();}
    else if(reloads++<1){const position=video.currentTime;video.addEventListener('loadedmetadata',()=>{if(disposed)return;try{video.currentTime=Math.min(position,Math.max(0,video.duration-.05));}catch{}if(visible())void attemptPlay().catch(onFailure);},{once:true});video.load();}
    else {onFailure(new Error('video-stalled'));lastProgress=Infinity;}
   }catch(e){onFailure(e);}finally{busy=false;}
  }
  reset();return {sync,check,dispose(){disposed=true;video.pause();}};
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;scope.HomeMediaPlayback=api;
})(globalThis);
