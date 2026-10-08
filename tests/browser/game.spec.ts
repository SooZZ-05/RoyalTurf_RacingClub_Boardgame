import { expect, test, type Page } from '@playwright/test';
import type { GameView } from '../../src/shared/types';

async function english(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('royal-turf-language', 'en');
  });
}
async function credentials(page: Page, code: string) {
  return page.evaluate(
    (code) => JSON.parse(localStorage.getItem('royal-turf-seats-v1')!)[code],
    code,
  );
}
async function view(page: Page, code: string): Promise<GameView> {
  const s = await credentials(page, code);
  const response = await page.request.get(`/api/rooms/${code}/state`, {
    headers: { Authorization: `Bearer ${s.token}` },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).view;
}
async function enter(page: Page, name: string, noBots = false) {
  await english(page);
  await page.goto('/');
  await page.getByLabel('Your name').fill(name);
  if (noBots) await page.getByRole('button', { name: '−', exact: true }).click();
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.locator('.connection.live')).toBeVisible();
  return (await page.locator('.room-code').innerText()).trim();
}
async function closeDialog(page: Page) {
  await page.getByRole('button', { name: 'Close / 關閉', exact: true }).click();
}

test('clubhouse, tutorial and source-backed three-race lobby are usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await english(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The next race/ })).toBeVisible();
  await page.getByRole('button', { name: 'How to play' }).click();
  await page.getByRole('button', { name: /Next/ }).click();
  await expect(page.getByRole('heading', { name: 'Roll, then decide' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Your name').fill('Racing guest');
  await page.getByRole('button', { name: 'Take a seat' }).click();
  await expect(page.getByRole('button', { name: /Start three races/ })).toBeEnabled();
  await expect(page.locator('.play-edition-scope')).toContainText('fresh cards');
  await closeDialog(page);
  await expect(page.locator('[data-horse-slot]')).toHaveCount(7);
  await expect(page.locator('[data-cell]')).toHaveCount(36);
  await expect(page.locator('[data-cell="30"]')).toHaveAttribute('data-start-offset', '-6');
  await expect(page.locator('[data-cell="36"]')).toHaveAttribute('data-start-offset', '0');
  await expect(page.locator('[data-cell="18"] .checkpoint')).toHaveCount(1);
  await page.getByRole('button', { name: 'Enlarge Snow White card' }).click();
  await expect(page.locator('.rb-accessible-stats')).toContainText('15');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Game menu' }).click();
  await page.getByRole('button', { name: /Exit game/ }).click();
  await page.getByRole('button', { name: 'Leave table' }).click();
  await expect(page.getByRole('heading', { name: /The next race/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('two players share hidden bets, dice reveal, pause, moving horse and reconnect', async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  const alice = await ac.newPage(),
    bob = await bc.newPage();
  const errors: string[] = [];
  for (const page of [alice, bob]) page.on('pageerror', (e) => errors.push(e.message));
  try {
    const code = await enter(alice, 'Alice', true);
    await english(bob);
    await bob.goto(`/?room=${code}`);
    await bob.getByLabel('Your name').fill('Bob');
    await bob.getByRole('button', { name: 'Take a seat' }).click();
    await expect(bob.locator('.connection.live')).toBeVisible();
    await alice.getByRole('checkbox', { name: /Hidden bets/ }).check();
    await expect(alice.getByRole('button', { name: /Start three races/ })).toBeEnabled();
    await alice.getByRole('button', { name: /Start three races/ }).click();
    await expect(alice.locator('.play-dashboard')).toHaveAttribute('data-phase', 'betting');
    await expect(bob.getByRole('dialog')).toHaveCount(0);
    const aid = (await credentials(alice, code)).seatId;
    for (let i = 0; i < 8; i++) {
      const current = await view(alice, code);
      const actor = current.activeId === aid ? alice : bob;
      const actorView = await view(actor, code);
      const placed = actorView.bets.filter((b) => b.seatId === actorView.selfId).length;
      const chip = actorView.hand.find((c) => c.value === [2, 0, 1, 1][placed])!;
      const bet = actorView.legal.find((c) => c.type === 'bet' && c.chipId === chip.id)!;
      if (bet.type !== 'bet') throw new Error('Missing bet');
      await expect(actor.locator('.play-chips button[aria-pressed="true"]')).toHaveCount(0);
      await actor.locator(`[data-chip-id="${chip.id}"]`).click();
      await expect(actor.locator(`[data-chip-id="${chip.id}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await actor.locator(`[data-horse-card="${bet.horseId}"]`).click();
      await expect
        .poll(async () => (await view(alice, code)).revision)
        .toBeGreaterThan(current.revision);
    }
    const betting = await view(alice, code);
    expect(betting.bets.filter((b) => b.seatId !== aid).every((b) => b.value === null)).toBe(true);
    expect(
      betting.bets
        .filter((b) => b.seatId === aid)
        .map((b) => b.value)
        .sort(),
    ).toEqual([0, 1, 1, 2]);
    expect(betting.bets.filter((b) => b.seatId === aid).map((b) => b.value)).toEqual([2, 0, 1, 1]);
    const bView = await view(bob, code);
    expect(bView.bets.filter((b) => b.seatId === bView.selfId).map((b) => b.value)).toEqual([
      2, 0, 1, 1,
    ]);
    expect(betting.edition.raceCount).toBe(3);
    const roller = betting.activeId === aid ? alice : bob;
    await roller.getByRole('button', { name: 'Roll the die' }).click();
    await expect(alice.locator('.play-dashboard')).toHaveAttribute('data-presentation', 'rolling');
    await expect(bob.locator('.play-dashboard')).toHaveAttribute('data-presentation', 'rolling');
    await expect(alice.locator('.live-dice-reveal')).toBeVisible();
    await expect(bob.locator('.live-dice-reveal')).toBeVisible();
    const roll = await view(alice, code);
    expect((await view(bob, code)).rolled).toBe(roll.rolled);
    expect(roll.legal.filter((c) => c.type === 'move')).toHaveLength(0);
    await alice.getByRole('button', { name: 'Game menu' }).click();
    await alice.getByRole('button', { name: /Pause game/ }).click();
    await expect.poll(async () => (await view(bob, code)).paused).toBe(true);
    // Server acknowledgement precedes the receiving browsers' render.
    await expect(alice.locator('.play-dashboard')).toHaveClass(/is-paused/);
    await expect(bob.locator('.play-dashboard')).toHaveClass(/is-paused/);
    const pausedTransform = await alice.locator('.live-reveal-flight').getAttribute('style');
    await alice.waitForTimeout(700);
    expect(await alice.locator('.live-reveal-flight').getAttribute('style')).toBe(pausedTransform);
    await alice.getByRole('button', { name: /Resume game/ }).click();
    await expect(alice.locator('.live-dice-reveal')).toHaveCount(0, { timeout: 6000 });
    await expect(roller.locator('.play-dashboard')).toHaveAttribute('data-presentation', 'idle');
    const ready = await view(roller, code);
    const move = ready.legal.find((c) => c.type === 'move');
    expect(move?.type).toBe('move');
    if (move?.type !== 'move') throw new Error('Missing horse move');
    const from = ready.horses.find((h) => h.id === move.horseId)!.position;
    await roller.locator(`[data-horse-card="${move.horseId}"]`).click();
    await expect(alice.locator('.play-dashboard')).toHaveAttribute('data-presentation', 'moving');
    await expect(bob.locator('.play-dashboard')).toHaveAttribute('data-presentation', 'moving');
    await expect(roller.locator(`[data-horse-card="${move.horseId}"]`)).not.toHaveClass(/flipped/);
    const moving = await view(roller, code);
    const expected = moving.horses.find((h) => h.id === move.horseId)!.position;
    expect(expected).toBeGreaterThanOrEqual(from);
    await expect(roller.locator(`[data-horse-card="${move.horseId}"]`)).toHaveClass(/flipped/, {
      timeout: 5000,
    });
    await expect(alice.locator('.play-dashboard')).toHaveAttribute('data-presentation', 'idle');
    await expect(bob.locator(`[data-horse-piece="${move.horseId}"]`)).toHaveAttribute(
      'data-progress-position',
      String(expected),
    );
    await bob.reload();
    await expect(bob.locator('.connection.live')).toBeVisible();
    expect((await view(bob, code)).horses).toEqual((await view(alice, code)).horses);
    await alice.screenshot({ path: 'test-results/multiplayer-board.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await ac.close();
    await bc.close();
  }
});

test('finished race opens settlement after movement, with rematch and saved results', async ({
  page,
}) => {
  const code = await enter(page, 'Finisher');
  await page.getByRole('button', { name: /Start three races/ }).click();
  const inspect = await page.request.get(`/_test/rooms/${code}/inspect`);
  const state = await inspect.json();
  const seat = (await credentials(page, code)).seatId;
  state.phase = 'move';
  state.race = 3;
  state.turn = state.seats.findIndex((s: any) => s.id === seat);
  state.rolled = 'head';
  state.presentation = null;
  state.horses.forEach((h: any, i: number) => {
    h.position = i < 2 ? 40 : i === 2 ? 36 : 6 - i;
    h.rank = i < 2 ? i + 1 : null;
    h.used = false;
  });
  const paceHorse = state.horses[3].id,
    lastHorse = state.horses[6].id;
  const bot = state.seats.find((s: any) => s.bot).id;
  state.pace = paceHorse;
  state.bets = [
    { seatId: seat, horseId: state.horses[0].id, chip: { id: 'human-winner', value: 1 } },
    { seatId: seat, horseId: paceHorse, chip: { id: 'human-pace', value: 2 } },
    { seatId: seat, horseId: lastHorse, chip: { id: 'human-last', value: 1 } },
    { seatId: bot, horseId: paceHorse, chip: { id: 'bot-pace', value: 1 } },
    { seatId: bot, horseId: lastHorse, chip: { id: 'bot-last', value: 2 } },
  ];
  const horseId = state.horses[2].id;
  await page.request.post(`/_test/rooms/${code}/seed`, { data: state });
  await expect(page.locator(`[data-horse-card="${horseId}"]`)).toBeVisible();
  await page.waitForTimeout(150);
  await page.locator(`[data-horse-card="${horseId}"]`).click();
  await expect(page.locator('.play-dashboard')).toHaveAttribute('data-presentation', 'moving');
  await expect(page.getByRole('heading', { name: 'A meeting to remember' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'A meeting to remember' })).toBeVisible({
    timeout: 6000,
  });
  await expect(page.locator('.live-podium>div')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Save results' })).toBeVisible();
  await expect(page.locator('[data-settlement="pace"]')).toContainText(
    '+$200 per betting unit, regardless of final place',
  );
  await expect(page.locator('[data-settlement="last"]')).toContainText('−$200 per betting unit');
  await expect(page.locator('[data-last-place="true"]')).toHaveCount(1);
  await expect(page.locator('[data-last-place-space="7"]')).toHaveCount(1);
  await expect(page.locator('[data-on-last-stand="true"]')).toHaveCount(1);
  const humanRow = page.locator('.live-results tbody tr').filter({ hasText: 'Finisher' });
  await expect(humanRow.locator('td').nth(2)).toHaveText('+400');
  await expect(humanRow.locator('td').nth(3)).toHaveText('−200');
  await expect(humanRow.locator('td').nth(1)).toHaveText('+1000');
  await expect(humanRow.locator('td').nth(4)).toHaveText('1,200');
  await expect(page.locator('.play-podium [data-result-card]')).toHaveCount(3);
  const calculation = page.locator(`[data-calculation-seat="${seat}"]`);
  await expect(calculation).toContainText('$500 × 1 × 2 = +$1000');
  await expect(calculation).toContainText('$100 × 2 × 2 = +$400');
  await expect(calculation).toContainText('$100 × 1 × 2 = −$200');
  await expect(calculation).toContainText('$0 + $1000 + $400 − $200 = $1,200');
  await expect(page.locator('.live-capped-loss')).toContainText(
    '$400 assessed; payment capped by balance',
  );
  await page.screenshot({ path: 'qa/chinese-rules/third-race-settlement.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.play-podium [data-result-card]')).toHaveCount(3);
  expect(
    await page
      .locator('.play-dialog')
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
  await calculation.locator('.result-balance').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'qa/chinese-rules/settlement-breakdown-mobile.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: /Another meeting/ }).click();
  await expect(page.getByRole('button', { name: /Start three races/ })).toBeEnabled();
});
