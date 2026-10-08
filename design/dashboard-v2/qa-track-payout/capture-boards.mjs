import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1249},deviceScaleFactor:1,reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4180/design/dashboard-v2/',{waitUntil:'networkidle'});
 for(const theme of ['royal-club','imperial-porcelain','nocturne']){
  await page.locator('#menu-toggle').click();
  await page.locator(`.theme-choice[data-theme="${theme}"]`).click();
  await page.locator('#menu-close').click();
  await page.waitForFunction(theme=>document.querySelector('#board-backdrop').getAttribute('src')===`${theme}-track-base.png`,theme);
  await page.locator('#board-backdrop').evaluate(e=>e.decode());
  const path=new URL(`./board-${theme}.png`,import.meta.url).pathname;
  await page.locator('.board-scene').screenshot({path});
  console.log(JSON.stringify({theme,path,size:await page.locator('.board-scene').boundingBox()}));
 }
 for(const [viewport,width,height] of [['user',953,924],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  await page.screenshot({path:new URL(`./${viewport}-nocturne.png`,import.meta.url).pathname});
 }
}finally{await browser.close();}
