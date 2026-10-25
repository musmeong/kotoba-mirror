const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root,scratch,browserOptions}=require('./test-support.cjs');
(async()=>{
 const browser=await chromium.launch({...browserOptions(),headless:true});
 const context=await browser.newContext({viewport:{width:683,height:403}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
 const record=name=>{results.push(name);console.log('PASS',name);};
 try{
  await page.setContent('<body class="mirror"><iframe id="mirror-frame" class="page-frame" sandbox="allow-same-origin"></iframe><aside id="selection-tooltip" role="dialog" aria-labelledby="selection-label" hidden><header class="tooltip-header"><strong id="selection-label"></strong><button id="selection-close" aria-label="Tutup terjemahan">×</button></header><div id="selection-content" tabindex="0"><div id="selection-original"></div><p id="selection-result"></p></div><small id="selection-hint"></small></aside></body>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'ui.css'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'selection-translation.js'),'utf8')});
  const original=('A longer original paragraph should remain readable in full, even near the edge of the browser window. ').repeat(40)+'END_OF_ORIGINAL_TEXT';
  const translated=('This is the full translation of the selected passage. Move into the popover and scroll to read the rest. ').repeat(35)+'END_OF_SELECTED_TRANSLATION';
  const japanese='日本語の長い文章を最後まで読みます。'.repeat(70);
  await page.evaluate(({original,translated,japanese})=>{
   const frame=document.getElementById('mirror-frame'),d=frame.contentDocument;
   d.body.innerHTML='<p id="ordinary" style="position:fixed;right:15px;bottom:15px;margin:0;font:20px sans-serif">長い文章</p><p id="selected" style="position:fixed;left:15px;top:25px;width:160px;height:35px;overflow:hidden;white-space:nowrap;margin:0;font:20px sans-serif"></p>';
   d.getElementById('ordinary').title=original;d.getElementById('selected').textContent=japanese;
   globalThis.Translator={create:async()=>({translate:async()=>translated,destroy(){}})};
   globalThis.ctrl=KotobaSelection.create({frame,getLanguages:()=>({sourceLanguage:'ja',targetLanguage:'en'})});ctrl.bind(d,frame);
  },{original,translated,japanese});
  const mf=page.locator('#mirror-frame').contentFrame();
  async function assertFits(){
   const box=await page.locator('#selection-tooltip').boundingBox(),size=page.viewportSize();
   assert(box.x>=7&&box.y>=7,JSON.stringify(box));assert(box.x+box.width<=size.width-7&&box.y+box.height<=size.height-7,JSON.stringify({box,size}));
  }
  async function readBottom(marker){
   const content=page.locator('#selection-content');await content.hover();await page.waitForTimeout(550);
   assert.equal(await page.locator('#selection-tooltip').isVisible(),true);
   await content.focus();await page.keyboard.press('PageDown');
   await page.waitForTimeout(180);
   assert((await content.evaluate(el=>el.scrollTop))>0);
   await content.evaluate(el=>{el.scrollTop=el.scrollHeight;});
   const visible=await page.evaluate(marker=>{
    const result=document.getElementById('selection-result'),content=document.getElementById('selection-content'),range=document.createRange();
    range.setStart(result.firstChild,result.textContent.length-marker.length);range.selectNodeContents(result);range.setStart(result.firstChild,result.textContent.length-marker.length);
    const rect=range.getBoundingClientRect(),box=content.getBoundingClientRect();return rect.top>=box.top-1&&rect.bottom<=box.bottom+1;
   },marker);
   assert(visible,'The final words must be readable inside the scrolling region');
  }
  for(const size of [{width:683,height:403},{width:360,height:430},{width:1000,height:300}]){
   await page.setViewportSize(size);await mf.locator('#ordinary').hover();
   await page.locator('#selection-tooltip').waitFor({state:'visible'});
   assert.equal(await page.locator('#selection-result').textContent(),original);assert.equal(await page.locator('#selection-original').isVisible(),false);
   await assertFits();await readBottom('END_OF_ORIGINAL_TEXT');
   await page.locator('#selection-close').click();await page.locator('#selection-tooltip').waitFor({state:'hidden'});
   record(`Ordinary hover is fully scrollable and fits ${size.width}×${size.height}`);
  }
  await page.setViewportSize({width:683,height:403});
  await mf.locator('#selected').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const s=window.getSelection();s.removeAllRanges();s.addRange(r);});
  const selectedBox=await mf.locator('#selected').boundingBox();await page.mouse.move(selectedBox.x+10,selectedBox.y+15);
  await page.waitForFunction(()=>document.getElementById('selection-result').textContent.endsWith('END_OF_SELECTED_TRANSLATION'));
  assert.equal(await page.locator('#selection-original').textContent(),japanese);assert.equal(await page.locator('#selection-result').textContent(),translated);
  await assertFits();await readBottom('END_OF_SELECTED_TRANSLATION');
  await page.screenshot({path:path.join(scratch,'long-tooltip-scrolled.png')});
  record('Long selections retain both full source and full translation through the last word');
  await page.keyboard.press('Escape');await page.locator('#selection-tooltip').waitFor({state:'hidden'});
  record('Escape closes a focused scrollable popover');
  assert.deepEqual(errors,[]);record('No uncaught browser errors');
  fs.writeFileSync(path.join(scratch,'long-tooltip-results.json'),JSON.stringify({results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
