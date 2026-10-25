const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { scratch, browserOptions, testExtension } = require('./test-support.cjs');
const native = process.env.KOTOBA_NATIVE_TRANSLATOR === '1';
const results = [], record = name => { results.push(name); console.log('PASS', name); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const katex = value => `<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mn>${value}</mn></mrow><annotation encoding="application/x-tex">${value}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut" style="height:.65em"></span><span class="mord">${value}</span></span></span></span>`;
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="ja"><head><title>Japanese mathematics</title><style>body{font:20px/1.8 sans-serif;padding:24px}.katex-mathml{position:absolute;clip:rect(1px,1px,1px,1px)}.katex-html{font-family:serif}</style></head><body>
  <p id="cards">黒いカードが ${katex('2')} 枚あります。白いカードは ${katex('4')} 枚あります。それぞれのカードには ${katex('100')} 以下の整数が書かれています。</p>
  <p id="jax">次の数を求めてください：<mjx-container><svg xmlns="http://www.w3.org/2000/svg" width="60" height="25"><text x="0" y="20">x+1</text></svg></mjx-container>。</p>
  <p id="raw">この数を使います：<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>A</mi><mo>+</mo><mn>1</mn></math>。</p>
  <div class="katex-display">${katex('42')}</div><p id="plain">数学の問題を読みます。</p>
  </body></html>`);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, build = testExtension();
  const context = await chromium.launchPersistentContext(process.env.KOTOBA_TEST_PROFILE || path.join(scratch, `math-profile-${Date.now()}`), {
    ...browserOptions(), headless: true, viewport: null,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-update', '--disable-background-networking', '--disable-component-extensions-with-background-pages'],
    args: ['--enable-unsafe-extension-debugging']
  });
  try {
    context.setDefaultTimeout(12000);
    const errors = []; context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
    const cdp = await context.browser().newBrowserCDPSession(); const { id } = await cdp.send('Extensions.loadUnpacked', { path: build });
    await wait(600);
    const worker = context.serviceWorkers().find(w => w.url().includes(id)) || await context.waitForEvent('serviceworker');
    const source = await context.newPage(); await source.goto(base);
    const sourceMarkup = await source.locator('body').innerHTML();
    const formulas = page => page.evaluate(() => {
      const d = document.getElementById('mirror-frame')?.contentDocument || document;
      const selector = 'math,.katex,.katex-display,mjx-container';
      return [...d.querySelectorAll(selector)].filter(n => !n.parentElement.closest(selector)).map(n => {
        const copy = n.cloneNode(true);
        for (const el of [copy, ...copy.querySelectorAll('*')]) el.removeAttribute('data-km-id');
        return copy.outerHTML;
      });
    });
    const expectedMath = await formulas(source);
    const sourceId = await worker.evaluate(async base => (await chrome.tabs.query({})).find(t => t.url?.startsWith(base)).id, base);
    const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('#source').selectOption('ja'); await popup.locator('#target').selectOption('en');
    assert.equal(await popup.locator('#source-preview').textContent(), '日本語');
    assert.equal(await popup.locator('#target-preview').textContent(), 'English');
    const settings = await popup.evaluate(() => ({ sourceLanguage: document.getElementById('source').value, targetLanguage: document.getElementById('target').value, syncScroll: true, syncClick: true, showFurigana: true }));
    const start = await popup.evaluate(({ tabId, settings }) => chrome.runtime.sendMessage({ type: 'km:start', tabId, settings,
      bounds: { left: screen.availLeft || 0, top: screen.availTop || 0, width: screen.availWidth, height: screen.availHeight } }), { tabId: sourceId, settings });
    assert(start.ok, JSON.stringify(start));
    let mirror;
    for (let i = 0; i < 100; i++) { mirror = context.pages().find(p => p.url().includes('mirror.html?')); if (mirror) break; await wait(50); }
    await mirror.waitForSelector('#site[title]'); await mirror.bringToFront();
    if (!native) await mirror.evaluate(() => {
      globalThis.languageCalls = []; globalThis.damagePrimary = false;
      globalThis.Translator = { create: async pair => ({ destroy() {}, translate: async input => {
        languageCalls.push({ ...pair, input });
        if (damagePrimary && /<[a-z]+\d+>/.test(input)) return 'Broken math markers';
        const prose = pair.targetLanguage === 'id' ? 'Ada kartu hitam dan putih. ' : 'There are black and white cards. ';
        return input.includes('<') ? input.replace(/(^|>)([^<]+)(?=<|$)/g, (_, open) => open + prose) : prose;
      } }) };
    });
    async function ready() {
      await mirror.waitForFunction(() => /^(Terhubung\.|Terjemahan terhenti:)/.test(document.getElementById('status').textContent), {}, { timeout: 120000 });
      assert((await mirror.locator('#status').textContent()).startsWith('Terhubung.'), await mirror.locator('#status').textContent());
    }
    async function verify(language) {
      assert.deepEqual(await formulas(mirror), expectedMath);
      const cards = await mirror.locator('#mirror-frame').contentFrame().locator('#cards').textContent();
      assert(language === 'id' ? /kartu hitam/i.test(cards) : /black/i.test(cards), cards);
      assert(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(cards), cards);
      assert.equal(await mirror.locator('#pair').textContent(), `ja ⇄ ${language}`);
      assert.equal(await mirror.locator('#furigana-option').isVisible(), false);
    }
    await mirror.locator('#activate').click(); await ready(); await verify('en');
    record('Japanese → English follows the selected languages and translates prose while keeping every formula subtree intact');
    const inputs = await mirror.evaluate(() => {
      const d = document.getElementById('mirror-frame').contentDocument;
      const test = d.createElement('p'); test.innerHTML = '数は ' + d.querySelector('.katex').outerHTML + ' です。'; d.body.append(test);
      const unit = KotobaBlocks.collect(d, 'script,style').find(u => u.root === test);
      test.remove(); return { input: unit.input, slots: unit.slots.size };
    });
    assert.equal(inputs.slots, 1); assert(inputs.input.includes('<span0>2</span0>'), inputs.input);
    assert(!inputs.input.includes('22') && !inputs.input.includes('annotation') && !inputs.input.includes('strut'), inputs.input);
    record('A KaTeX expression is one protected slot with a single formula value, excluding duplicate accessibility text');
    if (!native) {
      await mirror.evaluate(() => { damagePrimary = true; cache.clear(); });
      await mirror.locator('#translate').click(); await ready(); await verify('en');
      assert(await mirror.evaluate(() => languageCalls.some(call => /<span id="0">/.test(call.input))));
      record('Damaged primary markers retry without changing KaTeX, MathJax SVG, or raw MathML');
      await mirror.evaluate(() => { damagePrimary = false; });
      await mirror.locator('#target').selectOption('id'); await mirror.locator('#activate').click(); await ready(); await verify('id');
      assert(await mirror.evaluate(() => languageCalls.some(call => call.sourceLanguage === 'ja' && call.targetLanguage === 'id')));
      record('Changing the target dropdown uses Japanese → Indonesian and preserves formulas');
    }
    assert.equal(await source.locator('body').innerHTML(), sourceMarkup); assert.deepEqual(errors, []);
    record('Source markup stays unchanged and no uncaught browser errors occur');
    fs.writeFileSync(path.join(scratch, native ? 'native-math-results.json' : 'math-results.json'), JSON.stringify({ native, results }, null, 2));
    await mirror.locator('#close').click();
  } finally { await context.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
