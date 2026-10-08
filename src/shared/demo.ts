import observed from '../../docs/observed-components.json';
import type { DemoEdition, GameState, SeriesEdition } from './types';
import { calculateRaceLedger } from './settlement';

// Content-limited modes are separate from the full-edition verification gate.
// Every movement value comes from photographed Chinese cards, not test fixtures.
export const DEMO_EDITION: DemoEdition = {
  id: 'royal-turf-seven-card-demo',
  version: '1.1.0-demo',
  verified: false,
  demo: true,
  raceCount: 1,
  verification: {
    reviewer: 'Photographed profiles; researched rules; not full-edition verification',
    date: '2026-10-08',
    sources: [
      'https://punchboardgame.pixnet.net/blog/posts/9573680628',
      observed.baseSource,
      observed.board.source,
      'https://www.groupsne.co.jp/products/bg/royalturf/index.html',
      'https://www.rulespal.com/winners-circle/rulebook',
    ],
  },
  cards: observed.baseProfiles.map((profile) => ({
    ...profile,
    id: `demo-base-${profile.horse}`,
    deck: 'base',
    evidence: observed.baseSource,
  })),
  rules: {
    trackLength: observed.board.trackLength,
    finishDistance: 37,
    paceDistance: observed.board.paceDistance,
    payout: observed.board.payout as DemoEdition['rules']['payout'],
    paceBonus: 100,
    lastPenalty: observed.board.lastPenalty,
    paceRequiresPodium: false,
    lastTie: 'all',
    penaltyAfterWinnings: true,
    laterStarter: 'totalMoney',
    sharedVictory: true,
    evidence: {
      trackLength: observed.board.source,
      paceDistance: observed.board.source,
      payout: observed.board.source,
      finishDistance:
        'https://anboard-games.com/games/royal-turf/ — finish is the boundary between 0 and 1; after a complete lap this is forward distance 37. Board has 36 cells.',
      paceRequiresPodium:
        'https://punchboardgame.pixnet.net/blog/posts/9573680628 — the first horse reaching/passing 18 keeps the award; each betting unit earns 100 at settlement. No podium condition is stated in this Chinese-edition reference.',
      penaltyAfterWinnings:
        'https://www.rulespal.com/winners-circle/rulebook#paying-out — pay winnings, then last-place loss up to available money',
      deckHandling: 'Demo only: seven photographed base profiles used once; one race, no recycling',
      occupancy:
        'Demo only: base-game blocking on physical spaces, finished horses leave the track',
      lastTie: 'Unreachable with base-mode single-space occupancy; no crowded-field demo',
      laterStarter: 'Unused in the single-race demo',
      sharedVictory:
        'https://anboard-games.com/games/royal-turf/ — tied highest balances share victory',
    },
  },
};

export const SERIES_EDITION: SeriesEdition = {
  ...DEMO_EDITION,
  id: 'royal-turf-seven-card-series',
  version: '1.1.0-seven-profile-series',
  demo: false,
  raceCount: 3,
  reuseProfiles: true,
  rules: {
    ...DEMO_EDITION.rules,
    evidence: {
      ...DEMO_EDITION.rules.evidence,
      deckHandling:
        'Optional practice series: reuse the seven original Chinese-photo profiles each race. Normal games use the complete21/28published decks without replacement.',
      laterStarter:
        'https://www.rulespal.com/winners-circle/rulebook#the-bets — highest accumulated money starts later races; random selection among ties',
      lastTie:
        'Digital crowded-field convention: all horses tied at the lowest position incur last-place losses. The available rules do not resolve tied last place.',
    },
  },
};

/** Repair the known 1.0 rule bug in saved seven-profile games, including prior settlements.
 * Other editions retain their frozen rules. Played turns and random results are preserved. */
export function upgradeKnownEdition(state: GameState): boolean {
  const edition = state.edition;
  if (!edition || edition.verified) return false;
  const replacement =
    edition.id === DEMO_EDITION.id && edition.version === '1.0.0-demo'
      ? DEMO_EDITION
      : edition.id === SERIES_EDITION.id && edition.version === '1.0.0-seven-profile-series'
        ? SERIES_EDITION
        : null;
  if (!replacement) return false;
  edition.version = replacement.version;
  edition.rules.paceRequiresPodium = replacement.rules.paceRequiresPodium;
  edition.rules.evidence.paceRequiresPodium = replacement.rules.evidence.paceRequiresPodium;
  edition.verification.date = replacement.verification.date;
  // Series seats begin at zero; settle every recorded race in order so capped
  // losses and later balances include checkpoint awards that were omitted.
  const balances = state.seats.map((seat) => ({ ...seat, money: 0 }));
  for (const result of state.results) {
    result.ledger = calculateRaceLedger(
      edition.rules,
      state.settings,
      result.race,
      balances,
      result.bets,
      result.ranks,
      result.last,
      result.pace,
    );
    for (const row of result.ledger)
      balances.find((seat) => seat.id === row.seatId)!.money = row.balance;
  }
  for (const seat of state.seats)
    seat.money = balances.find((entry) => entry.id === seat.id)!.money;
  return true;
}
