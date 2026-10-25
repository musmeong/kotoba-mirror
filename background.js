// One live source page, one inert translated mirror. No second site session.
let mirrorPort;
let launching = false;
const sessionKey = 'kotobaSession';
const session = async () => (await chrome.storage.session.get(sessionKey))[sessionKey];
const post = (message) => { try { mirrorPort?.postMessage(message); } catch { mirrorPort = undefined; } };
const isUI = (sender) => sender.id === chrome.runtime.id &&
  [chrome.runtime.getURL('popup.html'), chrome.runtime.getURL('mirror.html')].some(url => sender.url?.split('?')[0] === url);

async function restore(record) {
  if (!record) return;
  try {
    await chrome.tabs.sendMessage(record.sourceTabId, { type: 'km:detach' });
  } catch { /* The source may already be closed. */ }
  try {
    await chrome.windows.update(record.sourceWindowId, { state: 'normal' });
    await chrome.windows.update(record.sourceWindowId, record.oldBounds);
    if (record.oldState !== 'normal') await chrome.windows.update(record.sourceWindowId, { state: record.oldState });
  } catch { /* Closing a source window also ends the session. */ }
}

async function stop(closeMirror = true) {
  const record = await session();
  await chrome.storage.session.remove(sessionKey);
  post({ type: 'km:ended', error: 'Sesi selesai. Buka extension dari halaman yang ingin dipelajari.' });
  mirrorPort = undefined;
  await restore(record);
  if (closeMirror && record?.mirrorWindowId) {
    try { await chrome.windows.remove(record.mirrorWindowId); } catch { /* Already closed. */ }
  }
}

async function inject(sourceTabId) {
  await chrome.scripting.executeScript({ target: { tabId: sourceTabId }, files: ['scroll-sync.js','source.js'] });
  await chrome.tabs.sendMessage(sourceTabId, { type: 'km:capture' });
}

async function start(message) {
  if (launching) throw new Error('Jendela sedang disiapkan.');
  launching = true;
  try {
    await stop();
    const tab = await chrome.tabs.get(message.tabId);
    if (!/^https?:\/\//.test(tab.url || '')) throw new Error('Buka situs HTTP/HTTPS dulu. Halaman chrome:// dan PDF bawaan tidak didukung.');
    await chrome.tabs.update(tab.id, { active: true });
    // Check access before moving any windows.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scroll-sync.js','source.js'] });
    const win = await chrome.windows.get(tab.windowId);
    const bounds = message.bounds;
    if (!bounds || !['left', 'top', 'width', 'height'].every(k => Number.isFinite(bounds[k]))) throw new Error('Ukuran layar tidak terbaca.');
    const width = Math.max(1000, Math.round(bounds.width));
    const half = Math.floor(width / 2);
    const record = {
      sourceTabId: tab.id, sourceWindowId: win.id, origin: new URL(tab.url).origin,
      oldBounds: { left: win.left, top: win.top, width: win.width, height: win.height }, oldState: win.state,
      settings: message.settings
    };
    await chrome.storage.session.set({ [sessionKey]: record });
    try {
      await chrome.windows.update(win.id, { state: 'normal' });
      await chrome.windows.update(win.id, { left: Math.round(bounds.left) + half, top: Math.round(bounds.top), width: width - half, height: Math.round(bounds.height) });
      const mirror = await chrome.windows.create({
        url: chrome.runtime.getURL(`mirror.html?source=${tab.id}`), type: 'popup', focused: true,
        left: Math.round(bounds.left), top: Math.round(bounds.top), width: half, height: Math.round(bounds.height)
      });
      await chrome.windows.update(mirror.id, { left: Math.round(bounds.left), top: Math.round(bounds.top), width: half, height: Math.round(bounds.height) });
      record.mirrorWindowId = mirror.id;
      await chrome.storage.session.set({ [sessionKey]: record });
      await inject(tab.id);
    } catch (error) {
      await stop();
      throw error;
    }
    return { ok: true };
  } finally { launching = false; }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  (async () => {
    if (message?.type === 'km:start' && isUI(sender)) return start(message);
    if (message?.type === 'km:stop' && isUI(sender)) { await stop(); return { ok: true }; }
    if (message?.type === 'km:source') {
      const record = await session();
      if (sender.tab?.id === record?.sourceTabId && sender.frameId === 0) post(message.payload);
      return { ok: true };
    }
    return { ok: false };
  })().then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'km:mirror' || !isUI(port.sender)) return;
  mirrorPort = port;
  port.onDisconnect.addListener(() => { if (mirrorPort === port) mirrorPort = undefined; });
  port.onMessage.addListener(async message => {
    try {
      const record = await session();
      if (!record || message.sourceTabId !== record.sourceTabId) {
        port.postMessage({ type: 'km:ended', error: 'Halaman asli sudah ditutup. Mulai lagi dari ikon extension.' });
        return;
      }
      if (message.type === 'km:hello') {
        port.postMessage({ type: 'km:settings', settings: record.settings });
        await inject(record.sourceTabId);
      } else if (message.type === 'km:command') {
        const allowed = ['scroll', 'click', 'capture', 'focus'];
        if (!allowed.includes(message.command?.action)) return;
        await chrome.tabs.sendMessage(record.sourceTabId, { type: 'km:command', ...message.command });
      } else if (message.type === 'km:save') {
        record.settings = message.settings;
        await chrome.storage.session.set({ [sessionKey]: record });
        await chrome.storage.local.set({ settings: record.settings });
      }
    } catch (error) {
      post({ type: 'km:error', error: 'Koneksi terputus. Klik ikon extension di halaman asli untuk menyambungkan lagi.', detail: error.message });
    }
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (change.status !== 'complete') return;
  const record = await session();
  if (tabId !== record?.sourceTabId) return;
  try { await inject(tabId); }
  catch { post({ type: 'km:error', error: 'Situs berpindah domain atau akses ditolak. Buka ikon extension di halaman asli untuk memulai lagi.' }); }
});
chrome.tabs.onRemoved.addListener(async tabId => {
  if (tabId === (await session())?.sourceTabId) await stop(false);
});
chrome.windows.onRemoved.addListener(async windowId => {
  if (windowId === (await session())?.mirrorWindowId) await stop(false);
});
