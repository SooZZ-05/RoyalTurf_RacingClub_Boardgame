import { describe, expect, it } from 'vitest';
import { addHuman, applyCommand, newRoom, seededRandom, viewForSeat } from '../src/shared/engine';
import { DEMO_EDITION, SERIES_EDITION, upgradeKnownEdition } from '../src/shared/demo';
import { calculateRaceLedger } from '../src/shared/settlement';
import { EDITION_STATUS } from '../src/shared/edition';
import type { GameState, RaceResult } from '../src/shared/types';
import { seat } from './fixture';

function prepared(): GameState {
  return applyCommand(
    addHuman(addHuman(newRoom('ZH-RULES', seat('A')), seat('B')), seat('C')),
    'A',
    { type: 'startSeries' },
    seededRandom(5),
    null,
    1000,
  );
}
function endOfRace(race = 1): GameState {
  const state = prepared();
  state.race = race;
  state.phase = 'move';
  state.turn = 0;
  state.rolled = 'head';
  const progress = [36, 40, 39, 25, 20, 21, 4];
  for (const horse of state.horses) {
    horse.position = progress[horse.id];
    horse.rank = horse.id === 1 ? 1 : horse.id === 2 ? 2 : null;
    horse.used = false;
  }
  state.pace = 3; // Blue Ocean took18, but is not on the podium.
  state.bets = [
    { seatId: 'A', horseId: 3, chip: { id: 'A-2', value: 2 } },
    { seatId: 'A', horseId: 6, chip: { id: 'A-1', value: 1 } },
    { seatId: 'B', horseId: 3, chip: { id: 'B-1', value: 1 } },
    { seatId: 'B', horseId: 6, chip: { id: 'B-2', value: 2 } },
    { seatId: 'C', horseId: 3, chip: { id: 'C-0', value: 0 } },
  ];
  return state;
}
function finish(state: GameState) {
  // The photographed white card moves one space on head:36→37 is third place.
  return applyCommand(state, 'A', { type: 'move', horseId: 0 }, () => 0, null, 1000);
}

