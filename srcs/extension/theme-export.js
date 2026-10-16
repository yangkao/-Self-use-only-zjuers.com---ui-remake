(function(root){
 'use strict';
 function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
 function zip(files){const encoder=new TextEncoder(),locals=[],centrals=[];let offset=0;
  for(const [name,text]of Object.entries(files)){const filename=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);const local=new Uint8Array(30+filename.length+data.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,filename.length,true);local.set(filename,30);local.set(data,30+filename.length);locals.push(local);
   const central=new Uint8Array(46+filename.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);central.set(filename,46);centrals.push(central);offset+=local.length;
  }
  const centralSize=centrals.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,centrals.length,true);v.setUint16(10,centrals.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);const out=new Uint8Array(offset+centralSize+22);let at=0;for(const part of [...locals,...centrals,end]){out.set(part,at);at+=part.length;}return out;
 }
 function filename(name){let stem=String(name||'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim().replace(/[. ]+$/g,'').slice(0,100).replace(/[. ]+$/g,'')||'Edge \u4e3b\u9898';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem))stem='_'+stem;return stem+'.zip';}
 const api={zip,crc32,filename};root.HomeThemeExport=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
