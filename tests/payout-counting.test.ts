import { describe, expect, it } from 'vitest';
import {
  calculateRaceLedger,
  payoutColumnCount,
  upgradePayoutCounting,
} from '../src/shared/settlement';
import { newRoom } from '../src/shared/engine';
import { SERIES_EDITION } from '../src/shared/demo';
import { seat } from './fixture';

describe('requested positive-chip payouts', () => {
  const settings = { deck: 'base' as const, hidden: true, crowded: false, alternative: false };
  const bets = [
    { seatId: 'A', horseId: 5, chip: { id: 'green-2', value: 2 } },
    { seatId: 'B', horseId: 5, chip: { id: 'green-0', value: 0 } },
    { seatId: 'A', horseId: 3, chip: { id: 'blue-1', value: 1 } },
    { seatId: 'B', horseId: 3, chip: { id: 'blue-0', value: 0 } },
  ];
  it('counts 1 and 2 once each and excludes every 0', () => {
    expect(payoutColumnCount([0, 2])).toBe(1);
    expect(payoutColumnCount([2, 1, 0])).toBe(2);
    expect(payoutColumnCount([0, 0])).toBe(0);
  });
  it('pays a sole green double 1000 and blue single 350, ignoring both bluff chips', () => {
    const rows = calculateRaceLedger(
      SERIES_EDITION.rules,
      settings,
      1,
      [seat('A'), seat('B')],
      bets,
      [5, 3, 0],
      [6],
      null,
    );
    expect(rows[0]).toMatchObject({ winnings: 1350, balance: 1350 });
    expect(rows[1]).toMatchObject({ winnings: 0, balance: 0 });
    const shared = structuredClone(bets);
    shared[1].chip.value = 1;
    const sharedRows = calculateRaceLedger(
      SERIES_EDITION.rules,
      settings,
      1,
      [seat('A'), seat('B')],
      shared,
      [5, 3, 0],
      [6],
      null,
    );
    expect(sharedRows[0].winnings).toBe(700 + 350);
    expect(sharedRows[1].winnings).toBe(350);
  });
  it('repairs existing 1050 balances once and preserves played race history', () => {
    const state = newRoom('REPAIR', seat('A'));
    delete state.payoutCountingVersion;
    state.seats.push(seat('B'));
    state.edition = structuredClone(SERIES_EDITION);
    state.settings = settings;
    state.seats[0].money = 1050;
    state.results = [
      {
        race: 1,
        ranks: [5, 3, 0],
        last: [6],
        pace: null,
        bets,
        ledger: [
          { seatId: 'A', winnings: 1050, bonus: 0, penalty: 0, paidPenalty: 0, balance: 1050 },
        ],
      },
    ];
    const oldBets = structuredClone(state.results[0].bets);
    expect(upgradePayoutCounting(state)).toBe(true);
    expect(state.seats[0].money).toBe(1350);
    expect(state.results[0].bets).toEqual(oldBets);
    expect(upgradePayoutCounting(state)).toBe(false);
    expect(state.seats[0].money).toBe(1350);
  });
});
