import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const out = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome', headless:true, args:['--no-sandbox'] });
const report=[], errors=[];
const bets = [[['J',1],['Z',0],['A',2]],[['A',1]],[['Z',1]],[['J',2],['Z',1],['A',1]],[['J',0]],[['J',1]],[['Z',2],['A',0]]];
try {
  const viewports=process.argv.includes('--mobile')?[['mobile',390,844]]:[['user',953,924],['mobile',390,844]];
  for (const [name,width,height] of viewports) {
    const page=await browser.newPage({viewport:{width,height}, reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4180/design/dashboard-v2/',{waitUntil:'networkidle'});
    for (const theme of ['royal-club','imperial-porcelain','nocturne']) {
      await page.locator('#menu-toggle').click();
      await page.locator(`.theme-choice[data-theme="${theme}"]`).click();
      await page.locator('#menu-close').click();
      await page.locator('#board-backdrop').evaluate(e=>e.decode());
      assert.equal(await page.locator('.bet-well').count(),7);
      assert.equal(await page.locator('.bet-well .bet-chip').count(),12);
      assert.equal(await page.locator('.bet-well .face-up').count(),4);
      assert.equal(await page.locator('.bet-well .face-down').count(),8);
      const geometry=await page.evaluate(()=>{
        const bounds=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        return {
          overflow:{x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight},
          players:[...document.querySelectorAll('.scoreboard .player')].map(e=>({id:e.dataset.playerId,color:e.style.getPropertyValue('--bettor')})),
          wells:[...document.querySelectorAll('.bet-well')].map(e=>({rect:bounds(e),card:bounds(e.parentElement.querySelector('.card-shell')),chips:[...e.querySelectorAll('.bet-chip')].map(c=>({rect:bounds(c),color:c.style.getPropertyValue('--bettor'),text:c.textContent})),centerTarget:document.elementFromPoint(e.getBoundingClientRect().x+e.getBoundingClientRect().width/2,e.getBoundingClientRect().y+e.getBoundingClientRect().height/2)?.closest('.bet-well')?.dataset.betHorse}))
        };
      });
      await page.screenshot({path:`${out}/${name}-${theme}-hidden.png`});
      assert.deepEqual(geometry.overflow,{x:false,y:false});
      geometry.wells.forEach((well,i)=>{
        assert.equal(well.centerTarget,String(i));
        assert.ok(well.rect.x>well.card.right,`${name}/${theme} well ${i} must be beside card`);
        well.chips.forEach(chip=>{
          assert.ok(chip.rect.x>=well.rect.x-1&&chip.rect.right<=well.rect.right+1&&chip.rect.y>=well.rect.y-1&&chip.rect.bottom<=well.rect.bottom+1,`${name}/${theme} chip fits its well: ${JSON.stringify({chip:chip.rect,well:well.rect})}`);
          assert.ok(geometry.players.some(p=>p.color===chip.color),'Chip color corresponds to a player');
        });
      });
      await page.screenshot({path:`${out}/${name}-${theme}-hidden.png`});
      await page.locator('[data-bet-horse="0"]').click();
      assert.ok(await page.locator('#bet-dialog').isVisible());
      assert.deepEqual(await page.locator('#bet-rows .bet-caption').allTextContents(),['數值未公開','0 票 · 虛張聲勢','數值未公開']);
      await page.screenshot({path:`${out}/${name}-${theme}-details.png`});
      const dialog=await page.locator('#bet-dialog').evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,overflowX:e.scrollWidth>e.clientWidth,scrollableY:e.scrollHeight>e.clientHeight}));
      assert.ok(dialog.x>=0&&dialog.y>=0&&dialog.x+dialog.width<=width+1&&dialog.y+dialog.height<=height+1);
      assert.equal(dialog.overflowX,false);
      await page.locator('#reveal-bets').click();
      assert.equal(await page.locator('.bet-well .face-up').count(),12);
      assert.equal(await page.locator('.bet-well .face-down').count(),0);
      const revealed=await page.locator('.bet-well').evaluateAll(els=>els.map(e=>[...e.querySelectorAll('.bet-chip')].map(c=>[c.querySelector('small').textContent,Number(c.querySelector('b').textContent)])));
      assert.deepEqual(revealed,bets);
      for (const initial of ['J','Z','A']) {
        assert.deepEqual(revealed.flat().filter(b=>b[0]===initial).map(b=>b[1]).sort(),[0,1,1,2]);
      }
      assert.deepEqual(await page.locator('#bet-rows .bet-caption').allTextContents(),['1 票','0 票 · 虛張聲勢','2 票']);
      await page.screenshot({path:`${out}/${name}-${theme}-revealed-details.png`});
      await page.locator('#bet-dialog .dialog-close').click();
      await page.screenshot({path:`${out}/${name}-${theme}-revealed.png`});
      await page.locator('[data-bet-horse="4"]').click();
      assert.deepEqual(await page.locator('#bet-rows .bet-caption').allTextContents(),['0 票 · 虛張聲勢','未下注','未下注']);
      await page.locator('#reveal-bets').click();
      assert.equal(await page.locator('.bet-well .face-up').count(),4);
      assert.equal(await page.locator('.bet-well .face-down').count(),8);
      assert.deepEqual(await page.locator('#bet-rows .bet-caption').allTextContents(),['數值未公開','未下注','未下注']);
      await page.locator('#bet-dialog .dialog-close').click();
      report.push({name,theme,geometry,dialog});
    }
    const countBefore=await page.locator('.bet-well').evaluateAll(es=>es.map(e=>e.dataset.count));
    await page.locator('#roll-button').click();
    await page.waitForFunction(()=>!document.querySelector('#die-button').classList.contains('rolling'));
    await page.locator('[data-horse="0"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-horse="0"]').classList.contains('flipped'));
    await page.waitForFunction(()=>!document.querySelector('#roll-button').disabled);
    assert.deepEqual(await page.locator('.bet-well').evaluateAll(es=>es.map(e=>e.dataset.count)),countBefore);
    assert.equal(await page.locator('.bet-well .bet-chip').count(),12);
    await page.close();
  }
  const detailPage=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
  await detailPage.goto('http://127.0.0.1:4180/design/dashboard-v2/',{waitUntil:'networkidle'});
  await detailPage.locator('[data-bet-horse="0"]').click();
  await detailPage.locator('#reveal-bets').click();
  await detailPage.locator('#bet-dialog .dialog-close').click();
  await detailPage.locator('.cards-rail').screenshot({path:`${out}/royal-club-revealed-wells.png`});
  await detailPage.close();
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({ok:true,report,errors},null,2));
  console.log(JSON.stringify({ok:true,themes:3,viewports:viewports.length,screenshots:viewports.length*12+1,checks:'12 individual tokens; 0,1,1,2 per player; hidden/own/revealed values; owner colors; well placement; cardflip preserves wagers; no page/dialog overflow',report:`${out}/report.json`}));
}finally{await browser.close();}
