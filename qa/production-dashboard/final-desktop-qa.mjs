import{chromium}from'playwright';import{writeFileSync}from'node:fs';
const browser=await chromium.launch({executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:953,height:924}});const report={errors:[]};
page.on('pageerror',err=>report.errors.push(err.message));
try{
await page.goto('http://localhost:5173',{waitUntil:'networkidle'});await page.locator('#guest-name').fill('Final QA');await page.locator('.entry-panel form button.full').click();await page.getByRole('button',{name:/開始三場賽事/}).click();await page.waitForTimeout(700);
await page.screenshot({path:'qa/production-dashboard/953-royal-final-betting.png',fullPage:true});
report.betting=await page.locator('.play-turn').boundingBox();
for(let i=0;i<3;i++){await page.locator('.rb-card-bay.available .rb-bet-well').first().click();await page.waitForTimeout(500);}
await page.locator('.play-turn .play-primary:enabled').waitFor({timeout:25000});
await page.screenshot({path:'qa/production-dashboard/953-royal-final-roll.png',fullPage:true});
report.roll=await page.locator('.play-turn').boundingBox();report.horses=await page.locator('.rb-horse-piece').evaluateAll(els=>els.map(e=>({id:e.dataset.horseId,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom})));
}catch(err){report.errors.push(err.stack);}
finally{writeFileSync('qa/production-dashboard/final-desktop-report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
