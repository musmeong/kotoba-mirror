globalThis.KotobaLanguages = [
  ['en', 'English'], ['ja', '日本語 — Jepang'], ['id', 'Bahasa Indonesia'], ['ko', '한국어 — Korea'],
  ['zh', '中文 — Mandarin'], ['zh-Hant', '中文 — Tradisional'], ['ar', 'العربية — Arab'],
  ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français'], ['it', 'Italiano'], ['pt', 'Português'],
  ['ru', 'Русский'], ['th', 'ไทย'], ['vi', 'Tiếng Việt'], ['nl', 'Nederlands'], ['hi', 'हिन्दी'],
  ['tr', 'Türkçe'], ['pl', 'Polski'], ['uk', 'Українська']
];
globalThis.KotobaFillLanguages = function (select, selected) {
  for (const [value, label] of KotobaLanguages) select.add(new Option(label, value));
  select.value = selected;
};
