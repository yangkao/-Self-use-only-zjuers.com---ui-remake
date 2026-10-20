"""Build the allowlisted public source tree, without network or third party libraries."""
from pathlib import Path
import hashlib, json, re, subprocess, zipfile
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'srcs/extension'
STAMP = (2026, 10, 20, 0, 0, 0)

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def validate_public_sources(root, files):
    """Check the entire source archive, including docs, demo and automation."""
    root=root.resolve()
    for p in files:
        rel=p.relative_to(root)
        assert not p.is_symlink() and p.resolve().is_relative_to(root),rel.as_posix()
        if p.suffix.lower() in {'.js','.cjs','.json','.md','.txt','.html','.css','.svg','.py','.yml','.yaml'}:
            text=p.read_text(encoding='utf-8-sig')
            assert not re.search(r'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN .*PRI(?:VATE) KEY-----|Bearer\s+eyJ[A-Za-z0-9_.-]+|(?<![A-Za-z0-9])[A-Za-z]:[\\/](?:Users|ChengGuan)[\\/])',text),'Potential private data: '+rel.as_posix()
            if 'tests' not in rel.parts and p.suffix!='.cjs':
                assert not re.search(r'(?<![A-Za-z0-9])[A-Za-z]:[\\/]',text),'Local path: '+rel.as_posix()

def validate_markdown_links(root, files):
    root=root.resolve()
    for p in files:
        if p.suffix.lower()!='.md': continue
        text=p.read_text(encoding='utf-8-sig')
        targets=re.findall(r'\]\(([^)]+)\)',text)+re.findall(r'(?:src|href)=["\']([^"\']+)',text)
        for target in targets:
            target=target.strip().strip('<>')
            url=urlsplit(target)
            if url.scheme or url.netloc or not url.path: continue
            local=(p.parent/unquote(url.path)).resolve()
            assert local.is_relative_to(root) and local.exists(),(p.relative_to(root).as_posix(),target)

def archive(dest, pairs):
    pairs=sorted(pairs, key=lambda pair: pair[1])
    with zipfile.ZipFile(dest, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p, name in pairs:
            info=zipfile.ZipInfo(name, STAMP)
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o100644 << 16
            z.writestr(info, p.read_bytes())
    with zipfile.ZipFile(dest) as z:
        assert z.testzip() is None
        for p,name in pairs: assert hashlib.sha256(z.read(name)).hexdigest()==digest(p), name

def build():
    manifest=json.loads((SOURCE/'manifest.json').read_text(encoding='utf-8'))
    version=manifest['version']
    assert re.fullmatch(r'\d+\.\d+\.\d+',version)
    assert 'externally_connectable' not in manifest
    assert manifest['options_page']=='account.html'
    tests=sorted((SOURCE/'tests').glob('*.test.cjs'))+sorted((ROOT/'tests').glob('*.test.cjs'))
    subprocess.run(['node','--test', *map(str,tests)], check=True, cwd=ROOT)
    files=sorted(p for p in SOURCE.rglob('*') if p.is_file() and 'tests' not in p.relative_to(SOURCE).parts and not p.name.endswith('.test.cjs'))
    refs=[manifest['background']['service_worker'],manifest['options_page'],*manifest['icons'].values()]
    for entry in manifest['content_scripts']: refs.extend(entry.get('js',[])+entry.get('css',[]))
    for ref in refs: assert (SOURCE/ref).resolve().is_relative_to(SOURCE.resolve()) and (SOURCE/ref).is_file(), ref
    for p in files:
        assert not p.is_symlink() and p.suffix.lower() not in {'.mp4','.webm','.zip','.crx','.pem','.key'},p.name
        assert not p.name.startswith(('migration','cc98-preview','components-preview')),p.name
        if p.suffix in {'.js','.json','.html','.css','.md','.svg','.txt'}:
            text=p.read_text(encoding='utf-8-sig')
            assert not re.search(r'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN .*PRI(?:VATE) KEY-----|Bearer\s+eyJ[A-Za-z0-9_.-]+|(?<![A-Za-z0-9])[A-Za-z]:[\\/])',text),'Potential private data: '+p.relative_to(SOURCE).as_posix()
        if p.suffix=='.js': subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
        if p.suffix=='.html':
            for ref in re.findall(r'(?:src|href)=["\']([^"\']+)',p.read_text(encoding='utf-8')):
                if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:',ref) or ref.startswith('#'): continue
                local=(p.parent/ref.split('#')[0].split('?')[0]).resolve()
                assert local.is_relative_to(SOURCE.resolve()) and local.is_file(),(p.name,ref)
    output=ROOT/'bin/release'
    output.mkdir(parents=True,exist_ok=True)
    name='zjuers-home-'+version
    extension=output/(name+'.zip')
    source=output/(name+'-source.zip')
    archive(extension,[(p,name+'/'+p.relative_to(SOURCE).as_posix()) for p in files])
    source_files=[]
    for folder in ['srcs/extension','srcs/demo','licenses','docs','.github','tests']:
        source_files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
    source_files.extend(ROOT/p for p in ['README.md','LICENSE','THIRD_PARTY_NOTICES.md','.gitignore','.gitattributes','srcs/build-release.py','srcs/build-demo.py'])
    validate_public_sources(ROOT,source_files)
    for p in source_files:
        if p.suffix in {'.js','.cjs'} and not p.is_relative_to(SOURCE):
            subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
    assert not (ROOT/'docs/AI').exists(),'AI process documents cannot be published'
    validate_markdown_links(ROOT,source_files)
    archive(source,[(p,name+'-source/'+p.relative_to(ROOT).as_posix()) for p in source_files])
    records=[{'name':p.name,'bytes':p.stat().st_size,'sha256':digest(p)} for p in [extension,source]]
    (output/'SHA256SUMS.txt').write_text(''.join(r['sha256']+'  '+r['name']+'\n' for r in records),encoding='ascii')
    (output/'release-manifest.json').write_text(json.dumps({'version':version,'archives':records,'files':[{'path':p.relative_to(SOURCE).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p)} for p in files]},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'version':version,'extension_files':len(files),'source_files':len(source_files),'archives':records},ensure_ascii=False))

if __name__=='__main__': build()
