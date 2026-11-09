const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/kyb45/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'.private/qa');fs.mkdirSync(qa+'/tmp',{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,env:{...process.env,TEMP:qa+'/tmp',TMP:qa+'/tmp'}});let checks=0;
try{for(const name of ['index','vat','salary','juhyu','daily','reverse']){
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));const url='https://taxhaejwo.vercel.app/'+name+'.html';
 await page.route('**/*',r=>r.request().url()===url?r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,name+'.html'),'utf8')}):r.abort());await page.goto(url);await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('nav a').count(),6);assert.equal(await page.locator('nav a[aria-current=page]').count(),1);checks+=2;
 for(const width of [375,768,1000,1440]){await page.setViewportSize({width,height:1000});assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),name+'/'+width);checks++;}
 if(name==='reverse'){
  await page.locator('#salary-example').click();assert.equal(await page.locator('#reverse-gross').innerText(),'3,412,740원');assert.equal(await page.locator('#reverse-net-month').innerText(),'3,000,000원');assert.equal(await page.locator('#reverse-gap').innerText(),'0원');checks+=3;
  assert(await page.evaluate(()=>{const g=SalaryEngine.money(document.querySelector('#salary-gross').textContent.replace('원',''));return SalaryEngine.calculate({mode:'monthly',amount:g,nontax:200000n,month:11,family:1,children:0,ratio:100,insurance:'auto'}).net===3000000n;}));checks++;
  await page.locator('#salary-annual').click();assert.equal(await page.locator('#salary-amount').inputValue(),'36,000,000');assert.equal(await page.locator('#reverse-gross').innerText(),'—');await page.locator('#salary-form button[type=submit]').click();assert.equal(await page.locator('#reverse-gross').innerText(),'40,952,880원');assert.equal(await page.locator('#salary-year-net').innerText(),'36,000,000원');checks+=4;
  await page.locator('#salary-insurance').selectOption('manual');assert(!(await page.locator('#salary-pension').isDisabled()));await page.locator('#salary-family').fill('30');await page.locator('#salary-nontax').fill('0');await page.locator('#salary-amount').fill('12000001');await page.locator('#salary-form button[type=submit]').click();assert.equal(await page.locator('#reverse-gap').innerText(),'-1원');assert.equal(await page.locator('#salary-status').innerText(),'가장 가까운 결과');checks+=3;
  await page.locator('#salary-monthly').click();await page.locator('#salary-amount').fill('0');await page.locator('#salary-form button[type=submit]').click();assert(!(await page.locator('#salary-errors').evaluate(e=>e.hidden)));assert.equal(await page.locator('#reverse-gross').innerText(),'—');checks+=2;
  await page.locator('#salary-example').click();
  // This Windows environment cancels Blob downloads; check the real export payload and filename.
  await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=b=>{window.exportText=b.text();return original.call(URL,b);};HTMLAnchorElement.prototype.click=function(){window.exportName=this.download;};});await page.locator('#salary-download').click();const text=await page.evaluate(()=>window.exportText);assert(text.includes('3,412,740원')&&text.includes('3,000,000원')&&text.includes('역산'));assert.equal(await page.evaluate(()=>window.exportName),'TAX해줘_2026_세전금액_역산계산서.txt');checks+=2;
  for(const width of [375,1440]){await page.setViewportSize({width,height:1000});await page.locator('.layout').evaluate(e=>e.scrollTop=0);await page.screenshot({path:qa+'/reverse-'+width+'.png'});}
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.salary-input').evaluate(e=>getComputedStyle(e).display),'none');assert((await page.locator('#salary-print-data').innerText()).includes('3,412,740원'));await page.emulateMedia({media:'screen'});checks+=2;
  await page.locator('#salary-reset').click();assert.equal(await page.locator('#salary-monthly').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#reverse-gross').innerText(),'—');assert(await page.locator('#salary-download').isDisabled());checks+=3;
  await page.locator('#consult-open').click();assert(await page.locator('#consult-dialog').evaluate(e=>e.open));await page.keyboard.press('Escape');checks++;
 }
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.filter(u=>/^https?:/.test(u)&&u!==url).length,0,'No calculator data transmission');checks+=2;await page.close();
}}finally{await browser.close();}console.log('Six-page navigation, responsive layout and reverse-salary interaction/forward check/manual insurance/annual rounding/export/print checks passed: '+checks);
})().catch(e=>{console.error(e);process.exitCode=1;});
