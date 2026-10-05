"""Build the isolated preview using only the Python standard library."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import argparse

root = Path(__file__).resolve().parents[1]
source = root / 'srcs' / 'extension'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--target', choices=['full-preview', 'update1-preview'], default='update1-preview')
target = root / 'bin' / parser.parse_args().target
target.mkdir(parents=True, exist_ok=True)
files = [p for p in source.rglob('*') if p.is_file()
         and 'tests' not in p.relative_to(source).parts
         and not p.name.endswith('.test.cjs')]
expected = {p.relative_to(source) for p in files}
unexpected = [p for p in target.rglob('*') if p.is_file() and p.relative_to(target) not in expected]
if unexpected:
    raise RuntimeError('Unexpected package files: ' + str(unexpected))
for p in files:
    destination = target / p.relative_to(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, destination)
    assert hashlib.sha256(p.read_bytes()).digest() == hashlib.sha256(destination.read_bytes()).digest()
for p in target.rglob('*.js'):
    subprocess.run(['node', '--check', str(p)], check=True, capture_output=True)
manifest = json.loads((target / 'manifest.json').read_text(encoding='utf-8'))
references = [manifest['background']['service_worker'], manifest['options_page']]
references += list(manifest['icons'].values())
for entry in manifest['content_scripts']:
    references += entry.get('js', []) + entry.get('css', [])
for name in references:
    assert (target / name).is_file(), name
print(json.dumps({'version': manifest['version'], 'files': len(files),
                  'bytes': sum(p.stat().st_size for p in files),
                  'syntax_and_hashes': 'passed'}))
