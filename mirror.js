const $ = id => document.getElementById(id);
const sourceTabId = Number(new URLSearchParams(location.search).get('source'));
let settings = { sourceLanguage: 'en', targetLanguage: 'ja', syncScroll: true, syncClick: true, showFurigana: true };
let port, reconnectTimer, ended = false, translator, translatorPair, snapshot, doc, generation = 0;
let scrollFrame, translating = false, starting = false, pendingRender, interactionListeners;
let requestedKey = '', displayedKey = '', displayedSnapshot, forceNextRender = false;
const suppressed = new Map(), pendingScrolls = new Map();
const cache = new Map();
const latestScrolls = new Map();
const selectionTranslation = KotobaSelection.create({
  frame: $('mirror-frame'),
  getLanguages: () => translator && !ended ? { sourceLanguage: settings.targetLanguage, targetLanguage: settings.sourceLanguage } : null
});
const skipped = 'pre,code,kbd,samp,script,style,noscript,textarea,input,select,[contenteditable],[data-km-editor],[translate="no"],.notranslate,svg,math,ruby,rt,rp';
KotobaFillLanguages($('target'), 'ja');
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function send(message) {
  try { port?.postMessage({ ...message, sourceTabId }); }
  catch { status('Koneksi terputus. Menyambungkan lagi…', true); }
}
const command = data => send({ type: 'km:command', command: data });
function updateLabels() {
  const name = KotobaLanguages.find(([code]) => code === settings.targetLanguage)?.[1] || settings.targetLanguage;
  $('activate').textContent = `Aktifkan terjemahan ${name.split(' — ').at(-1)}`;
  $('pair').textContent = `${settings.sourceLanguage} ⇄ ${settings.targetLanguage}`;
  $('furigana-option').hidden = settings.targetLanguage !== 'ja';
}
function connect() {
  if (ended) return;
  port = chrome.runtime.connect({ name: 'km:mirror' });
  port.onMessage.addListener(receive);
  port.onDisconnect.addListener(() => {
    // MV3 service workers can suspend. Reconnect without persisting lesson text.
    void chrome.runtime.lastError;
    if (!ended) { status('Menyambungkan lagi…'); clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, 1000); }
  });
  send({ type: 'km:hello' });
}
function receive(message) {
  if (message.type === 'km:settings') {
    settings = { ...settings, ...message.settings };
    $('target').value = settings.targetLanguage;
    $('scroll').checked = settings.syncScroll;
    $('click').checked = settings.syncClick;
    $('furigana').checked = settings.showFurigana !== false;
    updateLabels();
  }
  if (message.type === 'km:snapshot') {
    snapshot = message;
    latestScrolls.clear();
    for (const state of message.scrolls || []) latestScrolls.set(state.id, state);
    $('site').textContent = new URL(message.url).hostname;
    $('site').title = message.title;
    document.title = `${message.title} — Kotoba Mirror`;
    const force = forceNextRender; forceNextRender = false;
    render(force);
  }
  if (message.type === 'km:scroll' && settings.syncScroll) {
    latestScrolls.set(message.state.id, message.state);
    if (doc && displayedSnapshot?.url === snapshot?.url) applyScroll(message.state);
  }
  if (message.type === 'km:error' || message.type === 'km:ended') {
    if (message.type === 'km:ended') { ended = true; generation++; pendingRender = undefined; translator?.destroy(); selectionTranslation.destroy(); }
    status(message.error, true);
    $('setup-status').textContent = message.error;
  }
}
function render(force = false) {
  if (!snapshot || !translator || ended) return;
  const key = JSON.stringify([snapshot.url, snapshot.html, translatorPair, settings.showFurigana !== false]);
  if (!force && key === displayedKey) {
    if (requestedKey !== key) { requestedKey = key; generation++; pendingRender = undefined; status('Terhubung. Scroll dan klik mengikuti halaman asli.'); }
    return;
  }
  if (!force && key === requestedKey && (translating || pendingRender)) return;
  requestedKey = key;
  pendingRender = { snapshot, key, run: ++generation, pair: translatorPair, sourceLanguage: settings.sourceLanguage, targetLanguage: settings.targetLanguage, furigana: settings.showFurigana !== false };
  $('render-loading').hidden = Boolean(displayedSnapshot);
  if (!displayedSnapshot) $('render-loading').textContent = 'Menyiapkan halaman terjemahan…';
  status(displayedSnapshot ? 'Memperbarui terjemahan…' : 'Menyiapkan halaman terjemahan…');
  translatePage();
}
function prepareDocument(frame, job) {
  const renderDoc = frame.contentDocument;
  const parsed = new DOMParser().parseFromString(job.snapshot.html, 'text/html');
  // Belt and braces: never execute source scripts inside the extension origin.
  parsed.querySelectorAll('script,iframe,object,embed,base,meta,link:not([rel="stylesheet"])').forEach(n => n.remove());
  for (const node of parsed.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) {
      if (/^on/i.test(attr.name) || ['srcdoc','formaction','action','ping'].includes(attr.name)) node.removeAttribute(attr.name);
      if (['href','src','xlink:href'].includes(attr.name) && !/^(https?:|data:|blob:|#|$)/i.test(attr.value)) node.removeAttribute(attr.name);
    }
    if (node.hasAttribute('contenteditable')) node.setAttribute('contenteditable', 'false');
  }
  renderDoc.replaceChild(renderDoc.importNode(parsed.documentElement, true), renderDoc.documentElement);
  renderDoc.documentElement.lang = job.targetLanguage;
  const safety = renderDoc.createElement('style');
  safety.textContent = 'html{scroll-behavior:auto!important}*{animation:none!important;transition:none!important;scroll-behavior:auto!important}input,textarea,[data-km-editor]{cursor:default!important}ruby[data-km-furigana]{ruby-position:over!important;ruby-align:center}ruby[data-km-furigana]>rt{font-size:.55em!important;line-height:1.1;color:inherit;user-select:none}p:has(ruby[data-km-furigana]),li:has(ruby[data-km-furigana]),h1:has(ruby[data-km-furigana]),h2:has(ruby[data-km-furigana]),h3:has(ruby[data-km-furigana]){line-height:1.8!important}';
  renderDoc.head.append(safety);
  return renderDoc;
}
async function waitForStyles(renderDoc) {
  await Promise.all([...renderDoc.querySelectorAll('link[rel="stylesheet"]')].map(link => new Promise(resolve => {
    if (link.sheet) { resolve(); return; }
    const timer = setTimeout(resolve, 2500);
    const done = () => { clearTimeout(timer); resolve(); };
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
  })));
}
function publish(frame, renderDoc, job) {
  const previous = doc ? getScrollState(doc.scrollingElement) : null;
  const oldFrame = $('mirror-frame');
  interactionListeners?.abort();
  oldFrame.id = 'render-buffer';
  frame.id = 'mirror-frame';
  doc = renderDoc;
  doc.documentElement.setAttribute('data-km-ready', '');
  const positions = settings.syncScroll ? [...latestScrolls.values()] : previous ? [previous] : job.snapshot.scrolls || [];
  for (const state of positions) applyScroll(state);
  interactionListeners = new AbortController();
  const options = { capture: true, signal: interactionListeners.signal };
  doc.addEventListener('click', onClick, options);
  doc.addEventListener('submit', e => e.preventDefault(), options);
  doc.addEventListener('beforeinput', e => e.preventDefault(), options);
  doc.addEventListener('keydown', e => { if (e.target.closest?.('input,textarea,select,[data-km-editor]')) e.preventDefault(); }, options);
  doc.addEventListener('scroll', onScroll, options);
  selectionTranslation.bind(doc, frame);
  // Swap visibility without moving either iframe, which would reload its document.
  oldFrame.setAttribute('data-km-buffer', '');
  oldFrame.setAttribute('aria-hidden', 'true');
  oldFrame.tabIndex = -1;
  frame.removeAttribute('data-km-buffer');
  frame.removeAttribute('aria-hidden');
  frame.removeAttribute('tabindex');
  frame.title = 'Terjemahan halaman belajar';
  displayedKey = job.key; displayedSnapshot = job.snapshot;
  $('render-loading').hidden = true;
}
function byId(id) { return id && doc?.querySelector(`[data-km-id="${CSS.escape(id)}"]`); }
function getScrollState(target) {
  const root = !target || target === doc || target === doc.documentElement || target === doc.body;
  const el = root ? doc.scrollingElement : target;
  const rect = root ? { left: 0, top: 0 } : el.getBoundingClientRect();
  const height = root ? $('mirror-frame').clientHeight : el.clientHeight;
  const width = root ? $('mirror-frame').clientWidth : el.clientWidth;
  const anchor = doc.elementFromPoint(Math.max(1, rect.left + width * .4), Math.max(1, rect.top + Math.min(64, height * .15)))?.closest('[data-km-id]');
  return { id: root ? null : el.getAttribute('data-km-id'), x: el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth),
    y: el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight), anchor: anchor && el.contains(anchor) && anchor !== el ? anchor.getAttribute('data-km-id') : null,
    offset: anchor ? (anchor.getBoundingClientRect().top - rect.top) / Math.max(1, height) : 0 };
}
function applyScroll(state) {
  if (!doc || !state) return;
  const el = state.id ? byId(state.id) : doc.scrollingElement;
  if (!el) return;
  suppressed.set(state.id, performance.now() + 160);
  const height = state.id ? el.clientHeight : $('mirror-frame').clientHeight;
  const top = state.id ? el.getBoundingClientRect().top : 0;
  const anchor = byId(state.anchor);
  const y = anchor && el.contains(anchor) && anchor !== el ? el.scrollTop + anchor.getBoundingClientRect().top - top - state.offset * height : state.y * (el.scrollHeight - el.clientHeight);
  el.scrollTo({ top: Math.max(0, y), left: Math.max(0, state.x * (el.scrollWidth - el.clientWidth)), behavior: 'instant' });
}
function onScroll(event) {
  if (!settings.syncScroll || displayedSnapshot?.url !== snapshot?.url) return;
  const target = event.target;
  const state = getScrollState(target);
  if (performance.now() < (suppressed.get(state.id) || 0)) return;
  pendingScrolls.set(state.id, state);
  latestScrolls.set(state.id, state);
  if (!scrollFrame) scrollFrame = setTimeout(() => {
    scrollFrame = undefined;
    for (const state of pendingScrolls.values()) command({ action: 'scroll', state });
    pendingScrolls.clear();
  }, 32);
}
function onClick(event) {
  const element = event.target.closest?.('[data-km-id]');
  if (!element) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (selectionTranslation.hasSelection()) return;
  if (displayedSnapshot?.html !== snapshot?.html || displayedSnapshot?.url !== snapshot?.url) { status('Tunggu sebentar, terjemahan sedang diperbarui.'); return; }
  if (!settings.syncClick) { status('Sinkronisasi klik dimatikan. Aktifkan “Klik” untuk berinteraksi.'); return; }
  const input = element.closest('input,textarea,select,[data-km-editor]');
  const editing = input && !['checkbox','radio','button','submit','reset'].includes(input.type);
  command({ action: editing ? 'focus' : 'click', id: element.getAttribute('data-km-id') });
  if (editing) status('Ketik atau pilih jawaban di halaman asli sebelah kanan.');
}
async function activate() {
  if (starting || ended) return;
  starting = true;
  $('activate').disabled = $('translate').disabled = true;
  $('target').disabled = true;
  const requestedPair = `${settings.sourceLanguage}:${settings.targetLanguage}`;
  try {
    if (!('Translator' in globalThis)) throw new Error('Penerjemah belum tersedia. Gunakan Google Chrome desktop 138+ yang diperbarui; browser ini belum menyediakan Translator API.');
    if (settings.sourceLanguage === settings.targetLanguage) throw new Error('Bahasa belajar harus berbeda dari bahasa asli.');
    if (translatorPair !== requestedPair || !translator) {
      translator?.destroy(); translator = undefined; translatorPair = undefined;
      status('Menyiapkan paket bahasa…');
      $('setup-status').textContent = 'Menyiapkan paket bahasa. Tetap buka jendela ini.';
      // Called directly from a real button click: Chrome requires user activation for downloads.
      translator = await Translator.create({ sourceLanguage: settings.sourceLanguage, targetLanguage: settings.targetLanguage,
        monitor(monitor) { monitor.addEventListener('downloadprogress', event => {
          const text = `Mengunduh paket bahasa… ${Math.round(event.loaded * 100)}%`;
          status(text); $('setup-status').textContent = text;
        }); }
      });
      translatorPair = requestedPair;
      cache.clear();
    }
    $('welcome').classList.add('hidden');
    render(true);
  } catch (error) {
    const text = error.name === 'NotSupportedError' ? 'Pasangan bahasa ini belum tersedia di Chrome ini. Pilih bahasa lain atau perbarui Chrome.' : error.message;
    status(text, true); $('setup-status').textContent = text;
  } finally { starting = false; $('activate').disabled = $('translate').disabled = false; $('target').disabled = false; }
}
async function translatePage() {
  if (translating || !pendingRender || !translator || ended) return;
  translating = true;
  const job = pendingRender; pendingRender = undefined;
  const currentTranslator = translator, runPair = job.pair;
  const valid = () => !ended && currentTranslator === translator && runPair === translatorPair && job.furigana === (settings.showFurigana !== false) && job.snapshot.url === snapshot?.url;
  try {
    const frame = $('render-buffer'), renderDoc = prepareDocument(frame, job);
    await waitForStyles(renderDoc);
    if (!valid()) return;
    const tasks = KotobaBlocks.collect(renderDoc, skipped);
    // Translate visible lesson text first; remaining text follows in document order.
    const visible = unit => { const r = unit.root.getBoundingClientRect(); return r.bottom > 0 && r.top < frame.clientHeight; };
    tasks.sort((a, b) => Number(visible(b)) - Number(visible(a)));
    let complete = 0, furiganaFailed = false;
    async function translate(input, rich = false) {
      const key = `${runPair}:${rich ? 'rich' : 'text'}:${input}`;
      if (cache.has(key)) return cache.get(key);
      const parts = rich ? [input] : KotobaBlocks.chunks(input, job.sourceLanguage);
      const results = [];
      for (const part of parts) results.push(await currentTranslator.translate(part));
      const translated = results.join(' ');
      if (cache.size >= 3000) cache.delete(cache.keys().next().value);
      cache.set(key, translated);
      return translated;
    }
    let lastYield = performance.now();
    for (const unit of tasks) {
      if (!valid()) return;
      const rich = unit.slots.size > 0;
      const useRich = rich && unit.input.length <= 6000;
      const input = useRich ? unit.input : rich ? unit.fallbackText : unit.text;
      const translated = input ? await translate(input, useRich) : '';
      if (!valid()) return;
      let applied = rich && !useRich ? null : KotobaBlocks.apply(unit, translated);
      if (!applied) {
        const plain = useRich ? (unit.fallbackText ? await translate(unit.fallbackText) : '') : translated;
        if (!valid()) return;
        applied = KotobaBlocks.fallback(unit, plain);
      }
      if (job.targetLanguage === 'ja' && job.furigana && !furiganaFailed) {
        if (complete === 0) status('Menambahkan furigana…');
        try {
          const nodes = [];
          if (applied.scope.nodeType === Node.TEXT_NODE) nodes.push(applied.scope);
          else {
            const walker = renderDoc.createTreeWalker(applied.scope, NodeFilter.SHOW_TEXT, {
              acceptNode: node => node.data.trim() && !node.parentElement.closest(skipped) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
            });
            while (walker.nextNode()) nodes.push(walker.currentNode);
          }
          for (const node of nodes) await KotobaFurigana.annotate(node, valid);
        }
        catch { furiganaFailed = true; }
      }
      if (++complete % 8 === 0) status(`Menerjemahkan… ${complete}/${tasks.length} bagian`);
      if (performance.now() - lastYield > 12) { await new Promise(resolve => setTimeout(resolve, 0)); lastYield = performance.now(); }
    }
    renderDoc.body.getBoundingClientRect();
    await Promise.race([renderDoc.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]);
    if (valid() && job.run === generation) {
      publish(frame, renderDoc, job);
      status(furiganaFailed ? 'Terhubung. Furigana belum siap; matikan lalu nyalakan Furigana untuk mencoba lagi.' : 'Terhubung. Scroll dan klik mengikuti halaman asli.');
    }
  } catch (error) {
    if (job.run === generation && currentTranslator === translator && !ended) {
      status(`Terjemahan terhenti: ${error.message}. Klik Terjemahkan untuk mencoba lagi.`, true);
      if (!displayedSnapshot) $('render-loading').textContent = 'Terjemahan belum siap. Klik Terjemahkan untuk mencoba lagi.';
    }
  } finally { translating = false; if (pendingRender && !ended) translatePage(); }
}
$('activate').addEventListener('click', activate);
$('translate').addEventListener('click', activate);
$('target').addEventListener('change', () => {
  settings.targetLanguage = $('target').value;
  selectionTranslation.destroy();
  generation++; pendingRender = undefined; requestedKey = ''; translator?.destroy(); translator = undefined; translatorPair = undefined;
  updateLabels(); send({ type: 'km:save', settings });
  $('welcome').classList.remove('hidden');
  $('setup-status').textContent = 'Klik untuk mengaktifkan bahasa yang dipilih.';
});
for (const [id, key] of [['scroll','syncScroll'], ['click','syncClick']]) $(id).addEventListener('change', () => { settings[key] = $(id).checked; send({ type: 'km:save', settings }); if (id === 'scroll' && settings.syncScroll) command({ action: 'capture' }); });
$('furigana').addEventListener('change', () => {
  settings.showFurigana = $('furigana').checked;
  send({ type: 'km:save', settings });
  if (translator) render();
});
$('refresh').addEventListener('click', () => { forceNextRender = true; command({ action: 'capture' }); });
$('close').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'km:stop' }));
window.addEventListener('beforeunload', () => { ended = true; pendingRender = undefined; interactionListeners?.abort(); translator?.destroy(); KotobaFurigana.destroy(); selectionTranslation.destroy(); clearTimeout(reconnectTimer); });
updateLabels(); connect();
