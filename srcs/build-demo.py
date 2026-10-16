"""Build a static interactive web demo without dependencies or extension credentials."""
from pathlib import Path
import hashlib, json, shutil, subprocess, zipfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'srcs/extension'
DEMO=ROOT/'srcs/demo'
TARGET=ROOT/'bin/demo'
subprocess.run(['node','--test',str(ROOT/'tests/demo.test.cjs')],check=True,cwd=ROOT)
if TARGET.exists():
    if not (TARGET/'.demo-generated').exists() or not TARGET.resolve().is_relative_to((ROOT/'bin').resolve()):
        raise SystemExit('Refusing to replace an unrecognized demo directory')
    shutil.rmtree(TARGET)
TARGET.mkdir(parents=True)
(TARGET/'.demo-generated').write_text('Generated from srcs/demo and srcs/extension.\n',encoding='utf-8')
for p in DEMO.rglob('*'):
    if p.is_file() and p.suffix not in ('.cjs','.py'):
        dest=TARGET/p.relative_to(DEMO);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
shared=['core.js','theme-core.js','external-core.js','navigation-core.js','widget-core.js','theme-export.js','sources.html','account.css','wallpaper-editor.css']
for p in list((SOURCE/'ui').rglob('*'))+list((SOURCE/'assets').rglob('*'))+list((SOURCE/'licenses').rglob('*'))+[SOURCE/n for n in shared]+[SOURCE/'LICENSE',SOURCE/'THIRD_PARTY_NOTICES.md']:
    if not p.is_file() or p.suffix=='.mp4':continue
    rel=p.relative_to(SOURCE);dest=TARGET/'app'/rel;dest.parent.mkdir(parents=True,exist_ok=True)
    # Build-time web adaptation only. The formal extension sources are unchanged.
    if p.suffix=='.js' and (rel.parts[0]=='ui' or rel.as_posix()=='widget-core.js'):
        text=p.read_text(encoding='utf-8').replace('Date.now()','HomeDemo.now()').replace('new Date()','new Date(HomeDemo.now())')
        if rel.as_posix()=='ui/widgets.js':
            text=text.replace("url.replace(/\\/$/,'')+'/message'",'url')
        dest.write_text(text,encoding='utf-8')
    elif p.name=='sources.html':
        dest.write_text(p.read_text(encoding='utf-8').replace('href="account.html"','href="../frames/account.html"'),encoding='utf-8')
    else:shutil.copyfile(p,dest)
navigation=json.loads((SOURCE/'tests/navigation-fixture.json').read_text(encoding='utf-8'))
from urllib.parse import urljoin
for links in navigation.values():
    for item in links:item['href']=urljoin('https://zjuers.com/',item['href'])
(TARGET/'navigation.json').write_text(json.dumps(navigation,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
head='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="../app/ui/controls.css"><link rel="stylesheet" href="../app/account.css"><style>html,body{background:transparent}body{margin:0;padding:4px}main{padding:4px;max-width:none;margin:0}input:disabled{opacity:.6}p{line-height:1.8}</style></head>'
frames={
 'account':'<main><h2 id="title"></h2><p>在线演示 · 以下项目只展示结构，不收集真实凭据。</p><div id="fields" class="field-grid single"></div><p id="summary"></p><button disabled>请安装正式扩展后配置</button></main>',
 'data':'<main><h2>演示本地数据</h2><p>此页只保存演示网站的导航、主题与组件设置，不访问扩展存储。正式配置导入导出请在安装版中使用。</p><button id="reset">恢复演示默认设置</button></main>',
 'thumbnail':'',
 'editor':'<link rel="stylesheet" href="../app/wallpaper-editor.css"><div id="preview" tabindex="0" aria-label="拖入图片或视频，拖动调整位置"></div><div class="editor-controls"><p id="fileName"></p><div class="actions"><div class="file-actions"><button id="choose">选择临时壁纸</button><button id="builtin">使用演示壁纸</button></div><button id="palette">生成配色组</button></div><input id="file" type="file" accept="image/*,video/*" hidden><output id="status" aria-live="polite"></output></div>'
}
(TARGET/'frames').mkdir()
for kind,body in frames.items():
    (TARGET/'frames'/(kind+'.html')).write_text(head+f'<body data-frame="{kind}">'+body+'<script src="../frame.js"></script></body></html>',encoding='utf-8')
(TARGET/'.nojekyll').write_text('',encoding='utf-8')
for p in TARGET.rglob('*.js'):subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
files=sorted(p for p in TARGET.rglob('*') if p.is_file())
archive=ROOT/'bin/zjuers-home-0.4.0-demo.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in files:
        info=zipfile.ZipInfo(p.relative_to(TARGET).as_posix(),(2026,10,16,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,p.read_bytes())
record={'version':'0.4.0-demo','files':len(files),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'data':{'courses':10,'scheduleRules':18,'semesterOccurrences':272,'exampleDaySlots':5,'assignments':12,'exams':6,'cc98Topics':10,'dailyDays':7,'hourlyHours':24,'rainPoints':24}}
(ROOT/'bin/demo-build.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,ensure_ascii=False))
