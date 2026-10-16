(function(root){
 async function encryptPassword(password){
  if(typeof password!=='string'||!password||/[^\x20-\x7e]/.test(password))throw Error('PASSWORD_ENCODING_NOT_VERIFIED');
  const encoder=new TextEncoder(),iv=encoder.encode('wrdvpnisawesome!');
  const key=await crypto.subtle.importKey('raw',iv,'AES-CBC',false,['encrypt']);
  const padded=encoder.encode(password+'0'.repeat((16-password.length%16)%16));const out=new Uint8Array(padded.length);let feedback=iv;
  for(let i=0;i<padded.length;i+=16){const block=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv:new Uint8Array(16)},key,feedback)).slice(0,16);for(let j=0;j<16;j++)out[i+j]=padded[i+j]^block[j];feedback=out.slice(i,i+16);}
  const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return hex(iv)+hex(out).slice(0,password.length*2);
 }
 if(typeof module==='object')module.exports={encryptPassword};else root.VpnAuthCrypto={encryptPassword};
})(globalThis);
