globalThis.KotobaFurigana = (() => {
  let worker, nextId = 0;
  const pending = new Map(), cache = new Map();
  const hasKanji = text => /\p{Script=Han}/u.test(text);
  const hiragana = text => text.replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
  function destroy() {
    worker?.terminate(); worker = undefined;
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(new Error('Kamus furigana dihentikan.')); }
    pending.clear(); cache.clear();
  }
  function tokenize(text) {
    if (cache.has(text)) return Promise.resolve(cache.get(text));
    if (!worker) {
      worker = new Worker(chrome.runtime.getURL('furigana-worker.js'));
      worker.onmessage = ({ data }) => {
        const task = pending.get(data.id);
        if (!task) return;
        clearTimeout(task.timer); pending.delete(data.id);
        if (data.error) task.reject(new Error(data.error));
        else {
          if (cache.size >= 3000) cache.delete(cache.keys().next().value);
          cache.set(task.text, data.tokens); task.resolve(data.tokens);
        }
      };
      worker.onerror = event => {
        event.preventDefault();
        destroy();
      };
    }
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Menyiapkan furigana terlalu lama. Coba matikan lalu nyalakan lagi.')); }, 30000);
      pending.set(id, { resolve, reject, timer, text });
      worker.postMessage({ id, text });
    });
  }
  function fragment(doc, tokens) {
    const result = doc.createDocumentFragment();
    for (const token of tokens) {
      const surface = token.surface;
      let reading = hiragana(token.reading || '');
      if (!hasKanji(surface) || !/^[ぁ-ゖー]+$/.test(reading)) { result.append(doc.createTextNode(surface)); continue; }
      let base = surface, prefix = '', suffix = '';
      // Leave leading kana and okurigana outside the ruby when they match the reading.
      const leading = base.match(/^[ぁ-ゖー]+/)?.[0];
      if (leading && reading.startsWith(leading)) { prefix = leading; base = base.slice(leading.length); reading = reading.slice(leading.length); }
      const trailing = base.match(/[ぁ-ゖー]+$/)?.[0];
      if (trailing && reading.endsWith(trailing)) { suffix = trailing; base = base.slice(0, -trailing.length); reading = reading.slice(0, -trailing.length); }
      if (!reading) { result.append(doc.createTextNode(surface)); continue; }
      const ruby = doc.createElement('ruby');
      ruby.setAttribute('data-km-furigana', '');
      ruby.append(doc.createTextNode(base));
      const rt = doc.createElement('rt'); rt.textContent = reading; ruby.append(rt);
      result.append(doc.createTextNode(prefix), ruby, doc.createTextNode(suffix));
    }
    return result;
  }
  async function annotate(node, stillValid = () => true) {
    const original = node.data;
    if (!hasKanji(original)) return;
    const tokens = await tokenize(original);
    if (!node.isConnected || node.data !== original || !stillValid()) return;
    // Preserve unknown characters and whitespace exactly; never guess a missing reading.
    if (tokens.map(token => token.surface).join('') !== original) return;
    node.replaceWith(fragment(node.ownerDocument, tokens));
  }
  return { annotate, destroy };
})();
