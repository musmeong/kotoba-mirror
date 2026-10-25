// Tokenization stays in a dedicated worker so dictionary loading cannot freeze the mirror.
importScripts('vendor/kuromoji/kuromoji.js');
let tokenizerReady;
self.onmessage = async ({ data: { id, text } }) => {
  try {
    tokenizerReady ||= new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: 'vendor/kuromoji/dict/' }).build((error, tokenizer) => error ? reject(error) : resolve(tokenizer));
    });
    const tokenizer = await tokenizerReady;
    const tokens = tokenizer.tokenize(text).map(token => ({ surface: token.surface_form, reading: token.reading }));
    self.postMessage({ id, tokens });
  } catch (error) { self.postMessage({ id, error: error.message || 'Kamus furigana tidak dapat dibaca.' }); }
};
