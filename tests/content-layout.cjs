const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { scratch, browserOptions, testExtension } = require('./test-support.cjs');
const native = process.env.KOTOBA_NATIVE_TRANSLATOR === '1';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [], record = name => { results.push(name); console.log('PASS', name); };
const diagram = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="100"><rect width="360" height="100" fill="#edf5f7"/><text x="20" y="55" fill="#183c45">Input → Computer → Output</text></svg>';
const snippet = (id, code) => `<div id="${id}" class="snippet notranslate" translate="no"><div class="CodeMirror"><div class="CodeMirror-scroll"><div class="CodeMirror-sizer"><pre class="CodeMirror-line"><span class="cm-keyword">${code}</span></pre></div></div></div><button>Explain</button><button>Copy</button></div>`;
const sections = Array.from({ length: 9 }, (_, i) => `<section><p id="paragraph-${i}">We can print a message and compare the input with the output. This paragraph explains the next example.</p>${snippet('snippet-'+i, i % 2 ? 'Hello,World' : 'print("Hello", end=",")\nprint("World")')}</section>`).join('');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/missing')) { res.writeHead(404); res.end(); return; }
  if (req.url.startsWith('/forbidden')) { res.writeHead(403); res.end(); return; }
  if (req.url.startsWith('/never')) return;
  if (req.url.startsWith('/pixel')) {
    res.setHeader('Content-Type','image/png'); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nJ8AAAAASUVORK5CYII=','base64')); return;
  }
  if (req.url.startsWith('/diagram') || req.url.startsWith('/slow')) {
    const respond = () => { res.setHeader('Content-Type', 'image/svg+xml'); res.end(diagram); };
    if (req.url.startsWith('/slow')) setTimeout(respond, 1800); else respond(); return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><title>Media and code layout</title><style>
    *{box-sizing:border-box}body{margin:0;font:18px/1.6 sans-serif}.lesson{height:620px;width:520px;max-width:100vw;overflow:auto;padding:24px;border:2px solid #ddd}
    p{margin:22px 0}section{margin-bottom:24px}.CodeMirror{height:1100px;overflow:hidden;background:#f7f7ff;font:16px/24px Consolas,monospace}.CodeMirror-scroll{height:100%;overflow:auto}.CodeMirror-line{margin:0;padding:10px;white-space:pre}.cm-keyword{color:#5368a9}.snippet{background:#f7f7ff;border:1px solid #ddd;margin:20px 0}.snippet button{height:28px}.CodeMirror-sizer{min-height:0}
    img,svg{max-width:100%;height:auto}.background{height:80px;background:center/contain no-repeat url('/diagram.svg')}
    .media-row{display:flex;align-items:center;gap:8px}.media-row img{width:110px}.tail{height:750px}
  </style><style id="runtime-style">.CodeMirror-line{tab-size:4}</style></head><body><div class="lesson" id="lesson">
  ${sections}
  <p id="mixed">The code receives an input <img id="mixed-image" width="360" height="100" src="/diagram.svg"> and produces an output.</p>
  <p id="nested-media">Read <strong>this diagram</strong><span> and follow <a id="diagram-link" href="#next"><img id="linked-image" width="360" height="100" src="/diagram.svg"></a> the next example.</span></p>
  <picture id="picture"><source media="(min-width:1px)" srcset="/diagram.svg?chosen 1x"><img id="responsive-image" width="360" height="100" src="/missing-fallback.svg"></picture>
  <p id="vector">This is the process. <svg id="vector-image" xmlns="http://www.w3.org/2000/svg" width="360" height="100"><rect width="360" height="100" fill="#edf5f7"/><text x="20" y="50">Input Computer Output</text></svg> Continue reading the lesson.</p>
  <p id="decorative">Read the example <i aria-hidden="true" id="icon"></i><span id="empty-span"></span> and continue.<br id="line-break">This is the next line.</p>
  <div class="background" id="background"></div>
  <p>Read the next diagram.</p><img id="lazy-image" loading="lazy" width="360" height="100" src="/diagram.svg?lazy">
  <img id="slow-image" width="360" height="100" src="/slow.svg"><img id="broken-image" width="360" height="100" src="/missing.svg">
  <p>More image formats.</p><img id="raster-image" width="80" height="80" src="/pixel.png"><img id="data-image" width="80" height="80" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='teal'/%3E%3C/svg%3E">
  <img id="forbidden-image" width="80" height="80" src="/forbidden.svg"><img id="never-image" width="80" height="80" src="/never.svg">
  <figure><img id="figure-image" width="360" height="100" src="/diagram.svg?figure"><figcaption id="caption">A diagram showing the input and output.</figcaption></figure>
  <canvas id="canvas" width="360" height="140"></canvas><iframe id="embedded" width="360" height="160" srcdoc="<p>Embedded activity</p>"></iframe>
  <p id="after-media">The lesson continues after the images.</p><pre id="long-code" translate="no">${'long_code_identifier_'.repeat(50)}</pre><div class="tail"></div>
  </div><script>
    document.getElementById('runtime-style').sheet.insertRule('.snippet .CodeMirror{height:auto}',1);
    globalThis.sourceClicks=0;document.getElementById('diagram-link').onclick=e=>{e.preventDefault();sourceClicks++};
  </script></body></html>`);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, build = testExtension();
  const context = await chromium.launchPersistentContext(process.env.KOTOBA_TEST_PROFILE || path.join(scratch, `content-profile-${Date.now()}`), {
    ...browserOptions(), headless: true, viewport: null,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-update', '--disable-background-networking', '--disable-component-extensions-with-background-pages'],
    args: ['--enable-unsafe-extension-debugging']
  });
  try {
    context.setDefaultTimeout(12000);
    const errors = []; context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
    const cdp = await context.browser().newBrowserCDPSession(); const { id } = await cdp.send('Extensions.loadUnpacked', { path: build }); await wait(600);
    const worker = context.serviceWorkers().find(w => w.url().includes(id)) || await context.waitForEvent('serviceworker');
    const source = await context.newPage(); await source.goto(base,{waitUntil:'domcontentloaded'});
    let original = await source.locator('body').innerHTML();
    const sizes = page => page.evaluate(() => {
      const d = document.querySelector('#mirror-frame')?.contentDocument || document;
      return [...d.querySelectorAll('.snippet')].map(el => ({ id: el.id, height: el.getBoundingClientRect().height, text: el.querySelector('.CodeMirror').textContent, color: d.defaultView.getComputedStyle(el.querySelector('.cm-keyword')).color }));
    });
    const expectedSizes = await sizes(source);
    const sourceId = await worker.evaluate(async base => (await chrome.tabs.query({})).find(t => t.url?.startsWith(base)).id, base);
    const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
    assert((await popup.evaluate(tabId => chrome.runtime.sendMessage({ type:'km:start', tabId, settings:{sourceLanguage:'en',targetLanguage:'ja',syncScroll:true,syncClick:true,showFurigana:true}, bounds:{left:screen.availLeft||0,top:screen.availTop||0,width:screen.availWidth,height:screen.availHeight}}), sourceId)).ok);
    let mirror;
    for (let i=0;i<100;i++) { mirror=context.pages().find(p=>p.url().includes('mirror.html?')); if(mirror)break; await wait(50); }
    await mirror.waitForSelector('#site[title]'); await mirror.bringToFront();
    await source.setViewportSize({width:720,height:1000}); await mirror.setViewportSize({width:720,height:1000}); await wait(600);
    // Observe source element identities in the isolated test browser. This does
    // not add attributes, scripts, or test hooks to the page being mirrored.
    await worker.evaluate(tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>{
      globalThis.testScrollNodes=new Map(); globalThis.testLessonState=undefined;
      const capture=KotobaScroll.capture,apply=KotobaScroll.apply;
      KotobaScroll.capture=(d,target,identify)=>{
        const state=capture(d,target,el=>{const id=identify(el);testScrollNodes.set(id,el);return id;});
        if(target?.id==='lesson')testLessonState=state;
        return state;
      };
      KotobaScroll.apply=(d,target,state,find)=>apply(d,target,state,id=>{const node=find(id);if(node)testScrollNodes.set(id,node);return node;});
    }}),sourceId);
    if (!native) await mirror.evaluate(() => {
      globalThis.modelInputs=[];
      globalThis.Translator={create:async()=>({destroy(){},translate:async text=>{
        modelInputs.push(text);
        // Models may drop empty visual markers. A diagram must not make its
        // surrounding paragraph, or the entire lesson, fail to translate.
        return text.includes('<') ? text.replace(/<([a-z]+\d+)>\s*<\/\1>/g,'').replace(/<span id="\d+">\s*<\/span>/g,'').replace(/(^|>)([^<]+)(?=<|$)/g,(_,open)=>open+'入力と出力を学びます。') : '入力と出力を学びます。';
      }})};
    });
    await mirror.locator('#activate').click();
    await mirror.waitForFunction(()=>/^(Terhubung\.|Terjemahan terhenti:)/.test(document.getElementById('status').textContent),{}, {timeout:120000});
    assert((await mirror.locator('#status').textContent()).startsWith('Terhubung.'),await mirror.locator('#status').textContent());
    const gotSizes = await sizes(mirror);
    for (let i=0;i<expectedSizes.length;i++) {
      assert(Math.abs(gotSizes[i].height-expectedSizes[i].height)<2,JSON.stringify({expected:expectedSizes[i],actual:gotSizes[i]}));
      assert.equal(gotSizes[i].text,expectedSizes[i].text); assert.equal(gotSizes[i].color,expectedSizes[i].color);
    }
    record('CodeMirror snippets retain original heights, syntax colors, and code after CSSOM insertRule changes');
    const mf=mirror.locator('#mirror-frame').contentFrame();
    for (const key of ['mixed','nested-media','vector','after-media']) {
      const text=await mf.locator('#'+key).textContent(); assert(/\p{Script=Han}/u.test(text),text);
    }
    for (const key of ['mixed-image','linked-image','responsive-image','lazy-image','slow-image','raster-image','data-image','figure-image']) {
      await mf.locator('#'+key).evaluate(el=>el.scrollIntoView({block:'center'}));
      await mf.locator('#'+key).evaluate(el=>el.decode());
      assert(await mf.locator('#'+key).evaluate(el=>el.naturalWidth>0&&el.getBoundingClientRect().width>0),key);
    }
    assert((await mf.locator('#responsive-image').getAttribute('src')).includes('?chosen'));
    assert((await mf.locator('#background').evaluate(el=>getComputedStyle(el).backgroundImage)).includes(base));
    assert.equal(await mf.locator('#vector-image text').textContent(),'Input Computer Output');
    assert.equal(await mf.locator('#icon,#empty-span,#line-break').count(),3);
    assert(!/Read the example|This is the next line/.test(await mf.locator('#decorative').textContent()));
    record('Mixed, nested, linked, responsive, lazy, slow, SVG, and background images render without losing translated prose');
    assert.equal(await mf.locator('#broken-image').count(),1);
    assert(/\p{Script=Han}/u.test(await mf.locator('#after-media').textContent()));
    record('A broken image does not prevent the rest of the lesson from being translated');
    assert.equal(await mf.locator('#forbidden-image').count(),1); assert.equal(await mf.locator('#never-image').count(),1);
    assert(/\p{Script=Han}/u.test(await mf.locator('#caption').textContent()));
    for(const key of ['canvas','embedded']) {
      const a=await source.locator('#'+key).boundingBox(),b=await mf.locator('#'+key).boundingBox();
      assert(Math.abs(a.height-b.height)<2,JSON.stringify({key,a,b}));
    }
    record('Raster/data images, figure captions, failed/stalled requests, and sized canvas/iframe placeholders keep the lesson usable');
    const sourceState=async()=> (await worker.evaluate(tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>testLessonState}),sourceId))[0].result;
    const assertFocus=async(direction,state)=>{
      assert(state?.anchor,JSON.stringify({direction,state}));
      const measured=direction==='source to mirror' ? await mirror.evaluate(state=>{
        const d=document.getElementById('mirror-frame').contentDocument,c=d.getElementById('lesson'),anchor=d.querySelector(`[data-km-id="${CSS.escape(state.anchor)}"]`);
        return {actual:anchor.getBoundingClientRect().top-c.getBoundingClientRect().top+state.progress*anchor.getBoundingClientRect().height,expected:state.point*c.clientHeight};
      },state) : (await worker.evaluate(({tabId,state})=>chrome.scripting.executeScript({target:{tabId},args:[state],func:state=>{
        const c=document.getElementById('lesson'),anchor=testScrollNodes.get(state.anchor);
        return {actual:anchor.getBoundingClientRect().top-c.getBoundingClientRect().top+state.progress*anchor.getBoundingClientRect().height,expected:state.point*c.clientHeight};
      }}),{tabId:sourceId,state}))[0].result;
      assert(Math.abs(measured.actual-measured.expected)<4,JSON.stringify({direction,state,measured}));
    };
    for (const key of ['paragraph-3','paragraph-7','after-media']) {
      await source.locator('#'+key).evaluate(el=>el.scrollIntoView({block:'start'})); await wait(350);
      await assertFocus('source to mirror',await sourceState());
      await mf.locator('#'+key).evaluate(el=>el.scrollIntoView({block:'center'})); await wait(350);
      await assertFocus('mirror to source',await mirror.evaluate(()=>getScrollState(document.getElementById('mirror-frame').contentDocument.getElementById('lesson'))));
    }
    record('Nested lesson scrolling stays aligned in both directions after repeated code blocks and images');
    await mirror.locator('#scroll').uncheck(); const sourceTop=await source.locator('#lesson').evaluate(el=>el.scrollTop);
    await mf.locator('#lesson').evaluate(el=>el.scrollTo(0,0)); await wait(250);
    assert.equal(await source.locator('#lesson').evaluate(el=>el.scrollTop),sourceTop);
    record('Disabling sync keeps the original scroll position unchanged');
    await mirror.locator('#scroll').check();
    await mf.locator('#linked-image').click(); assert.equal(await source.evaluate(()=>sourceClicks),1);
    record('Clicking a linked image forwards exactly one original action');
    await source.locator('#broken-image').evaluate(el=>{el.src='/diagram.svg?recovered';});
    original=await source.locator('body').innerHTML();
    await mirror.waitForFunction(()=>document.getElementById('mirror-frame').contentDocument.getElementById('broken-image')?.src.includes('?recovered'),{}, {timeout:20000});
    await mf.locator('#broken-image').evaluate(el=>el.decode());
    assert(await mf.locator('#broken-image').evaluate(el=>el.naturalWidth>0));
    record('A failed image can recover through a dynamic source update without restarting the mirror');
    assert.equal(await source.locator('body').innerHTML(),original); assert.deepEqual(errors,[]);
    record('Source content stays unchanged and no uncaught browser errors occur');
    await mirror.setViewportSize({width:900,height:950});
    await mirror.screenshot({path:path.join(scratch,native?'native-content-preview.png':'content-preview.png')});
    fs.writeFileSync(path.join(scratch,native?'native-content-results.json':'content-results.json'),JSON.stringify({native,results,expectedSizes,gotSizes},null,2));
    await mirror.locator('#close').click();
  } finally { await context.close(); server.close(); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
