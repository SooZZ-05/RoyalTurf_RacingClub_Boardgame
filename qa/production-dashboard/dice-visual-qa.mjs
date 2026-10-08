import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844}});const report={errors:[],screens:[]};page.on('pageerror',err=>report.errors.push(err.message));
try{
 await page.goto('http://localhost:5173',{waitUntil:'networkidle'});
 await page.locator('#guest-name').fill('Dice QA');
 await page.locator('.entry-panel form button.full').click();
 await page.getByRole('button',{name:/開始三場賽事/}).click();
 for(let i=0;i<3;i++){await page.locator('.rb-card-bay.available .rb-bet-well').first().click();await page.waitForTimeout(500);}
 await page.waitForFunction(()=>document.querySelector('.play-dashboard')?.dataset.phase!=='betting');
 for(const theme of ['royal-club','imperial-porcelain','nocturne']){
  await page.locator('.play-menu-button').click();await page.locator(`[data-theme-option="${theme}"]`).click();await page.waitForTimeout(200);await page.getByRole('button',{name:'Close / 關閉',exact:true}).click();
  const roll=page.locator('.play-turn .play-primary:enabled');await roll.waitFor({timeout:25000});await roll.click();
  await page.locator('.live-dice-reveal').waitFor();await page.waitForTimeout(900);
  report.screens.push({theme,symbol:await page.locator('.live-dice-reveal').getAttribute('data-symbol'),readable:await page.locator('.live-reveal-copy').innerText()});
  await page.screenshot({path:`qa/production-dashboard/390-${theme}-die.png`});
  await page.locator('.live-dice-reveal').waitFor({state:'hidden'});
  const horse=page.locator('.rb-card-bay.available [data-horse-card]').first();const horseId=await horse.getAttribute('data-horse-card');
  await horse.click();await page.waitForTimeout(2500);
  await page.screenshot({path:`qa/production-dashboard/390-${theme}-moved.png`});
  report.screens.at(-1).horseId=horseId;report.screens.at(-1).flipped=await page.locator(`[data-horse-card="${horseId}"]`).evaluate(el=>el.classList.contains('flipped'));
 }
}catch(err){report.errors.push(err.stack);await page.screenshot({path:'qa/production-dashboard/dice-failure.png',fullPage:true});}
finally{writeFileSync('qa/production-dashboard/dice-qa-report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
