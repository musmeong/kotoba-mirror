const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
for (const file of fs.readdirSync(root).filter(name => name.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  assert.equal(result.status, 0, file);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
assert.equal(manifest.version, pkg.version);
assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
assert(!manifest.host_permissions);
for (const page of ['popup.html', 'mirror.html']) {
  const source = fs.readFileSync(path.join(root, page), 'utf8');
  for (const [, file] of source.matchAll(/<script src="([^"]+)"/g)) assert(fs.existsSync(path.join(root, file)), file);
}
for (const [, file] of fs.readFileSync(path.join(root, 'README.md'), 'utf8').matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
  assert(fs.existsSync(path.join(root, file)), file);
}
console.log('Syntax, manifest permissions, entry points, and README screenshots passed.');
