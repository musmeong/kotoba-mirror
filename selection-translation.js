// Translate only the selected base text. Ruby readings never enter the request.
globalThis.KotobaSelection = {
  create({ frame, getLanguages }) {
    const tooltip = document.getElementById('selection-tooltip');
    const original = document.getElementById('selection-original');
    const result = document.getElementById('selection-result');
    const label = document.getElementById('selection-label');
    const content = document.getElementById('selection-content');
    const hint = document.getElementById('selection-hint');
    let doc, listeners, range, selected = '', revision = 0, timer, hovered = false, point;
    let hideTimer, overTooltip = false, mode, hoverNode, hoverText = '';
    let reverseTranslator, reversePromise, reversePair, translatorEpoch = 0;
    const cache = new Map(), titles = new Map();
    function restoreTitles() {
      for (const [node, title] of titles) if (node.isConnected && !node.hasAttribute('title')) node.setAttribute('title', title);
      titles.clear();
    }
    function hide() {
      hovered = false; clearTimeout(timer); timer = undefined;
      clearTimeout(hideTimer); hideTimer = undefined;
      tooltip.hidden = true; restoreTitles();
    }
    function scheduleHide() {
      clearTimeout(timer); timer = undefined;
      if (!overTooltip && !hideTimer) hideTimer = setTimeout(hide, 350);
    }
    function reset() { revision++; range = undefined; selected = ''; mode = hoverNode = undefined; hoverText = ''; overTooltip = false; hide(); }
    function textOf(selectionRange) {
      const root = selectionRange.commonAncestorContainer;
      const nodes = [];
      if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
      else {
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) nodes.push(walker.currentNode);
      }
      const pieces = [];
      let previousBlock;
      for (const node of nodes) {
        if (node.parentElement?.closest('rt,rp,script,style,input,textarea,pre,code') || !selectionRange.intersectsNode(node)) continue;
        const start = node === selectionRange.startContainer ? selectionRange.startOffset : 0;
        const end = node === selectionRange.endContainer ? selectionRange.endOffset : node.length;
        const piece = node.data.slice(start, end);
        if (!piece) continue;
        const block = node.parentElement?.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,div');
        if (pieces.length && block !== previousBlock) pieces.push('\n');
        pieces.push(piece); previousBlock = block;
      }
      return pieces.join('').replace(/[ \t]*\n[ \t\r\n]*/g, '\n').trim();
    }
    function capture() {
      const selection = doc?.getSelection();
      if (overTooltip && !tooltip.hidden) return;
      if (!selection?.rangeCount || selection.isCollapsed) { reset(); return; }
      const nextRange = selection.getRangeAt(0);
      const text = textOf(nextRange);
      if (!text) { reset(); return; }
      if (range && selected === text && range.startContainer === nextRange.startContainer && range.startOffset === nextRange.startOffset && range.endContainer === nextRange.endContainer && range.endOffset === nextRange.endOffset) return;
      hide(); revision++; selected = text; range = nextRange.cloneRange();
    }
    function ensureTranslator() {
      const languages = getLanguages();
      if (!languages || !('Translator' in globalThis)) return Promise.reject(new Error('Aktifkan terjemahan halaman terlebih dahulu.'));
      const key = `${languages.sourceLanguage}:${languages.targetLanguage}`;
      if (reversePair === key && reversePromise) return reversePromise;
      reverseTranslator?.destroy(); reverseTranslator = undefined;
      reversePair = key;
      const epoch = ++translatorEpoch;
      // pointerup / keyup provides user activation if Chrome needs another language pack.
      reversePromise = Translator.create(languages).then(instance => {
        if (epoch !== translatorEpoch) { instance.destroy(); throw new Error('Bahasa sudah berubah. Blok ulang teks.'); }
        reverseTranslator = instance;
        return instance;
      }).catch(error => { if (epoch === translatorEpoch) reversePromise = undefined; throw error; });
      return reversePromise;
    }
    function position() {
      if (!point || tooltip.hidden) return;
      const frameRect = frame.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
      const x = frameRect.left + point.x, y = frameRect.top + point.y;
      tooltip.style.left = `${Math.max(8, Math.min(x + 12, innerWidth - box.width - 8))}px`;
      const below = y + 18;
      tooltip.style.top = `${Math.max(8, below + box.height <= innerHeight - 8 ? below : y - box.height - 12)}px`;
      hint.textContent = content.scrollHeight > content.clientHeight + 1 ? 'Gulir untuk membaca selengkapnya · Esc untuk menutup' : 'Esc untuk menutup';
    }
    async function show() {
      timer = undefined;
      if (!hovered || !mode) return;
      if (mode === 'original') {
        original.hidden = true;
        label.textContent = `Teks asli · ${getLanguages()?.targetLanguage || ''}`;
        result.classList.remove('error'); result.textContent = hoverText;
        content.scrollTop = 0; tooltip.hidden = false; position();
        return;
      }
      if (!range || !selected) return;
      const current = revision, text = selected, languages = getLanguages();
      if (!languages) return;
      const key = JSON.stringify([languages.sourceLanguage, languages.targetLanguage, text]);
      original.textContent = text;
      original.hidden = false;
      label.textContent = `Arti teks pilihan · ${languages.sourceLanguage} → ${languages.targetLanguage}`;
      result.classList.remove('error');
      result.textContent = text.length > 2000 ? 'Pilih maksimal 2.000 karakter agar terjemahannya tetap fokus.' : 'Menerjemahkan bagian ini…';
      content.scrollTop = 0; tooltip.hidden = false; position();
      if (text.length > 2000) return;
      try {
        let translated = cache.get(key);
        if (!translated) {
          const translator = await ensureTranslator();
          translated = await translator.translate(text);
          if (cache.size >= 200) cache.delete(cache.keys().next().value);
          cache.set(key, translated);
        }
        if (current !== revision || mode !== 'selection' || (!hovered && !overTooltip) || tooltip.hidden) return;
        result.textContent = translated; position();
      } catch (error) {
        if (current !== revision || mode !== 'selection' || (!hovered && !overTooltip) || tooltip.hidden) return;
        result.classList.add('error');
        result.textContent = error.name === 'NotAllowedError' ? 'Blok ulang teks untuk mengaktifkan penerjemah, lalu arahkan pointer ke pilihanmu.' : `Belum bisa menerjemahkan bagian ini. ${error.message}`;
        position();
      }
    }
    function move(event) {
      point = { x: event.clientX, y: event.clientY };
      const inside = range && [...range.getClientRects()].some(rect => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
      if (inside) {
        if (mode !== 'selection') { hide(); revision++; mode = 'selection'; }
      } else {
        if (selected || !getLanguages()) { scheduleHide(); return; }
        let match;
        for (let node = event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement; node; node = node.parentElement) {
          const text = titles.get(node) ?? node.getAttribute('title');
          if (text?.trim()) { match = { node, text }; break; }
        }
        if (!match) { scheduleHide(); return; }
        if (mode !== 'original' || hoverNode !== match.node || hoverText !== match.text) {
          hide(); revision++; mode = 'original'; hoverNode = match.node; hoverText = match.text;
        }
      }
      clearTimeout(hideTimer); hideTimer = undefined;
      hovered = true;
      // Prevent the old whole-paragraph browser title from covering the precise tooltip.
      for (let node = event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement; node; node = node.parentElement) {
        if (node.hasAttribute('title')) { titles.set(node, node.getAttribute('title')); node.removeAttribute('title'); }
      }
      if (!tooltip.hidden) position();
      else if (!timer) timer = setTimeout(show, 320);
    }
    function select(event) {
      capture();
      if (selected && selected.length <= 2000 && getLanguages()) ensureTranslator().catch(() => {});
      if (event.type === 'pointerup') move(event);
    }
    function bind(nextDoc, nextFrame) {
      listeners?.abort(); reset(); doc = nextDoc; listeners = new AbortController();
      if (nextFrame) frame = nextFrame;
      const options = { capture: true, signal: listeners.signal };
      doc.addEventListener('selectionchange', capture, options);
      doc.addEventListener('pointerup', select, options);
      doc.addEventListener('dragstart', event => event.preventDefault(), options);
      doc.addEventListener('keyup', event => { if (event.key !== 'Escape') select(event); }, options);
      doc.addEventListener('pointermove', move, options);
      doc.addEventListener('pointerout', event => { if (!event.relatedTarget) scheduleHide(); }, options);
      doc.addEventListener('scroll', hide, options);
      doc.addEventListener('keydown', event => { if (event.key === 'Escape') { doc.getSelection()?.removeAllRanges(); reset(); } }, options);
    }
    function destroy() {
      listeners?.abort(); reset(); translatorEpoch++;
      reverseTranslator?.destroy(); reverseTranslator = reversePromise = undefined;
      cache.clear();
    }
    function close() { doc?.getSelection()?.removeAllRanges(); reset(); }
    tooltip.addEventListener('pointerenter', () => { overTooltip = true; clearTimeout(hideTimer); hideTimer = undefined; });
    tooltip.addEventListener('pointerleave', () => { overTooltip = false; scheduleHide(); });
    document.getElementById('selection-close').addEventListener('click', close);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !tooltip.hidden) close(); });
    document.addEventListener('pointerdown', event => { if (!tooltip.contains(event.target)) hide(); });
    return { bind, reset, destroy, hasSelection: () => Boolean(doc?.getSelection()?.rangeCount && !doc.getSelection().isCollapsed) };
  }
};
