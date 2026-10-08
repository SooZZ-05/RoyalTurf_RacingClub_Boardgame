import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const out=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const reports=[],errors=[];
const expectedPayout=[['500','350','250','200','150'],['350','250','200','150','100'],['250','200','150','100','100']];
try{
 for(const [viewport,width,height] of [['user',953,924],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(`${viewport}: ${e.message}`));
  await page.goto('http://127.0.0.1:4180/design/dashboard-v2/',{waitUntil:'networkidle'});
  for(const theme of ['royal-club','imperial-porcelain','nocturne']){
   await page.locator('#menu-toggle').click();
   assert.ok(await page.locator('#game-menu').isVisible());
   await page.locator(`.theme-choice[data-theme="${theme}"]`).click();
   await page.locator('#menu-close').click();
   await page.waitForFunction(theme=>document.querySelector('#board-backdrop').getAttribute('src')===`${theme}-track-base.png`,theme);
   await page.locator('#board-backdrop').evaluate(e=>e.decode());
   const track=await page.evaluate(()=>{
    const root=document.querySelector('.numbered-track');
    const cells=[...root.querySelectorAll('.track-cell')].map(e=>({number:Number(e.dataset.cell),points:[...e.points].map(p=>[p.x,p.y])}));
    const labels=[...root.querySelectorAll('[data-track-label]')].map(e=>({number:Number(e.dataset.trackLabel),alias:e.dataset.startOffset,primary:e.querySelector('tspan').textContent,x:Number(e.querySelector('text').getAttribute('x')),y:Number(e.querySelector('text').getAttribute('y'))}));
    return {cells,labels,dividers:root.querySelectorAll('.track-divider').length,finishes:[...root.querySelectorAll('.track-finish')].map(e=>({between:e.dataset.between,points:[...e.points].map(p=>[p.x,p.y])})),image:document.querySelector('#board-backdrop').getAttribute('src')};
   });
   assert.deepEqual(track.cells.map(c=>c.number).sort((a,b)=>a-b),Array.from({length:36},(_,i)=>i+1));
   assert.deepEqual(track.labels.map(c=>c.number).sort((a,b)=>a-b),Array.from({length:36},(_,i)=>i+1));
   assert.equal(new Set(track.cells.map(c=>JSON.stringify(c.points))).size,36);
   assert.equal(track.dividers,35);
   assert.equal(track.finishes.length,1);
   assert.equal(track.finishes[0].between,'36,1');
   assert.deepEqual(track.labels.filter(l=>l.alias!=='').map(l=>[l.number,Number(l.alias)]),[[30,-6],[31,-5],[32,-4],[33,-3],[34,-2],[35,-1],[36,0]]);
   track.labels.forEach(l=>assert.equal(l.primary,String(l.number)));
   // All number anchors occupy their corresponding physical cell; no label floats in the infield.
   const pointInside=(point,poly)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>point[1])!==(yj>point[1]))&&(point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi))inside=!inside;}return inside;};
   track.labels.forEach(l=>assert.ok(pointInside([l.x,l.y-6],track.cells.find(c=>c.number===l.number).points),`${theme} number${l.number} centered in cell`));
   assert.equal(await page.locator('.payout-plate tbody td').count(),15);
   const readPayout=selector=>page.locator(selector).evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('td')].map(c=>c.textContent)));
   assert.deepEqual(await readPayout('.payout-plate tbody tr'),expectedPayout);
   assert.deepEqual(await page.locator('.payout-plate thead th').allTextContents(),['總票數','1','2','3','4','5+']);
   const geometry=await page.evaluate(()=>{
    const r=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
    const plate=document.querySelector('.payout-plate');
    return {board:r(document.querySelector('.board-scene')),plate:r(plate),table:r(plate.querySelector('table')),cells:[...plate.querySelectorAll('td')].map(r),scroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},pointerTarget:document.elementFromPoint(plate.getBoundingClientRect().x+plate.getBoundingClientRect().width/2,plate.getBoundingClientRect().y+plate.getBoundingClientRect().height/2)?.className};
   });
   assert.ok(geometry.scroll.width<=width&&geometry.scroll.height<=height,'No page overflow');
   assert.equal(geometry.pointerTarget,'payout-expand');
   assert.ok(geometry.plate.x>=geometry.board.x&&geometry.plate.right<=geometry.board.right&&geometry.plate.y>=geometry.board.y&&geometry.plate.bottom<=geometry.board.bottom);
   assert.ok(geometry.table.bottom<=geometry.plate.bottom+1,'Table stays inside plate');
   assert.equal(await page.locator('.horse-card').count(),7);
   assert.equal(await page.locator('.bet-well').count(),7);
   assert.equal(await page.locator('.bet-well .bet-chip').count(),12);
   await page.screenshot({path:`${out}/${viewport}-${theme}.png`});
   await page.locator('.payout-expand').click();
   assert.ok(await page.locator('#payout-dialog').isVisible());
   assert.deepEqual(await readPayout('#payout-dialog tbody tr'),expectedPayout);
   const dialog=await page.locator('#payout-dialog').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,overflowX:e.scrollWidth>e.clientWidth,scrollable:e.scrollHeight>e.clientHeight};});
   assert.ok(dialog.x>=0&&dialog.y>=0&&dialog.right<=width+1&&dialog.bottom<=height+1);
   assert.equal(dialog.overflowX,false);
   await page.screenshot({path:`${out}/${viewport}-${theme}-payout.png`});
   await page.locator('#payout-dialog .dialog-close').click();
   assert.ok(await page.locator('#payout-dialog').isHidden());
   await page.locator('[data-bet-horse="0"]').click();
   assert.ok(await page.locator('#bet-dialog').isVisible());
   assert.deepEqual(await page.locator('#bet-rows .bet-caption').allTextContents(),['數值未公開','0 票 · 虛張聲勢','數值未公開']);
   await page.locator('#bet-dialog .dialog-close').click();
   await page.locator('[data-inspect="0"]').click();
   assert.ok(await page.locator('#inspect-dialog').isVisible());
   await page.locator('#inspect-dialog .dialog-close').click();
   reports.push({viewport,theme,track,geometry,dialog});
  }
  await page.locator('#roll-button').click();
  await page.waitForFunction(()=>!document.querySelector('#die-button').classList.contains('rolling'));
  await page.locator('[data-horse="0"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-horse="0"]').classList.contains('flipped'));
  await page.waitForFunction(()=>!document.querySelector('#roll-button').disabled);
  assert.equal(await page.locator('.bet-well .bet-chip').count(),12);
  assert.equal(await page.locator('.track-cell').count(),36);
  await page.locator('#menu-toggle').click();
  await page.locator('#pause-button').click();
  assert.ok(await page.locator('#pause-overlay').isVisible());
  await page.locator('#resume-button').click();
  assert.ok(await page.locator('#pause-overlay').isHidden());
  await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({ok:true,reports,errors},null,2));
 console.log(JSON.stringify({ok:true,viewports:2,themes:3,screenshots:12,track:'36unique cells/labels,7start aliases,35dividers+1finish',payout:'15exact values inboard+dialog',regressions:'bets,cardinspection,cardflip,menu,pause,resume pass',report:`${out}/report.json`}));
}finally{await browser.close();}
