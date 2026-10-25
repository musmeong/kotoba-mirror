const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {root,scratch,browserOptions,testExtension}=require('./test-support.cjs');
const build=testExtension();
const wait=ms=>new Promise(r=>setTimeout(r,ms));const results=[],record=name=>{results.push(name);console.log('PASS',name);};
const server=http.createServer((req,res)=>{const file=path.join(root,path.basename(req.url)||'demo.html');if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.extname(file)==='.css'?'text/css':path.extname(file)==='.js'?'text/javascript':'text/html; charset=utf-8');fs.createReadStream(file).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const context=await chromium.launchPersistentContext(path.join(scratch,`stable-profile-${Date.now()}`),{...browserOptions(),headless:true,viewport:null,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  context.setDefaultTimeout(12000);const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:build});const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const source=await context.newPage();await source.goto(base+'/demo.html');await source.evaluate(()=>{
   document.title='Stable lesson';document.querySelector('main').innerHTML='<h1>Learning Python</h1><p id="watch">Original lesson paragraph.</p><button id="action">Continue</button><div style="height:1800px"></div>';
   globalThis.clicks=0;document.getElementById('action').addEventListener('click',()=>clicks++);
  });
  const sourceId=await worker.evaluate(async base=>(await chrome.tabs.query({})).find(t=>t.url?.startsWith(base)).id,base);
  const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
  const start=await popup.evaluate(tabId=>chrome.runtime.sendMessage({type:'km:start',tabId,settings:{sourceLanguage:'en',targetLanguage:'ja',syncScroll:true,syncClick:true,showFurigana:false},bounds:{left:screen.availLeft||0,top:screen.availTop||0,width:screen.availWidth,height:screen.availHeight}}),sourceId);assert(start.ok,JSON.stringify(start));
  let mirror;for(let i=0;i<100;i++){mirror=context.pages().find(p=>p.url().includes('mirror.html?'));if(mirror)break;await wait(50);}
  await mirror.waitForSelector('#site[title]');await mirror.bringToFront();
  await mirror.evaluate(()=>{
   globalThis.failTranslations=false;
   const phrases={'Learning Python':'Python を学ぶ','Original lesson paragraph.':'元のレッスンです。','Updated lesson paragraph.':'更新されたレッスンです。','First rapid update.':'最初の更新です。','Latest rapid update.':'最後の更新です。','Unavailable update.':'再試行したレッスンです。','Continue':'続ける'};
   globalThis.Translator={create:async()=>({translate:async text=>{await new Promise(r=>setTimeout(r,160));if(failTranslations&&text==='Unavailable update.')throw new Error('Delayed model failure');return phrases[text]||'学習の内容です。';},destroy(){}})};
   globalThis.viewSamples=[];globalThis.sampling=true;
   function sample(){
    if(!sampling)return;
    const frame=document.getElementById('mirror-frame'),d=frame?.contentDocument;
    if(document.getElementById('welcome').classList.contains('hidden'))viewSamples.push(d?.getElementById('watch')?.textContent||'');
    requestAnimationFrame(sample);
   }requestAnimationFrame(sample);
  });
  await mirror.locator('#activate').click();
  await mirror.waitForFunction(()=>document.querySelector('#mirror-frame').contentDocument.getElementById('watch')?.textContent==='元のレッスンです。');
  await mirror.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Terhubung.'));
  assert(!(await mirror.evaluate(()=>viewSamples)).some(text=>text==='Original lesson paragraph.'),'Initial render painted English before Japanese');
  record('First translated view never paints raw English during delayed translation');
  await mirror.evaluate(()=>{globalThis.keptDoc=document.querySelector('#mirror-frame').contentDocument;globalThis.keptNode=keptDoc.getElementById('watch');viewSamples=[];});
  await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'km:capture'}),sourceId);await wait(500);
  assert(await mirror.evaluate(()=>document.querySelector('#mirror-frame').contentDocument===keptDoc&&document.querySelector('#mirror-frame').contentDocument.getElementById('watch')===keptNode));
  record('Identical source snapshots keep the same visible document and nodes');
  await source.locator('#watch').evaluate(el=>{el.textContent='Updated lesson paragraph.';});
  await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'km:capture'}),sourceId);
  await wait(60);assert.equal(await mirror.locator('#mirror-frame').contentFrame().locator('#watch').textContent(),'元のレッスンです。');
  await mirror.locator('#mirror-frame').contentFrame().locator('#action').click();assert.equal(await source.evaluate(()=>clicks),0);
  record('Stale visible controls do not click into a newer untranslated source state');
  await mirror.waitForFunction(()=>document.querySelector('#mirror-frame').contentDocument.getElementById('watch')?.textContent==='更新されたレッスンです。');
  assert(!(await mirror.evaluate(()=>viewSamples)).some(text=>text==='Updated lesson paragraph.'||text==='Original lesson paragraph.'));
  record('Existing Japanese stays visible until the updated translation is ready');
  await mirror.evaluate(()=>{viewSamples=[];});
  await source.locator('#watch').evaluate(el=>{el.textContent='First rapid update.';});await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'km:capture'}),sourceId);
  await wait(40);
  await source.locator('#watch').evaluate(el=>{el.textContent='Latest rapid update.';});await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'km:capture'}),sourceId);
  await mirror.waitForFunction(()=>document.querySelector('#mirror-frame').contentDocument.getElementById('watch')?.textContent==='最後の更新です。');
  const rapid=await mirror.evaluate(()=>viewSamples);assert(!rapid.includes('First rapid update.')&&!rapid.includes('Latest rapid update.')&&!rapid.includes('最初の更新です。'));
  record('Rapid updates publish only the latest translated snapshot');
  await mirror.evaluate(()=>{globalThis.keptDoc=document.querySelector('#mirror-frame').contentDocument;globalThis.keptNode=keptDoc.getElementById('watch');viewSamples=[];});
  await source.locator('#watch').evaluate(el=>{el.textContent='Transient change that is reverted.';});await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'km:capture'}),sourceId);await wait(40);
  await source.locator('#watch').evaluate(el=>{el.textContent='Latest rapid update.';});await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'km:capture'}),sourceId);await wait(500);
  assert(await mirror.evaluate(()=>document.querySelector('#mirror-frame').contentDocument===keptDoc&&document.querySelector('#mirror-frame').contentDocument.getElementById('watch')===keptNode));
  record('Reverting an in-flight source change keeps the already correct visible view');
  await mirror.locator('#scroll').uncheck();await mirror.evaluate(()=>document.querySelector('#mirror-frame').contentDocument.scrollingElement.scrollTo(0,450));await wait(200);
  await mirror.evaluate(()=>{failTranslations=true;viewSamples=[];});
  await source.locator('#watch').evaluate(el=>{el.textContent='Unavailable update.';});await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'km:capture'}),sourceId);
  await mirror.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Terjemahan terhenti:'));
  assert.equal(await mirror.locator('#mirror-frame').contentFrame().locator('#watch').textContent(),'最後の更新です。');
  assert(!(await mirror.evaluate(()=>viewSamples)).includes('Unavailable update.'));
  record('Failed updates preserve the last Japanese view instead of exposing English');
  await mirror.evaluate(()=>{failTranslations=false;});await mirror.locator('#translate').click();
  await mirror.waitForFunction(()=>document.querySelector('#mirror-frame').contentDocument.getElementById('watch')?.textContent==='再試行したレッスンです。');
  const scrollTop=await mirror.evaluate(()=>document.querySelector('#mirror-frame').contentDocument.scrollingElement.scrollTop);assert(Math.abs(scrollTop-450)<8,String(scrollTop));
  record('Retry publishes a ready translation and preserves independent scroll position');
  assert.equal(errors.length,0,JSON.stringify(errors));record('No uncaught browser errors');
  await mirror.evaluate(()=>{sampling=false;});fs.writeFileSync(path.join(scratch,'stable-render-results.json'),JSON.stringify({results,samples:await mirror.evaluate(()=>viewSamples)},null,2));
  await mirror.locator('#close').click();
 }finally{await context.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
