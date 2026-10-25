(() => {
  if (globalThis.__kotobaSource) { globalThis.__kotobaSource.attach(); return; }
  const ids = new WeakMap();
  let nodes = new Map(), nextId = 0, timer, maxTimer, frame, attached = false;
  const suppressed = new Map(), pendingScrolls = new Map();
  const blocked = new Set(['SCRIPT','NOSCRIPT','OBJECT','EMBED','BASE','META','TEMPLATE']);
  const idFor = node => {
    if (!ids.has(node)) ids.set(node, `k${++nextId}`);
    return ids.get(node);
  };
  function send(payload) {
    if (!attached) return;
    chrome.runtime.sendMessage({ type: 'km:source', payload }).catch(() => detach());
  }
  function absolute(value) {
    try { const url = new URL(value, document.baseURI); return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  }
  function cssURLs(css) {
    return css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (all, quote, url) => url.startsWith('#') ? all : `url("${absolute(url).replaceAll('"', '%22')}")`)
      .replace(/@import\s+(['"])([^'"]+)\1/gi, (all, quote, url) => `@import "${absolute(url)}"`);
  }
  function clone(node, doc, map) {
    if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.data);
    if (node.nodeType !== Node.ELEMENT_NODE || blocked.has(node.tagName)) return null;
    if (node.tagName === 'LINK' && !node.relList.contains('stylesheet')) return null;
    const id = idFor(node);
    map.set(id, node);
    if (['IFRAME','FRAME','CANVAS','VIDEO','AUDIO'].includes(node.tagName) || node.shadowRoot) {
      const placeholder = doc.createElement('div');
      placeholder.setAttribute('data-km-id', id);
      placeholder.textContent = 'Konten interaktif — gunakan halaman asli di kanan';
      placeholder.setAttribute('translate', 'no');
      placeholder.style.cssText = 'padding:18px;background:#edf5f7;border:1px dashed #94b5c0;color:#31525c;font:13px/1.5 sans-serif;';
      return placeholder;
    }
    const copy = doc.createElementNS(node.namespaceURI, node.localName);
    for (const attr of node.attributes) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name.startsWith('data-km-') || ['srcdoc','nonce','integrity','autofocus','formaction','action','ping','is','srcset'].includes(name)) continue;
      let value = attr.value;
      if (['href','src','xlink:href','poster','background'].includes(name)) value = value.startsWith('#') ? value : absolute(value);
      if (name === 'style') value = cssURLs(value);
      try { copy.setAttribute(attr.name, value); } catch { /* Invalid site attributes are omitted. */ }
    }
    copy.setAttribute('data-km-id', id);
    if (node.tagName === 'IMG' && node.currentSrc) copy.setAttribute('src', absolute(node.currentSrc));
    if (node.tagName === 'STYLE') {
      let css = node.textContent;
      if (!css && node.sheet) { try { css = Array.from(node.sheet.cssRules, rule => rule.cssText).join('\n'); } catch { /* Cross-origin sheets use their link. */ } }
      copy.textContent = cssURLs(css);
    } else if (node.tagName !== 'TEXTAREA') {
      for (const child of node.childNodes) { const result = clone(child, doc, map); if (result) copy.append(result); }
    }
    if (node instanceof HTMLInputElement) {
      const secret = ['password','file','hidden'].includes(node.type);
      copy.setAttribute('value', secret ? '' : node.value);
      copy.toggleAttribute('checked', node.checked);
      copy.setAttribute('readonly', '');
    }
    if (node instanceof HTMLTextAreaElement) { copy.textContent = node.value; copy.setAttribute('readonly', ''); }
    if (node instanceof HTMLOptionElement) copy.toggleAttribute('selected', node.selected);
    if (node.isContentEditable) { copy.setAttribute('contenteditable', 'false'); copy.setAttribute('data-km-editor', ''); }
    return copy;
  }
  function scrollState(target = document.scrollingElement) {
    const root = !target || target === document || target === document.documentElement || target === document.body;
    const el = root ? document.scrollingElement : target;
    const rect = root ? { left: 0, top: 0 } : el.getBoundingClientRect();
    const height = root ? innerHeight : el.clientHeight;
    const width = root ? innerWidth : el.clientWidth;
    const anchor = document.elementFromPoint(Math.max(1, rect.left + width * .4), Math.max(1, rect.top + Math.min(64, height * .15)));
    return { id: root ? null : idFor(el), x: el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth),
      y: el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight),
      anchor: anchor && el.contains(anchor) && anchor !== el ? idFor(anchor) : null,
      offset: anchor ? (anchor.getBoundingClientRect().top - rect.top) / Math.max(1, height) : 0 };
  }
  function capture() {
    clearTimeout(timer); clearTimeout(maxTimer); timer = maxTimer = undefined;
    if (!attached || !document.body) return;
    try {
      const doc = document.implementation.createHTMLDocument('');
      const map = new Map();
      const html = clone(document.documentElement, doc, map);
      for (const sheet of document.adoptedStyleSheets || []) {
        const style = doc.createElement('style');
        style.textContent = cssURLs(Array.from(sheet.cssRules, rule => rule.cssText).join('\n'));
        html.querySelector('head')?.append(style);
      }
      nodes = map;
      const scrolls = [scrollState()];
      for (const [id, node] of map) {
        if (node !== document.scrollingElement && node !== document.body && (node.scrollTop || node.scrollLeft)) scrolls.push({ ...scrollState(node), id });
      }
      send({ type: 'km:snapshot', html: '<!doctype html>' + html.outerHTML, url: location.href, title: document.title, scrolls });
    } catch (error) { send({ type: 'km:error', error: `Halaman belum dapat disalin: ${error.message}` }); }
  }
  function schedule() {
    if (!attached) return;
    clearTimeout(timer); timer = setTimeout(capture, 450);
    if (!maxTimer) maxTimer = setTimeout(capture, 1800);
  }
  function onScroll(event) {
    if (!attached) return;
    const target = event.target;
    const state = scrollState(target);
    if (performance.now() < (suppressed.get(state.id) || 0)) return;
    pendingScrolls.set(state.id, state);
    if (!frame) frame = setTimeout(() => {
      frame = undefined;
      for (const state of pendingScrolls.values()) send({ type: 'km:scroll', state });
      pendingScrolls.clear();
    }, 32);
  }
  const observer = new MutationObserver(schedule);
  function attach() {
    if (attached) return;
    attached = true;
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    document.addEventListener('click', schedule, true);
    window.addEventListener('resize', schedule);
  }
  function detach() {
    attached = false; observer.disconnect(); clearTimeout(timer); clearTimeout(maxTimer); clearTimeout(frame); frame = undefined; pendingScrolls.clear();
    document.removeEventListener('scroll', onScroll, true);
    document.removeEventListener('input', schedule, true);
    document.removeEventListener('change', schedule, true);
    document.removeEventListener('click', schedule, true);
    window.removeEventListener('resize', schedule);
    nodes.clear();
  }
  function applyScroll(state) {
    const el = state.id ? nodes.get(state.id) : document.scrollingElement;
    if (!el || !Number.isFinite(state.y) || !Number.isFinite(state.x)) return;
    suppressed.set(state.id, performance.now() + 160);
    const rectTop = state.id ? el.getBoundingClientRect().top : 0;
    const anchor = nodes.get(state.anchor);
    const height = state.id ? el.clientHeight : innerHeight;
    const y = anchor && el.contains(anchor) && anchor !== el ? el.scrollTop + anchor.getBoundingClientRect().top - rectTop - state.offset * height : state.y * (el.scrollHeight - el.clientHeight);
    el.scrollTo({ top: Math.max(0, y), left: Math.max(0, state.x * (el.scrollWidth - el.clientWidth)), behavior: 'instant' });
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === 'km:detach') detach();
    if (message.type === 'km:capture') { attach(); capture(); }
    if (message.type === 'km:command') {
      if (message.action === 'capture') capture();
      if (message.action === 'scroll') applyScroll(message.state);
      if (message.action === 'click' || message.action === 'focus') {
        const target = nodes.get(message.id);
        if (target?.isConnected) {
          if (message.action === 'focus') target.focus?.({ preventScroll: true });
          else {
            const control = target.closest('input,textarea,select,[contenteditable="true"]');
            if (control && !['checkbox','radio','button','submit','reset'].includes(control.type)) control.focus();
            else if (typeof target.click === 'function') target.click();
            else target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
          schedule();
        }
      }
    }
    respond({ ok: true });
  });
  globalThis.__kotobaSource = { attach };
  attach();
})();
