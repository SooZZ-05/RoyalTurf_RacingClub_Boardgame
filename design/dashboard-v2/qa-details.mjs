import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath:'/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome', headless:true, args:['--no-sandbox'] });
const out = new URL('./qa/', import.meta.url).pathname;
try {
  for (const [name,width,height] of [['user',953,924],['mobile',390,844]]) {
    const page=await browser.newPage({viewport:{width,height}});
    await page.goto('http://127.0.0.1:4180/design/dashboard-v2/',{waitUntil:'networkidle'});
    const inventory = () => page.locator('.die-face').evaluateAll(faces => faces.map(f=>f.dataset.symbol).sort());
    const original = await inventory();
    assert.deepEqual(original,['cap','carrot','head','head','head','shoe']);
    await page.locator('#roll-button').click();
    await page.waitForFunction(()=>!document.querySelector('#die-button').classList.contains('rolling'));
    assert.deepEqual(await inventory(), original);
    for (const theme of ['royal-club','imperial-porcelain','nocturne']) {
      await page.locator('#menu-toggle').click();
      await page.locator(`.theme-choice[data-theme="${theme}"]`).click();
      await page.locator('#menu-close').click();
      await page.locator('#inspect-blue').click();
      await page.locator('[data-inspect-choice="0"]').click();
      await page.screenshot({path:`${out}/${name}-${theme}-card01.png`});
      const rows = await page.locator('#large-card').evaluate(el => {
        const card=el.querySelector('.card-face').getBoundingClientRect();
        return [...el.querySelectorAll('.stat')].map(row=>({value:row.querySelector('strong').textContent,bottom:row.getBoundingClientRect().bottom,cardBottom:card.bottom}));
      });
      assert.deepEqual(rows.map(r=>r.value),['1','15','8','4']);
      assert.ok(rows.every(r=>r.bottom<=r.cardBottom+1),`${name}/${theme} clips rows: ${JSON.stringify(rows)}`);
      await page.locator('#inspect-dialog .dialog-close').click();
    }
    await page.close();
  }
  console.log(JSON.stringify({ok:true,fixedDiceFaces:'3head/1cap/1carrot/1shoe before and after roll',card01:'all four correct rows fit in all3themes at953 and390'}));
}finally{await browser.close();}
