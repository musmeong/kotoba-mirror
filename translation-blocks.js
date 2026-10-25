// Keep inline emphasis, links, and code inside the sentence sent to the translator.
globalThis.KotobaBlocks = (() => {
  const blocks = 'p,h1,h2,h3,h4,h5,h6,li,button,summary,label,td,th,figcaption,blockquote,div';
  const inline = new Set('A ABBR B BDI BDO BR CITE DEL EM I MARK Q S SMALL SPAN STRONG SUB SUP TIME U WBR'.split(' '));
  const protectedTags = new Set('CODE KBD SAMP IMG SVG MATH'.split(' '));
  const clean = text => text.replace(/&(?:amp;)?(?:#x0*(?:20|a0)|#0*(?:32|160)|nbsp);/gi, ' ');
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  function eligible(root, skipped) {
    for (const child of root.children) {
      if (protectedTags.has(child.tagName) || child.matches(skipped)) continue;
      if (!inline.has(child.tagName) || !eligible(child, skipped)) return false;
    }
    return true;
  }
  function unitFor(root, node, skipped) {
    const slots = new Map();
    function retryText(current) {
      if (current.nodeType === Node.TEXT_NODE) return clean(current.data);
      if (current.nodeType !== Node.ELEMENT_NODE) return '';
      if (protectedTags.has(current.tagName) || current.matches(skipped)) return ' ';
      return [...current.childNodes].map(retryText).join('');
    }
    function serialize(current) {
      if (current.nodeType === Node.TEXT_NODE) return escape(clean(current.data));
      if (current.nodeType !== Node.ELEMENT_NODE) return '';
      const protectedContent = protectedTags.has(current.tagName) || current.matches(skipped);
      const id = String(slots.size), tag = inline.has(current.tagName) || current.tagName === 'CODE' ? current.localName : 'span';
      slots.set(id, { node: current, tag, protectedContent });
      const content = protectedContent ? escape(current.textContent || current.getAttribute('alt') || '') : [...current.childNodes].map(serialize).join('');
      return `<${tag} data-km-slot="${id}">${['br', 'wbr'].includes(tag) ? '' : content + `</${tag}>`}`;
    }
    const original = clean(node ? node.data : root.textContent);
    const input = node ? original.trim() : [...root.childNodes].map(serialize).join('').trim();
    const fallbackText = node ? original.trim() : [...root.childNodes].map(retryText).join('').trim();
    return { root, node, original, text: original.trim(), input, slots, fallbackText };
  }
  function collect(doc, skipped) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.data.trim() && !node.parentElement.closest(skipped) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const units = [], seen = new Set();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      let root = node.parentElement.closest(blocks);
      if (!root || !eligible(root, skipped)) root = null;
      if (root) {
        if (!seen.has(root)) { seen.add(root); units.push(unitFor(root, null, skipped)); }
      } else units.push(unitFor(node.parentElement, node, skipped));
    }
    return units;
  }
  function richFragment(unit, html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    if (parsed.head.children.length) return null;
    const seen = new Set(), doc = unit.root.ownerDocument;
    function rebuild(current) {
      if (current.nodeType === Node.TEXT_NODE) return doc.createTextNode(clean(current.data));
      if (current.nodeType !== Node.ELEMENT_NODE) throw new Error('Unexpected markup.');
      const id = current.getAttribute('data-km-slot'), slot = unit.slots.get(id);
      if (!slot || seen.has(id) || current.localName !== slot.tag) throw new Error('Inline formatting was not preserved.');
      seen.add(id);
      // Copy only the original sanitized element. Never trust returned attributes or URLs.
      const copy = slot.node.cloneNode(slot.protectedContent);
      if (!slot.protectedContent) for (const child of current.childNodes) copy.append(rebuild(child));
      return copy;
    }
    try {
      const fragment = doc.createDocumentFragment();
      for (const child of parsed.body.childNodes) fragment.append(rebuild(child));
      if (seen.size !== unit.slots.size) return null;
      if (doc.documentElement.lang === 'ja') {
        // Japanese emphasis tags do not need the English word-separating spaces.
        const walker = doc.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
        let previous;
        const japanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.parentElement?.closest('code,kbd,samp,[translate="no"]')) { previous = undefined; continue; }
          if (!node.data.trim()) continue;
          if (previous && japanese.test(previous.data.trimEnd().slice(-1)) && japanese.test(node.data.trimStart().slice(0, 1))) {
            previous.data = previous.data.trimEnd(); node.data = node.data.trimStart();
          }
          previous = node;
        }
      }
      return fragment;
    } catch { return null; }
  }
  function apply(unit, translated) {
    translated = clean(translated);
    unit.root.title ||= unit.text;
    if (unit.node) {
      unit.node.data = unit.original.replace(unit.text, () => translated);
      return { scope: unit.node, fallback: false };
    }
    if (unit.slots.size) {
      const fragment = richFragment(unit, translated);
      if (!fragment) return null;
      unit.root.replaceChildren(fragment);
    } else unit.root.replaceChildren(unit.root.ownerDocument.createTextNode(translated));
    return { scope: unit.root, fallback: false };
  }
  function fallback(unit, translated) {
    // Replace all source prose even when the model damages formatting. Preserve
    // code/media separately and retain link actions without their English labels.
    const doc = unit.root.ownerDocument, plain = doc.createTextNode(clean(translated));
    const preserved = [...unit.slots.values()].filter(slot => slot.protectedContent).map(slot => slot.node.cloneNode(true));
    const links = [...unit.slots.values()].filter(slot => slot.node.tagName === 'A' && !slot.protectedContent).map(slot => {
      const link = slot.node.cloneNode(false);
      link.textContent = '↗';
      link.title = slot.node.textContent.trim();
      link.setAttribute('aria-label', doc.documentElement.lang === 'ja' ? 'リンクを開く' : 'Buka tautan');
      return link;
    });
    unit.root.replaceChildren(plain);
    for (const element of [...preserved, ...links]) unit.root.append(doc.createTextNode(' '), element);
    unit.root.title ||= unit.text;
    return { scope: plain, fallback: true };
  }
  function chunks(text, language, limit = 2400) {
    const result = [];
    let current = '';
    for (const { segment } of new Intl.Segmenter(language, { granularity: 'sentence' }).segment(text)) {
      if (current.length + segment.length > limit && current) { result.push(current); current = ''; }
      if (segment.length <= limit) current += segment;
      else {
        // Only an individual overlong sentence needs a word-boundary split.
        let rest = segment;
        while (rest.length > limit) {
          const space = rest.lastIndexOf(' ', limit);
          const cut = space > limit / 2 ? space + 1 : limit;
          result.push(rest.slice(0, cut)); rest = rest.slice(cut);
        }
        current = rest;
      }
    }
    if (current) result.push(current);
    return result;
  }
  return { collect, apply, fallback, chunks, clean };
})();
