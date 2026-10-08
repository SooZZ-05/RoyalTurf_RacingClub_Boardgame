import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const out='qa/production-dashboard';
const browser=await chromium.launch({executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:953,height:924},deviceScaleFactor:1});
const report={screens:[],pageErrors:[],errors:[],failures:[]};
page.on('pageerror',err=>report.pageErrors.push(err.message));
page.on('response',res=>{if(res.status()>=400)report.errors.push({url:res.url(),status:res.status()})});
try{
 await page.goto('http://localhost:5173',{waitUntil:'networkidle'});
 await page.locator('#guest-name').fill('Visual QA');
 while(Number(await page.locator('#bot-count').innerText())<1)await page.getByRole('button',{name:'+',exact:true}).click();
 await page.locator('.entry-panel form button.full').click();
 await page.locator('.play-menu-button').waitFor();
 await page.waitForTimeout(700);
 report.room=await page.locator('.room-code').innerText();
 await page.getByRole('button',{name:/開始三場賽事/}).click();
 await page.waitForTimeout(700);
 for(const viewport of[{width:953,height:924},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const theme of['royal-club','imperial-porcelain','nocturne']){
   await page.locator('.play-menu-button').click();
   await page.locator(`[data-theme-option="${theme}"]`).click();
   await page.waitForTimeout(250);
   await page.getByRole('button',{name:'Close / 關閉',exact:true}).click();
   await page.waitForTimeout(150);
   const prefix=`${out}/${viewport.width}-${theme}`;
   await page.screenshot({path:prefix+'-board.png',fullPage:true});
   const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,cards:document.querySelectorAll('.rb-card-bay').length,trackCells:document.querySelectorAll('[data-cell]').length,horsePieces:document.querySelectorAll('.rb-horse-piece').length,images:Array.from(document.images).filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src),boardTop:document.querySelector('.rb-backdrop').getBoundingClientRect().top,topbarBottom:document.querySelector('.play-topbar').getBoundingClientRect().bottom,metaBottom:document.querySelector('.play-meta').getBoundingClientRect().bottom,turnBottom:document.querySelector('.play-turn').getBoundingClientRect().bottom}));
   await page.locator('.rb-card-inspect').first().click();
   const card=await page.locator('.race-board-dialog[open]').count();
   await page.screenshot({path:prefix+'-card.png',fullPage:true});
   await page.getByRole('button',{name:'Close / 關閉',exact:true}).click();
   await page.locator('.play-menu-button').click();
   await page.screenshot({path:prefix+'-menu.png',fullPage:true});
   await page.getByRole('button',{name:'Close / 關閉',exact:true}).click();
   report.screens.push({viewport,theme,metrics,card});
   if(metrics.scrollWidth>metrics.width+1)report.failures.push(`${viewport.width} ${theme}: horizontal overflow`);
   if(metrics.trackCells!==36)report.failures.push(`${viewport.width} ${theme}: track cells ${metrics.trackCells}`);
   if(metrics.cards!==7||metrics.horsePieces!==7)report.failures.push(`${viewport.width} ${theme}: missing card or piece`);
   if(card!==1)report.failures.push(`${viewport.width} ${theme}: missing card dialog`);
   if(metrics.boardTop<metrics.topbarBottom)report.failures.push(`${viewport.width} ${theme}: board covers topbar`);
  }
 }
 await page.locator('.play-menu-button').click();
 await page.getByRole('button',{name:/暫停遊戲/}).click();
 await page.locator('.play-pause').waitFor();
 await page.screenshot({path:out+'/390-pause.png'});
 await page.getByRole('button',{name:/繼續遊戲/}).click();
 await page.locator('.play-pause').waitFor({state:'hidden'});
 report.pauseResume='passed';
}catch(err){report.failures.push(err.stack);await page.screenshot({path:out+'/failure.png',fullPage:true});}
finally{writeFileSync(out+'/visual-qa-report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