describe('the selected Traditional Chinese game rules', () => {
  for (const hidden of [false, true])
    it(`lets every player choose chips in any order (hidden=${hidden})`, () => {
      let state = addHuman(newRoom('CHIPCHOICE', seat('A')), seat('B'));
      state.settings.hidden = hidden;
      state = applyCommand(state, 'A', { type: 'startSeries' }, seededRandom(1), null, 1000);
      const order = hidden ? [2, 0, 1, 1] : [2, 1, 1];
      let now = 1000;
      while (state.phase === 'betting') {
        const actor = state.seats[state.turn].id;
        const placed = state.bets.filter((b) => b.seatId === actor).length;
        const chip = state.hands[actor].find((c) => c.value === order[placed])!;
        const view = viewForSeat(state, actor, EDITION_STATUS, now);
        expect(new Set(view.legal.filter((c) => c.type === 'bet').map((c) => c.chipId)).size).toBe(
          state.hands[actor].length,
        );
        const action = view.legal.find((c) => c.type === 'bet' && c.chipId === chip.id)!;
        state = applyCommand(state, actor, action, () => 0, null, ++now);
      }
      expect(state.phase).toBe('roll');
      for (const actor of ['A', 'B'])
        expect(state.bets.filter((b) => b.seatId === actor).map((b) => b.chip.value)).toEqual(
          order,
        );
    });
  it('both shipped modes award checkpoint18 without a podium restriction', () => {
    for (const edition of [DEMO_EDITION, SERIES_EDITION]) {
      expect(edition.rules).toMatchObject({
        paceDistance: 18,
        paceBonus: 100,
        paceRequiresPodium: false,
        lastPenalty: 100,
      });
      expect(edition.rules.evidence.paceRequiresPodium).toContain('punchboardgame.pixnet.net');
    }
  });
  it('awards the first horse landing on18 once, keeps the marker, and pays only at settlement', () => {
    let state = prepared();
    state.phase = 'move';
    state.turn = 0;
    state.rolled = 'head';
    state.horses.find((h) => h.id === 0)!.position = 17;
    state.horses.find((h) => h.id === 3)!.position = 15;
    state = applyCommand(state, 'A', { type: 'move', horseId: 0 }, () => 0, null, 1000);
    expect(state.pace).toBe(0);
    expect(state.horses.find((h) => h.id === 0)!.position).toBe(18);
    expect(state.seats.map((s) => s.money)).toEqual([0, 0, 0]);
    expect(viewForSeat(state, 'A', EDITION_STATUS).pace).toBe(
      viewForSeat(state, 'B', EDITION_STATUS).pace,
    );
    let now = state.presentation!.endsAt;
    state = applyCommand(state, 'B', { type: 'roll' }, () => 0, null, now);
    now = state.presentation!.endsAt;
    state = applyCommand(state, 'B', { type: 'move', horseId: 3 }, () => 0, null, now);
    expect(state.horses.find((h) => h.id === 3)!.position).toBe(19);
    expect(state.pace).toBe(0);
  });
  it('recognizes jumping past18 and does not count a blocked nominal crossing', () => {
    let state = prepared();
    state.phase = 'move';
    state.turn = 0;
    state.rolled = 'head';
    state.horses.find((h) => h.id === 3)!.position = 17;
    const crossed = applyCommand(state, 'A', { type: 'move', horseId: 3 }, () => 0, null, 1000);
    expect(crossed.horses.find((h) => h.id === 3)!.position).toBe(21);
    expect(crossed.pace).toBe(3);
    state.horses.find((h) => h.id === 0)!.position = 17;
    state.horses.find((h) => h.id === 1)!.position = 18;
    expect(
      applyCommand(state, 'A', { type: 'move', horseId: 0 }, () => 0, null, 1000).pace,
    ).toBeNull();
  });
  for (const race of [1, 2, 3]) {
    it(`pays non-podium pace bettors and last-place losses per unit in race${race}`, () => {
      const result = finish(endOfRace(race));
      const multiplier = race === 3 ? 2 : 1;
      const settlement = result.results[0];
      expect(settlement.ranks).toEqual([1, 2, 0]);
      expect(settlement.last).toEqual([6]);
      expect(settlement.pace).toBe(3);
      expect(settlement.ledger.find((l) => l.seatId === 'A')).toMatchObject({
        winnings: 0,
        bonus: 200 * multiplier,
        penalty: 100 * multiplier,
        paidPenalty: 100 * multiplier,
        balance: 100 * multiplier,
      });
      // The100 bonus is available before the200 loss; no debt goes below zero.
      expect(settlement.ledger.find((l) => l.seatId === 'B')).toMatchObject({
        winnings: 0,
        bonus: 100 * multiplier,
        penalty: 200 * multiplier,
        paidPenalty: 100 * multiplier,
        balance: 0,
      });
      expect(settlement.ledger.find((l) => l.seatId === 'C')).toMatchObject({
        bonus: 0,
        penalty: 0,
        balance: 0,
      });
      expect(result.phase).toBe(race === 3 ? 'gameResults' : 'raceResults');
    });
  }
  it('can award the checkpoint and charge the same last horse, including a zero bluff', () => {
    const state = endOfRace();
    state.pace = 6;
    state.bets = [
      { seatId: 'A', horseId: 6, chip: { id: 'A', value: 2 } },
      { seatId: 'B', horseId: 6, chip: { id: 'B', value: 1 } },
      { seatId: 'C', horseId: 6, chip: { id: 'C', value: 0 } },
    ];
    const ledger = finish(state).results[0].ledger;
    expect(ledger[0]).toMatchObject({ bonus: 200, penalty: 200, paidPenalty: 200, balance: 0 });
    expect(ledger[1]).toMatchObject({ bonus: 100, penalty: 100, paidPenalty: 100, balance: 0 });
    expect(ledger[2]).toMatchObject({ bonus: 0, penalty: 0, paidPenalty: 0, balance: 0 });
  });
  it('charges only bets on the horse furthest behind when the third finisher arrives', () => {
    const state = endOfRace();
    state.pace = null;
    state.bets = [
      { seatId: 'A', horseId: 6, chip: { id: 'lost', value: 2 } },
      { seatId: 'B', horseId: 4, chip: { id: 'other', value: 2 } },
    ];
    state.seats.forEach((s) => {
      s.money = 500;
    });
    const result = finish(state);
    expect(result.results[0].ledger[0]).toMatchObject({
      penalty: 200,
      paidPenalty: 200,
      balance: 300,
    });
    expect(result.results[0].ledger[1]).toMatchObject({ penalty: 0, balance: 500 });
    // Unfinished horses never continue racing to decide last place after settlement.
    expect(() =>
      applyCommand(result, 'B', { type: 'roll' }, () => 0, null, result.presentation!.endsAt),
    ).toThrow('WRONG_PHASE');
  });
  it('uses total units and the5+ column; the2-chip still receives double', () => {
    const state = endOfRace();
    state.seats = ['A', 'B', 'C', 'D', 'E', 'F'].map(seat);
    state.pace = null;
    state.bets = state.seats.map((s) => ({
      seatId: s.id,
      horseId: 1,
      chip: { id: s.id, value: 2 },
    }));
    const result = finish(state);
    expect(result.results[0].ledger.map((l) => l.winnings)).toEqual([300, 300, 300, 300, 300, 300]);
    expect(result.results[0].ledger.every((l) => l.penalty === 0)).toBe(true);
  });
  it('uses three horse-head faces and one face for each other symbol', () => {
    const state = prepared();
    state.phase = 'roll';
    state.turn = 0;
    expect(
      [0, 1, 2, 3, 4, 5].map(
        (face) => applyCommand(state, 'A', { type: 'roll' }, () => face, null, 1000).rolled,
      ),
    ).toEqual(['head', 'head', 'head', 'cap', 'carrot', 'shoe']);
  });
});

