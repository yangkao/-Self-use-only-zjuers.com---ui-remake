const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../media-playback.js');
test('hidden videos pause; visible videos retain position and resume',async()=>{
 let visible=true,now=0,plays=0,reloads=0;const video={currentTime:12,paused:false,ended:false,readyState:4,duration:100,addEventListener(){},pause(){this.paused=true;},async play(){plays++;this.paused=false;},load(){reloads++;},getVideoPlaybackQuality(){return {totalVideoFrames:1};}};
 const c=create(video,{visible:()=>visible,now:()=>now,play:()=>video.play()});
 visible=false;await c.sync();assert.equal(video.paused,true);assert.equal(video.currentTime,12);
 visible=true;await c.sync();assert.equal(plays,1);assert.equal(video.currentTime,12);
 now=6000;await c.check();assert.equal(reloads,0);now=12000;await c.check();assert.equal(reloads,1);
 visible=false;now=18000;await c.check();assert.equal(reloads,1);c.dispose();
});
test('a pending play promise cannot block subsequent recovery forever',async()=>{
 let now=0,failures=0,reloads=0;const video={currentTime:3,pause(){},addEventListener(){},load(){reloads++;}};
 const c=create(video,{visible:()=>true,now:()=>now,play:()=>new Promise(()=>{}),playTimeout:5,onFailure:()=>failures++});
 now=6000;await c.check();assert.equal(failures,1);now=12000;await c.check();assert.equal(reloads,1);c.dispose();
});
