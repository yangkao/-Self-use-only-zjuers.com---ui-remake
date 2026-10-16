"""Build and verify public extension/source archives using Python and Node only."""
from pathlib import Path
import hashlib, json, re, shutil, subprocess, zipfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'srcs/extension'
OUTPUT=ROOT/'bin/release'
manifest=json.loads((SOURCE/'manifest.json').read_text(encoding='utf-8'))
VERSION=manifest['version']
if not re.fullmatch(r'\d+\.\d+\.\d+', VERSION):
    raise SystemExit('A three-part formal version is required')
NAME='zjuers-home-'+VERSION
PACKAGE=OUTPUT/NAME
STAMP=(2026,10,15,0,0,0)
def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def inside(p, parent):
    return p.resolve().is_relative_to(parent.resolve())

tests=sorted((SOURCE/'tests').glob('*.test.cjs'))+[ROOT/'tests/release.test.cjs']
subprocess.run(['node','--test',*[str(p) for p in tests]],check=True,cwd=ROOT)
files=sorted(p for p in SOURCE.rglob('*') if p.is_file() and 'tests' not in p.relative_to(SOURCE).parts)
for p in files:
    rel=p.relative_to(SOURCE).as_posix()
    if p.is_symlink() or p.suffix.lower() in {'.mp4','.webm','.zip','.crx','.pem','.key'} or p.name.startswith('migration'):
        raise SystemExit('Unexpected publication file: '+rel)
    if p.suffix.lower() in {'.js','.css','.html','.json','.md','.txt','.svg'}:
        s=p.read_text(encoding='utf-8')
        if re.search(r'(?<![A-Za-z0-9])[A-Za-z]:[\\/]',s):
            raise SystemExit('Hardcoded local media path in '+rel)
        if re.search(r'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN .*PRIVATE KEY-----)',s):
            raise SystemExit('Potential secret in '+rel)
    if p.suffix=='.js':
        subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
refs=[manifest['background']['service_worker'],manifest['options_page'],*manifest['icons'].values()]
for entry in manifest['content_scripts']:
    refs.extend(entry.get('js',[])+entry.get('css',[]))
for ref in refs:
    if not inside(SOURCE/ref,SOURCE) or not (SOURCE/ref).is_file():
        raise SystemExit('Missing manifest reference: '+ref)
# Check relative HTML resources and navigation links; ignore remote URLs/anchors.
for p in files:
    if p.suffix!='.html':continue
    for ref in re.findall(r'(?:src|href)=["\']([^"\']+)',p.read_text(encoding='utf-8')):
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:',ref) or ref.startswith('#'):continue
        local=(p.parent/ref.split('#')[0].split('?')[0]).resolve()
        if not inside(local,SOURCE) or not local.is_file():
            raise SystemExit('Missing HTML reference: '+p.name+' -> '+ref)
if PACKAGE.exists():
    if not inside(PACKAGE,OUTPUT) or PACKAGE.name!=NAME:raise SystemExit('Unsafe output cleanup')
    shutil.rmtree(PACKAGE)
PACKAGE.mkdir(parents=True,exist_ok=True)
for p in files:
    dest=PACKAGE/p.relative_to(SOURCE);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
    if digest(p)!=digest(dest):raise SystemExit('Copy hash mismatch')

def archive(dest, pairs):
    with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p,name in pairs:
            info=zipfile.ZipInfo(name,STAMP);info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,p.read_bytes())
    with zipfile.ZipFile(dest) as z:
        if z.testzip() is not None:raise SystemExit('Corrupt ZIP')
        for p,name in pairs:
            if hashlib.sha256(z.read(name)).hexdigest()!=digest(p):raise SystemExit('ZIP hash mismatch: '+name)

extension_zip=OUTPUT/(NAME+'.zip')
archive(extension_zip,[(p,NAME+'/'+p.relative_to(PACKAGE).as_posix()) for p in sorted(PACKAGE.rglob('*')) if p.is_file()])
# Explicit source roots exclude browser profiles, private documents, artifacts and .git history.
public_docs=['install','configuration','privacy','development','release']
source_files=[ROOT/p for p in ['README.md','LICENSE','THIRD_PARTY_NOTICES.md','.gitignore','.gitattributes','srcs/build-release.py','tests/release.test.cjs']]
source_files.extend(ROOT/'docs'/(name+'.md') for name in public_docs)
for folder in ['srcs/extension','licenses']:
    source_files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
source_files=sorted(source_files)
if any(not inside(p,ROOT) or p.is_symlink() for p in source_files):raise SystemExit('Unsafe source file')
source_zip=OUTPUT/(NAME+'-source.zip')
archive(source_zip,[(p,NAME+'-source/'+p.relative_to(ROOT).as_posix()) for p in source_files])
record={'version':VERSION,'files':[{'path':p.relative_to(PACKAGE).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(PACKAGE.rglob('*')) if p.is_file()],
        'archives':[{'name':p.name,'bytes':p.stat().st_size,'sha256':digest(p)}for p in [extension_zip,source_zip]]}
(OUTPUT/'release-manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(OUTPUT/'SHA256SUMS.txt').write_text(''.join(digest(p)+'  '+p.name+'\n'for p in [extension_zip,source_zip]),encoding='ascii')
print(json.dumps({'version':VERSION,'files':len(files),'source_files':len(source_files),'archives':record['archives'],'checks':'tests, syntax, references, copy and ZIP hashes passed'},ensure_ascii=False))