describe('saved-game repair for the earlier checkpoint rule', () => {
  it('recomputes all recorded balances once and preserves the played race events', () => {
    const state = endOfRace();
    state.edition!.rules.paceRequiresPodium = true;
    const balances = state.seats.map((s) => ({ ...s, money: 0 }));
    for (const race of [1, 2, 3]) {
      const ledger = calculateRaceLedger(
        state.edition!.rules,
        state.settings,
        race,
        balances,
        state.bets,
        [1, 2, 0],
        [6],
        3,
      );
      const result: RaceResult = {
        race,
        ranks: [1, 2, 0],
        last: [6],
        pace: 3,
        ledger,
        bets: structuredClone(state.bets),
      };
      state.results.push(result);
      ledger.forEach((row) => {
        balances.find((s) => s.id === row.seatId)!.money = row.balance;
      });
    }
    state.edition!.version = '1.0.0-seven-profile-series';
    state.phase = 'gameResults';
    state.race = 3;
    state.seats.forEach((s) => {
      s.money = balances.find((b) => b.id === s.id)!.money;
    });
    expect(state.seats.every((s) => s.money === 0)).toBe(true);
    const playedHorses = structuredClone(state.horses),
      lastMove = state.lastMove;
    expect(upgradeKnownEdition(state)).toBe(true);
    expect(state.edition!.version).toBe(SERIES_EDITION.version);
    expect(state.seats.map((s) => s.money)).toEqual([400, 0, 0]);
    expect(state.results.map((r) => r.ledger[0].bonus)).toEqual([200, 200, 400]);
    expect(state.horses).toEqual(playedHorses);
    expect(state.lastMove).toEqual(lastMove);
    const corrected = JSON.stringify(state);
    expect(upgradeKnownEdition(state)).toBe(false);
    expect(JSON.stringify(state)).toBe(corrected);
  });
  it('does not change unrelated or newly-versioned rule snapshots', () => {
    const state = endOfRace();
    state.edition!.rules.paceRequiresPodium = true;
    state.seats[0].money = 250;
    expect(upgradeKnownEdition(state)).toBe(false);
    state.edition!.id = 'another-edition';
    state.edition!.version = '1.0.0-seven-profile-series';
    expect(upgradeKnownEdition(state)).toBe(false);
    expect(state.seats[0].money).toBe(250);
    expect(state.edition!.rules.paceRequiresPodium).toBe(true);
  });
});
