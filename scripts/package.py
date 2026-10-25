"""Create an installable ZIP from runtime files and user documentation only."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))['version']
output = root / 'dist' / f'kotoba-mirror-v{version}.zip'
output.parent.mkdir(exist_ok=True)
included = [p for p in root.iterdir() if p.is_file() and p.suffix in {'.js', '.html', '.css', '.md'}]
included.append(root / 'manifest.json')
for directory in ['icons', 'vendor', 'docs']:
    included.extend(p for p in (root / directory).rglob('*') if p.is_file())
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for source in sorted(set(included)):
        archive.write(source, Path('kotoba-mirror') / source.relative_to(root))
with ZipFile(output) as archive:
    assert archive.testzip() is None
print(output)
