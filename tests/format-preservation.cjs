const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { root, scratch, browserOptions, testExtension } = require('./test-support.cjs');
const native = process.env.KOTOBA_NATIVE_TRANSLATOR === '1';
const build = testExtension(), results = [], record = name => { results.push(name); console.log('PASS', name); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><title>Inline code lesson</title><style>
    body{font:20px/1.8 sans-serif;padding:24px;max-width:850px}
    code,kbd,samp,tt,.shortcut{font-family:Consolas,monospace;color:rgb(199,67,67);background:rgb(248,238,240);padding:1px 7px;border-radius:2px}
  </style></head><body><h1>Programming in Python</h1>
  <p id="lesson">We can test this by writing the instruction <code id="print">print("Hello World")</code> in the <strong id="editor">code editor</strong> on the right and then clicking the <strong id="run">Run Code</strong> button. The computer will follow our instructions and return <code id="result">Hello World</code> as a result. For those who prefer keyboard shortcuts, you can also press <code id="shift">Shift + Enter</code>, <code id="alt">Alt + Enter</code>, or <code id="ctrl">Ctrl + /</code> to run your code.</p>
  <p id="extras">We use <span id="styled" class="shortcut">Shift + Enter</span>, <kbd id="nested"><kbd>Alt</kbd> + <kbd>Enter</kbd></kbd>, and <samp id="sample">Ctrl + /</samp> to run code. Read <a id="lesson-link" href="#next">the next lesson</a>.</p>
  <pre id="block"><code>print("Hello World")\n# Keep source code</code></pre>
  <p id="all-apps">All of the applications mentioned above have something in common: <strong>They were all built with the support of Python.</strong></p>
  <p id="definition">When we give instructions to a computer, it's called <strong>programming</strong>.</p>
  </body></html>`);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = process.env.KOTOBA_TEST_PROFILE || path.join(scratch, `format-profile-${Date.now()}`);
  const context = await chromium.launchPersistentContext(profile, {
    ...browserOptions(), headless: true, viewport: null,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-update', '--disable-background-networking', '--disable-component-extensions-with-background-pages'],
    args: ['--enable-unsafe-extension-debugging']
  });
  try {
    context.setDefaultTimeout(12000);
    const errors = []; context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: build });
    await wait(600);
    const worker = context.serviceWorkers().find(w => w.url().includes(id)) || await context.waitForEvent('serviceworker');
    const source = await context.newPage(); await source.goto(base);
    await source.evaluate(() => {
      globalThis.linkClicks = 0;
      document.getElementById('lesson-link').onclick = event => { event.preventDefault(); linkClicks++; };
    });
    const before = await source.locator('body').innerHTML();
    const inspect = page => page.evaluate(() => {
      const d = document.getElementById('mirror-frame')?.contentDocument || document;
      const keys = ['print','result','shift','alt','ctrl','styled','nested','sample'];
      return keys.map(id => {
        const el = d.getElementById(id), s = d.defaultView.getComputedStyle(el);
        return { id, tag: el.localName, text: el.textContent, class: el.className, children: el.children.length,
          font: s.fontFamily, color: s.color, background: s.backgroundColor, padding: s.padding, radius: s.borderRadius };
      });
    });
    const expected = await inspect(source);
    const sourceId = await worker.evaluate(async base => (await chrome.tabs.query({})).find(t => t.url?.startsWith(base)).id, base);
    const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
    const start = await popup.evaluate(tabId => chrome.runtime.sendMessage({ type: 'km:start', tabId,
      settings: { sourceLanguage: 'en', targetLanguage: 'ja', syncScroll: true, syncClick: true, showFurigana: true },
      bounds: { left: screen.availLeft || 0, top: screen.availTop || 0, width: screen.availWidth, height: screen.availHeight } }), sourceId);
    assert(start.ok, JSON.stringify(start));
    let mirror;
    for (let i = 0; i < 100; i++) { mirror = context.pages().find(p => p.url().includes('mirror.html?')); if (mirror) break; await wait(50); }
    await mirror.waitForSelector('#site[title]'); await mirror.bringToFront();
    if (!native) await mirror.evaluate(() => {
      globalThis.Translator = { create: async () => ({
        translate: async text => text.includes('<') ? text.replace(/(^|>)([^<]+)(?=<|$)/g, (_, open) => open + '翻訳された説明。') : '翻訳された説明。', destroy() {}
      }) };
    });
    await mirror.locator('#activate').click();
    await mirror.waitForFunction(() => document.getElementById('status').textContent.startsWith('Terhubung.'), {}, { timeout: 120000 });
    async function verify(label) {
      assert.deepEqual(await inspect(mirror), expected);
      const check = await mirror.evaluate(() => {
        const d = document.getElementById('mirror-frame').contentDocument;
        const p = d.getElementById('lesson'), copy = p.cloneNode(true);
        copy.querySelectorAll('code,kbd,samp,[data-km-code],rt,rp').forEach(n => n.remove());
        const afterPrint = d.createRange(); afterPrint.setStartAfter(d.getElementById('print')); afterPrint.setEndBefore(d.getElementById('result'));
        return { codeOrder: [...p.querySelectorAll('code')].map(n => n.id), prose: copy.textContent,
          bold: p.querySelectorAll('strong').length, between: afterPrint.toString(),
          codeRuby: d.querySelectorAll('code ruby,kbd ruby,samp ruby,[data-km-code] ruby').length,
          block: d.getElementById('block').textContent,
          apps: d.getElementById('all-apps').textContent };
      });
      assert.deepEqual(check.codeOrder, ['print','result','shift','alt','ctrl']);
      assert.equal(check.bold, 2); assert(/\p{Script=Han}/u.test(check.between), check.between);
      assert(!/We can test|The computer|For those who prefer/.test(check.prose), check.prose);
      assert(!check.apps.includes('All of the applications'), check.apps);
      assert.equal(check.codeRuby, 0); assert.equal(check.block, 'print("Hello World")\n# Keep source code');
      record(label);
    }
    await verify('Screenshot paragraph retains exact code, shortcut styling, positions, emphasis, and untouched code blocks');
    const safety = await mirror.evaluate(() => {
      const d = document.getElementById('mirror-frame').contentDocument, fixture = d.createElement('p');
      fixture.innerHTML = 'Read <a href="https://example.com/lesson">this lesson</a> and use <code>print("Hello World")</code>.';
      d.body.append(fixture);
      const unit = KotobaBlocks.collect(d, 'code,script,style').find(item => item.root === fixture), before = fixture.innerHTML;
      const rejected = [
        '<a0>レッスン</a0>',
        '<a0>レッスン</a0><a0>複製</a0><code1>wrong</code1>',
        '<a0>レッスン</a0><script1>wrong</script1>',
        '<script>alert(1)</script><a0>レッスン</a0><code1>wrong</code1>'
      ].every(output => KotobaBlocks.apply(unit, output) === null && fixture.innerHTML === before);
      const accepted = Boolean(KotobaBlocks.apply(unit, '<a0 href="javascript:alert(1)" onclick="alert(1)">レッスン</a0>を読んで<code1>changed by model</code1>を使います。'));
      const result = { rejected, accepted, href: fixture.querySelector('a').getAttribute('href'),
        handler: fixture.querySelector('a').getAttribute('onclick'), code: fixture.querySelector('code').textContent, scripts: fixture.querySelectorAll('script').length };
      fixture.remove(); return result;
    });
    assert.deepEqual(safety, { rejected: true, accepted: true, href: 'https://example.com/lesson', handler: null, code: 'print("Hello World")', scripts: 0 });
    record('Missing, duplicate, wrong-tag, and script markers are rejected; model attributes and changed code are discarded');
    await mirror.evaluate(() => {
      const original = translator;
      globalThis.breakMode = 'primary'; globalThis.forcedPrimary = 0; globalThis.structuredRetries = 0; globalThis.retryResults = [];
      translator = { destroy: () => original.destroy(), translate: async text => {
        const primary = /<[a-z]+\d+>/.test(text), retry = /<[a-z]+ id="\d+">/.test(text);
        if (primary && breakMode) { forcedPrimary++; return '<em>Damaged formatting</em>'; }
        if (retry) { structuredRetries++; if (breakMode === 'both') return 'Plain text without required formatting.'; }
        const result = await original.translate(text);
        if (retry) retryResults.push({ input: text, output: result });
        return result;
      } };
      cache.clear();
    });
    await mirror.locator('#translate').click();
    await mirror.waitForFunction(() => /^(Terhubung\.|Terjemahan terhenti:)/.test(document.getElementById('status').textContent), {}, { timeout: 120000 });
    assert((await mirror.locator('#status').textContent()).startsWith('Terhubung.'), JSON.stringify(await mirror.evaluate(() => ({ status: document.getElementById('status').textContent, retryResults })), null, 2));
    const forced = await mirror.evaluate(() => ({ primary: forcedPrimary, retry: structuredRetries }));
    assert(forced.primary >= 4 && forced.retry >= 4, JSON.stringify(forced));
    await verify('Forced marker damage retries the whole sentence without flattening or appending code');
    await mirror.setViewportSize({ width: 900, height: 980 });
    await mirror.evaluate(() => document.getElementById('mirror-frame').contentDocument.scrollingElement.scrollTo(0, 0));
    await mirror.screenshot({ path: path.join(scratch, native ? 'native-format-preview.png' : 'format-preview.png') });
    await mirror.locator('#mirror-frame').contentFrame().locator('#lesson-link').click();
    assert.equal(await source.evaluate(() => linkClicks), 1);
    record('Translated link retains its label, original target, and exactly one source click after retry');
    await mirror.evaluate(() => { globalThis.goodDoc = document.getElementById('mirror-frame').contentDocument; breakMode = 'both'; cache.clear(); });
    await mirror.locator('#translate').click();
    await mirror.waitForFunction(() => document.getElementById('status').textContent.startsWith('Terjemahan terhenti:'), {}, { timeout: 120000 });
    assert(await mirror.evaluate(() => document.getElementById('mirror-frame').contentDocument === goodDoc));
    await verify('If both encodings fail, the last complete Japanese view stays intact');
    await mirror.evaluate(() => { breakMode = ''; });
    await mirror.locator('#translate').click();
    await mirror.waitForFunction(() => document.getElementById('status').textContent.startsWith('Terhubung.'), {}, { timeout: 120000 });
    await verify('Retry recovers after model failure without reusing damaged cached markup');
    assert.equal(await source.locator('body').innerHTML(), before);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    record('Source markup stays unchanged and no uncaught browser errors occur');
    fs.writeFileSync(path.join(scratch, native ? 'native-format-results.json' : 'format-results.json'), JSON.stringify({ native, results, expected }, null, 2));
    await mirror.locator('#close').click();
  } finally { await context.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
