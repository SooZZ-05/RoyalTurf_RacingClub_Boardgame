import type { Edition, EditionStatus, Seat } from '../src/shared/types';
import observed from '../docs/observed-components.json';
// Synthetic data for tests ONLY. These profiles are not the Chinese game cards.
// This module is never imported by the production application or Worker.
export const fixture: Edition = {
  id: 'synthetic-test-only',
  version: '1.0.0-test',
  verified: true,
  verification: {
    reviewer: 'Automated test fixture, not edition verification',
    date: '2026-10-07',
    sources: ['Synthetic test data'],
  },
  cards: [
    ...Array.from({ length: 21 }, (_, i) => ({
      id: `base-${i}`,
      deck: 'base' as const,
      horse: i % 7,
      names: { 'zh-Hant': `測試馬 ${i}`, en: `Test horse ${i}` },
      moves: { head: (i % 7) + 1, cap: (i % 3) + 2, carrot: (i % 4) + 3, shoe: (i % 5) + 2 },
      evidence: 'Synthetic fixture; not a printed card',
    })),
    ...Array.from({ length: 28 }, (_, i) => ({
      id: `history-${i}`,
      deck: 'historical' as const,
      horse: null,
      names: { 'zh-Hant': `測試名馬 ${i}`, en: `Test historical horse ${i}` },
      moves: { head: (i % 7) + 1, cap: (i % 3) + 2, carrot: (i % 4) + 3, shoe: (i % 5) + 2 },
      evidence: 'Synthetic fixture; not a printed card',
    })),
  ],
  rules: {
    trackLength: 12,
    finishDistance: 12,
    paceDistance: 6,
    payout: observed.board.payout as Edition['rules']['payout'],
    paceBonus: 100,
    lastPenalty: 100,
    paceRequiresPodium: false,
    lastTie: 'all',
    penaltyAfterWinnings: true,
    laterStarter: 'totalMoney',
    sharedVictory: true,
    evidence: Object.fromEntries(
      [
        'trackLength',
        'finishDistance',
        'paceDistance',
        'payout',
        'paceRequiresPodium',
        'lastTie',
        'penaltyAfterWinnings',
        'laterStarter',
        'sharedVictory',
        'deckHandling',
        'occupancy',
      ].map((key) => [
        key,
        key === 'payout'
          ? observed.board.source
          : 'Synthetic test rule configuration, not verified Chinese rules',
      ]),
    ),
  },
};
export const ready: EditionStatus = {
  ready: true,
  id: fixture.id,
  version: fixture.version,
  missing: [],
};
export const seat = (id: string): Seat => ({
  id,
  name: id,
  bot: false,
  connected: true,
  disconnectedAt: null,
  money: 0,
});
