const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('CC98 composites use original foreground references without panel backplates',()=>{
 const context=vm.createContext({chrome:{runtime:{getURL:p=>p}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../ui/icons.js'),'utf8'),context);
 for(const [key,badge] of [['cc98','reference-cc98-unread.png'],['cc98Top','reference-cc98-hot.png']]){
  const svg=context.HomeIcons.svg(key);assert(svg.includes('cc98.ico'));assert(svg.includes(badge));
  assert(!svg.includes('var(--theme-panel)'));assert(svg.includes('feComposite'));assert(svg.includes('currentColor'));
 }
});
