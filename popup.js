const $ = id => document.getElementById(id);
function updatePreview() {
  for (const id of ['source', 'target']) $(id + '-preview').textContent = $(id).selectedOptions[0]?.label.split(' — ')[0] || '';
}
for (const id of ['source', 'target']) $(id).addEventListener('change', updatePreview);
(async () => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  KotobaFillLanguages($('source'), settings.sourceLanguage || 'en');
  KotobaFillLanguages($('target'), settings.targetLanguage || 'ja');
  $('scroll').checked = settings.syncScroll !== false;
  $('click').checked = settings.syncClick !== false;
  $('furigana').checked = settings.showFurigana !== false;
  updatePreview();
})();
$('start').addEventListener('click', async () => {
  const button = $('start');
  button.disabled = true;
  try {
    const settings = { sourceLanguage: $('source').value, targetLanguage: $('target').value, syncScroll: $('scroll').checked, syncClick: $('click').checked, showFurigana: $('furigana').checked };
    if (settings.sourceLanguage === settings.targetLanguage) throw new Error('Pilih dua bahasa yang berbeda.');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.storage.local.set({ settings });
    const result = await chrome.runtime.sendMessage({ type: 'km:start', tabId: tab.id, settings,
      bounds: { left: screen.availLeft || 0, top: screen.availTop || 0, width: screen.availWidth, height: screen.availHeight } });
    if (!result?.ok) throw new Error(result?.error || 'Jendela belum bisa dibuka.');
    window.close();
  } catch (error) { $('status').textContent = error.message; }
  finally { button.disabled = false; }
});
