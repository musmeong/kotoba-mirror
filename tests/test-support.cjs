const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const scratch = path.join(root, 'work', 'browser-tests');
fs.mkdirSync(scratch, { recursive: true });

function browserOptions() {
  const configured = process.env.KOTOBA_CHROME_EXECUTABLE;
  if (configured) return { executablePath: configured };
  const installed = process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' :
    process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome';
  return fs.existsSync(installed) ? { executablePath: installed } : { channel: 'chromium' };
}

function testExtension() {
  const build = fs.mkdtempSync(path.join(scratch, 'extension-'));
  for (const name of fs.readdirSync(root)) {
    if (name === 'icons' || name === 'vendor' || /\.(js|html|css)$/.test(name) || name === 'manifest.json') {
      fs.cpSync(path.join(root, name), path.join(build, name), { recursive: true });
    }
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(build, 'manifest.json')));
  // Automation cannot click browser chrome; grant only the localhost fixture.
  // The release manifest has no host_permissions.
  manifest.host_permissions = ['http://127.0.0.1/*'];
  fs.writeFileSync(path.join(build, 'manifest.json'), JSON.stringify(manifest));
  return build;
}
module.exports = { root, scratch, browserOptions, testExtension };
