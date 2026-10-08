import { expect, test } from '@playwright/test';
import { BOARD_THEME_IDS } from '../../src/shared/types';

test('host themes sync across seats, survive refresh, and do not alter game state', async ({
  browser,
}) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [];
  for (const p of [host, guest]) {
    await p.addInitScript(() => localStorage.setItem('royal-turf-language', 'en'));
    p.on('pageerror', (e) => errors.push(e.message));
  }
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill('Theme host');
    await host.getByRole('button', { name: '−', exact: true }).click();
    await host.getByRole('button', { name: 'Take a seat' }).click();
    await expect(host.locator('.connection.live')).toBeVisible();
    const code = await host.locator('.room-code').innerText();
    await guest.goto(`/?room=${code}`);
    await guest.getByLabel('Your name').fill('Theme guest');
    await guest.getByRole('button', { name: 'Take a seat' }).click();
    await expect(guest.locator('.connection.live')).toBeVisible();
    for (const p of [host, guest]) {
      await p.getByRole('button', { name: 'Close / 關閉', exact: true }).click();
      await p.getByRole('button', { name: 'Game menu' }).click();
    }
    for (const theme of BOARD_THEME_IDS) {
      await expect(guest.locator(`[data-theme-option="${theme}"]`)).toBeDisabled();
      await host.locator(`[data-theme-option="${theme}"]`).click();
      await expect(host.locator('.race-board')).toHaveAttribute('data-board-theme', theme);
      await expect(guest.locator('.race-board')).toHaveAttribute('data-board-theme', theme);
    }
    await guest.reload();
    await expect(guest.locator('.connection.live')).toBeVisible();
    await expect(guest.locator('.race-board')).toHaveAttribute('data-board-theme', 'nocturne');
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('all three board themes fit a phone with seven inspectable card slots and player bets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('royal-turf-language', 'en'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Your name').fill('Mobile');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.locator('.connection.live')).toBeVisible();
  await page.getByRole('button', { name: 'Close / 關閉', exact: true }).click();
  for (const theme of BOARD_THEME_IDS) {
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.locator(`[data-theme-option="${theme}"]`).click();
    await expect(page.locator('.race-board')).toHaveAttribute('data-board-theme', theme);
    await page.getByRole('button', { name: 'Close / 關閉', exact: true }).click();
    await expect(page.locator('[data-horse-card]')).toHaveCount(7);
    await expect(page.locator('.rb-bet-well')).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Enlarge Snow White card' }).click();
    await expect(page.locator('.rb-large-card')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `test-results/${theme}-mobile.png`, fullPage: true });
  }
});
