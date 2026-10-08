import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = new URL('./qa/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/tmp/horse-browsers/chromium-1243/chrome-linux64/chrome', headless: true, args: ['--no-sandbox'] });
const issues = [];
const report = [];
try {
  for (const [name, width, height] of [['user', 953, 924], ['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    page.on('pageerror', e => issues.push(`${name}: ${e.message}`));
    await page.goto('http://127.0.0.1:4180/design/dashboard-v2/', { waitUntil: 'networkidle' });
    for (const theme of ['royal-club', 'imperial-porcelain', 'nocturne']) {
      await page.locator('#menu-toggle').click();
      await page.locator(`.theme-choice[data-theme="${theme}"]`).click();
      await page.locator('#menu-close').click();
      await page.locator('#board-backdrop').evaluate(i => i.decode());
      await page.screenshot({ path: `${out}/${name}-${theme}.png` });
      const geometry = await page.evaluate(() => {
        const rect = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, bottom:r.bottom }; };
        return { viewport: { w:innerWidth, h:innerHeight }, scroll:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}, board:rect('.board-scene'), rail:rect('.cards-rail'), action:rect('.infield-action'), footer:rect('.table-footer'), cards:document.querySelectorAll('.horse-card').length };
      });
      assert.equal(geometry.cards, 7);
      assert.ok(geometry.scroll.w <= width, `${name} horizontal overflow`);
      assert.ok(geometry.scroll.h <= height, `${name} vertical overflow`);
      report.push({ name, theme, ...geometry });
    }
    await page.locator('#menu-toggle').click();
    await page.screenshot({ path: `${out}/${name}-menu.png` });
    await page.locator('#pause-button').click();
    assert.ok(await page.locator('#pause-overlay').isVisible());
    await page.locator('#resume-button').click();
    assert.ok(await page.locator('#pause-overlay').isHidden());
    await page.locator('#roll-button').click();
    await page.waitForTimeout(380);
    assert.ok(await page.locator('#die-button').evaluate(e => e.classList.contains('rolling')));
    await page.screenshot({ path: `${out}/${name}-rolling.png` });
    await page.waitForFunction(() => !document.querySelector('#die-button').classList.contains('rolling'));
    await page.locator('.horse-card[data-horse="0"]').click();
    await page.waitForFunction(() => document.querySelector('.horse-card[data-horse="0"]').classList.contains('flipped'));
    await page.waitForTimeout(850);
    assert.ok(await page.locator('.horse-card[data-horse="0"]').isDisabled());
    await page.screenshot({ path: `${out}/${name}-flipped.png` });
    await page.locator('#inspect-blue').click();
    await page.screenshot({ path: `${out}/${name}-inspect.png` });
    await page.locator('#exact-specimen').click();
    await page.locator('#reference-image').evaluate(i => i.decode());
    assert.ok((await page.locator('#reference-image').getAttribute('src')).endsWith('c-cards.png'));
    await page.screenshot({ path: `${out}/${name}-original-card.png` });
    await page.locator('#reference-dialog .dialog-close').click();
    await page.locator('#inspect-dialog .dialog-close').click();
    await page.locator('#menu-toggle').click();
    await page.locator('#exit-button').click();
    await page.locator('#confirm-exit').click();
    assert.ok(await page.locator('#entry-overlay').isVisible());
    await page.locator('#enter-preview').click();
    assert.ok(await page.locator('#entry-overlay').isHidden());
    await page.close();
  }
  assert.deepEqual(issues, []);
  const lifecycle = await browser.newPage({ viewport: { width: 953, height: 924 } });
  await lifecycle.goto('http://127.0.0.1:4180/design/dashboard-v2/', { waitUntil: 'networkidle' });
  await lifecycle.locator('#roll-button').click();
  await lifecycle.waitForTimeout(200);
  await lifecycle.locator('#menu-toggle').click();
  await lifecycle.locator('#pause-button').click();
  await lifecycle.waitForTimeout(1400);
  assert.ok(await lifecycle.locator('#die-button').evaluate(e => e.classList.contains('rolling')), 'Pause should freeze a roll');
  await lifecycle.locator('#resume-button').click();
  await lifecycle.waitForFunction(() => !document.querySelector('#die-button').classList.contains('rolling'));
  for (const i of [0, 2, 3, 4, 6]) {
    if (i !== 0) {
      await lifecycle.locator('#roll-button').click();
      await lifecycle.waitForFunction(() => !document.querySelector('#die-button').classList.contains('rolling'));
    }
    await lifecycle.locator(`.horse-card[data-horse="${i}"]`).click();
    await lifecycle.waitForFunction(i => document.querySelector(`.horse-card[data-horse="${i}"]`).classList.contains('flipped'), i);
    await lifecycle.waitForFunction(() => !document.querySelector('#roll-button').disabled);
  }
  assert.equal(await lifecycle.locator('.horse-card.flipped').count(), 0, 'All cards reset together for a new cycle');
  assert.equal(await lifecycle.locator('#cycle-number').innerText(), '2');
  await lifecycle.close();
  await writeFile(`${out}/report.json`, JSON.stringify({ ok: true, pausedRoll: true, fullCardCycle: true, report, issues }, null, 2));
  console.log(JSON.stringify({ ok: true, viewports: 3, themes: 3, screenshots: 24, pausedRoll: true, fullCardCycle: true, issues, report: `${out}/report.json` }));
} finally { await browser.close(); }
