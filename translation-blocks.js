// Keep inline emphasis, links, and code inside the sentence sent to the translator.
globalThis.KotobaBlocks = (() => {
  const blocks = 'p,h1,h2,h3,h4,h5,h6,li,button,summary,label,td,th,figcaption,blockquote,div';
  const inline = new Set('A ABBR B BDI BDO BR CITE DEL EM I MARK Q S SMALL SPAN STRONG SUB SUP TIME U WBR'.split(' '));
  const protectedTags = new Set('CODE KBD SAMP TT IMG SVG MATH'.split(' '));
  const isProtected = (node, skipped) => protectedTags.has(node.tagName) || node.hasAttribute('data-km-code') || node.matches(skipped);
  const clean = text => text.replace(/&(?:amp;)?(?:#x0*(?:20|a0)|#0*(?:32|160)|nbsp);/gi, ' ');
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  function eligible(root, skipped) {
    for (const child of root.children) {
      if (isProtected(child, skipped)) continue;
      if (!inline.has(child.tagName) || !eligible(child, skipped)) return false;
    }
    return true;
  }
  function unitFor(root, node, skipped) {
    const slots = new Map();
    function serialize(current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const text = escape(clean(current.data));
        return { input: text, retry: text };
      }
      if (current.nodeType !== Node.ELEMENT_NODE) return { input: '', retry: '' };
      const protectedContent = isProtected(current, skipped);
      const id = String(slots.size);
      const tag = current.hasAttribute('data-km-code') ? 'code' :
        inline.has(current.tagName) || ['CODE', 'KBD', 'SAMP', 'TT'].includes(current.tagName) ? current.localName : 'span';
      const retryTag = tag === 'strong' ? 'b' : tag === 'em' ? 'i' : tag;
      slots.set(id, { node: current, tag, retryTag, protectedContent });
      const children = protectedContent ? [{ input: escape(current.textContent || current.getAttribute('alt') || ''), retry: escape(current.textContent || current.getAttribute('alt') || '') }] : [...current.childNodes].map(serialize);
      // Attribute-free, numbered tags survive the local model more reliably than
      // long data attributes. A different, minimal HTML encoding is the retry.
      return {
        input: `<${tag}${id}>${children.map(child => child.input).join('')}</${tag}${id}>`,
        retry: `<${retryTag} id="${id}">${['br', 'wbr'].includes(tag) ? '' : children.map(child => child.retry).join('') + `</${retryTag}>`}`
      };
    }
    const original = clean(node ? node.data : root.textContent);
    const children = node ? [] : [...root.childNodes].map(serialize);
    const input = node ? original.trim() : children.map(child => child.input).join('').trim();
    const fallbackInput = node ? original.trim() : children.map(child => child.retry).join('').trim();
    return { root, node, original, text: original.trim(), input, slots, fallbackInput };
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
      const numbered = /^([a-z]+)(\d+)$/.exec(current.localName);
      const id = numbered ? numbered[2] : current.getAttribute('id') ?? current.getAttribute('data-km-slot');
      const tag = numbered ? numbered[1] : current.localName, slot = unit.slots.get(id);
      if (!slot || seen.has(id) || ![slot.tag, slot.retryTag].includes(tag)) throw new Error('Inline formatting was not preserved.');
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
          if (node.parentElement?.closest('code,kbd,samp,tt,[data-km-code],[translate="no"]')) { previous = undefined; continue; }
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
    const applied = apply(unit, translated);
    if (!applied) throw new Error('Format asli belum dapat dipertahankan');
    return { ...applied, fallback: true };
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
