"""Verify the accepted baseline and create the official unpacked and ZIP artifacts."""
from pathlib import Path
import hashlib
import datetime
import json
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'srcs' / 'extension'
VERSION = json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8'))['version']
OUTPUT = ROOT / 'bin' / 'release'
NAME = f'zjuers-home-{VERSION}'
PACKAGE = OUTPUT / NAME
ARCHIVE = OUTPUT / f'{NAME}.zip'

def digest(p):
    with p.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

accepted = json.loads((ROOT / 'docs' / 'full-acceptance-manifest.json').read_text(encoding='utf-8'))
if accepted['version'] != VERSION:
    raise RuntimeError('Version does not match accepted baseline')
for entry in accepted['files']:
    p = SOURCE / entry['path']
    if p.stat().st_size != entry['bytes'] or digest(p) != entry['sha256']:
        raise RuntimeError('Source differs from accepted baseline: ' + entry['path'])

files = [p for p in SOURCE.rglob('*') if p.is_file()
         and 'tests' not in p.relative_to(SOURCE).parts
         and not p.name.endswith('.test.cjs')]
expected = {p.relative_to(SOURCE).as_posix() for p in files} | {'INSTALL.md'}
if {p.relative_to(SOURCE).as_posix() for p in files} != {e['path'] for e in accepted['files']}:
    raise RuntimeError('Source file inventory differs from acceptance')
if PACKAGE.exists():
    extra = [p for p in PACKAGE.rglob('*') if p.is_file()
             and p.relative_to(PACKAGE).as_posix() not in expected]
    if extra:
        raise RuntimeError('Unexpected release files; review before rebuilding: ' + str(extra))
PACKAGE.mkdir(parents=True, exist_ok=True)
for p in files:
    destination = PACKAGE / p.relative_to(SOURCE)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, destination)
    assert digest(p) == digest(destination)
shutil.copy2(ROOT / 'docs' / 'install.md', PACKAGE / 'INSTALL.md')
for p in PACKAGE.rglob('*.js'):
    subprocess.run(['node', '--check', str(p)], check=True, capture_output=True)
manifest = json.loads((PACKAGE / 'manifest.json').read_text(encoding='utf-8'))
references = [manifest['background']['service_worker'], manifest['options_page']]
references += list(manifest['icons'].values())
for entry in manifest['content_scripts']:
    references += entry.get('js', []) + entry.get('css', [])
for value in references:
    assert (PACKAGE / value).is_file(), value

installed = sorted(p for p in PACKAGE.rglob('*') if p.is_file())
with zipfile.ZipFile(ARCHIVE, 'w', allowZip64=True) as archive:
    for p in installed:
        info = zipfile.ZipInfo(NAME + '/' + p.relative_to(PACKAGE).as_posix(), (*datetime.date.fromisoformat(accepted['acceptedDate']).timetuple()[:3], 0, 0, 0))
        info.compress_type = zipfile.ZIP_STORED if p.suffix == '.mp4' else zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        with p.open('rb') as source, archive.open(info, 'w', force_zip64=True) as target:
            shutil.copyfileobj(source, target)
with zipfile.ZipFile(ARCHIVE) as archive:
    assert archive.testzip() is None
    for p in installed:
        name = NAME + '/' + p.relative_to(PACKAGE).as_posix()
        with archive.open(name) as stream:
            assert hashlib.file_digest(stream, 'sha256').hexdigest() == digest(p), name

record = {'version': VERSION, 'acceptedDate': accepted['acceptedDate'],
          'package': f'bin/release/{NAME}',
          'archive': {'path': ARCHIVE.name, 'bytes': ARCHIVE.stat().st_size, 'sha256': digest(ARCHIVE)},
          'files': [{'path': p.relative_to(PACKAGE).as_posix(), 'bytes': p.stat().st_size,
                     'sha256': digest(p)} for p in installed]}
(OUTPUT / 'release-manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(OUTPUT / 'SHA256SUMS.txt').write_text(record['archive']['sha256'] + '  ' + ARCHIVE.name + '\n', encoding='ascii')
print(json.dumps({'version': VERSION, 'files': len(installed), 'zip_bytes': ARCHIVE.stat().st_size,
                  'source_acceptance_and_zip_contents': 'verified'}))
