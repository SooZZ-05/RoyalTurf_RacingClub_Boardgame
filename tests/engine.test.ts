import { describe, expect, it } from 'vitest';
import {
  addHuman,
  applyCommand,
  legalActions,
  movedDestination,
  newRoom,
  seededRandom,
  viewForSeat,
} from '../src/shared/engine';
import { chooseBotAction } from '../src/shared/bot';
import { EDITION, EDITION_STATUS, parseEdition } from '../src/shared/edition';
import { fixture, ready, seat } from './fixture';
import {
  BOARD_THEME_IDS,
  DEFAULT_BOARD_THEME,
  type GameCommand,
  type GameState,
} from '../src/shared/types';
import { commandSchema, createSchema } from '../src/shared/protocol';
import observed from '../docs/observed-components.json';
import { DEMO_EDITION } from '../src/shared/demo';

function started() {
  return applyCommand(
    addHuman(newRoom('TESTROOM', seat('A')), seat('B')),
    'A',
    { type: 'start' },
    seededRandom(4),
    fixture,
  );
}
function command(state: GameState, cmd: GameCommand, random = seededRandom(2)) {
  return applyCommand(
    state,
    state.seats[state.turn].id,
    cmd,
    random,
    fixture,
    afterPresentation(state),
  );
}
function afterPresentation(state: GameState) {
  return Math.max(Date.now(), state.presentation?.endsAt ?? 0);
}
function racing(state = started()) {
  while (state.phase === 'betting')
    state = command(
      state,
      legalActions(state, state.seats[state.turn].id, ready).find((c) => c.type === 'bet')!,
    );
  return state;
}
describe('shared board themes', () => {
  it('defaults old clients to Royal Club and accepts only the three named themes', () => {
    const state = newRoom('THEMEROOM', seat('A'));
    expect(state.boardTheme).toBe(DEFAULT_BOARD_THEME);
    const payload = { name: 'Alice', bots: 0, settings: state.settings };
    expect(createSchema.parse(payload).boardTheme).toBe(DEFAULT_BOARD_THEME);
    for (const boardTheme of BOARD_THEME_IDS) {
      expect(createSchema.parse({ ...payload, boardTheme }).boardTheme).toBe(boardTheme);
      expect(commandSchema.safeParse({ type: 'boardTheme', boardTheme }).success).toBe(true);
    }
    expect(createSchema.safeParse({ ...payload, boardTheme: 'unknown' }).success).toBe(false);
    expect(commandSchema.safeParse({ type: 'boardTheme', boardTheme: 'unknown' }).success).toBe(
      false,
    );
    expect(() =>
      applyCommand(
        state,
        'A',
        { type: 'boardTheme', boardTheme: 'unknown' } as unknown as GameCommand,
        seededRandom(1),
        null,
      ),
    ).toThrow('INVALID_BOARD_THEME');
  });
  it('authorizes the host in every phase even when the full edition is unavailable', () => {
    const state = addHuman(newRoom('THEMEROOM', seat('A')), seat('B'));
    const unavailable = { ...ready, ready: false };
    for (const phase of [
      'lobby',
      'betting',
      'roll',
      'move',
      'raceResults',
      'gameResults',
    ] as const) {
      state.phase = phase;
      expect(legalActions(state, 'A', unavailable).filter((c) => c.type === 'boardTheme')).toEqual(
        BOARD_THEME_IDS.map((boardTheme) => ({ type: 'boardTheme', boardTheme })),
      );
      expect(legalActions(state, 'B', unavailable).some((c) => c.type === 'boardTheme')).toBe(
        false,
      );
      expect(
        applyCommand(
          state,
          'A',
          { type: 'boardTheme', boardTheme: 'nocturne' },
          seededRandom(1),
          null,
        ).boardTheme,
      ).toBe('nocturne');
      expect(() =>
        applyCommand(
          state,
          'B',
          { type: 'boardTheme', boardTheme: 'nocturne' },
          seededRandom(1),
          null,
        ),
      ).toThrow('HOST_ONLY');
    }
  });
  it('changes only cosmetic state and preserves random draws and bot decisions during a race', () => {
    const state = started();
    const themed = applyCommand(
      state,
      'A',
      { type: 'boardTheme', boardTheme: 'imperial-porcelain' },
      () => {
        throw new Error('Unexpected random draw');
      },
      null,
    );
    expect(themed).toEqual({
      ...state,
      boardTheme: 'imperial-porcelain',
      boardThemeChanges: 1,
      revision: state.revision + 1,
    });
    const actor = state.seats[state.turn].id;
    expect(
      chooseBotAction(
        viewForSeat(themed, actor, ready),
        themed.revision - themed.boardThemeChanges,
        Infinity,
      ),
    ).toEqual(chooseBotAction(viewForSeat(state, actor, ready), state.revision, Infinity));
    expect(viewForSeat(themed, 'B', ready).boardTheme).toBe('imperial-porcelain');
  });
  it('retains the theme on rematch and projects legacy rooms as Royal Club', () => {
    let state = applyCommand(
      started(),
      'A',
      { type: 'boardTheme', boardTheme: 'nocturne' },
      seededRandom(1),
      fixture,
    );
    state.phase = 'gameResults';
    state = applyCommand(state, 'A', { type: 'rematch' }, seededRandom(1), fixture);
    expect(state.phase).toBe('lobby');
    expect(state.boardTheme).toBe('nocturne');
    expect(state.boardThemeChanges).toBe(1);
    const legacy = { ...state } as Partial<GameState>;
    delete legacy.boardTheme;
    delete legacy.boardThemeChanges;
    expect(viewForSeat(legacy as GameState, 'B', ready).boardTheme).toBe(DEFAULT_BOARD_THEME);
    expect(
      applyCommand(legacy as GameState, 'A', { type: 'addBot' }, seededRandom(1), null).boardTheme,
    ).toBe(DEFAULT_BOARD_THEME);
  });
});
describe('edition gate', () => {
  it('rejects the incomplete production data without a fallback deck', () => {
    expect(EDITION_STATUS.ready).toBe(EDITION !== null);
    expect(() =>
      applyCommand(
        addHuman(newRoom('TESTROOM', seat('A')), seat('B')),
        'A',
        { type: 'start' },
        seededRandom(1),
        null,
      ),
    ).toThrow('EDITION_UNVERIFIED');
  });
  it('requires card counts, unique IDs, three base profiles per color and rule evidence', () => {
    expect(parseEdition(fixture).cards.length).toBe(49);
    const invalid = structuredClone(fixture);
    invalid.cards[1].id = invalid.cards[0].id;
    expect(() => parseEdition(invalid)).toThrow('unique');
    delete invalid.rules.evidence.lastTie;
    expect(() => parseEdition(invalid)).toThrow('Missing rule evidence: lastTie');
    expect(() => parseEdition({ ...fixture, cards: fixture.cards.slice(1) })).toThrow();
  });
});
describe('turns and racing', () => {
  it('starts the explicit demo with exactly the seven photographed profiles and no verification claim', () => {
    const room = addHuman(newRoom('DEMOROOM', seat('A')), seat('B'));
    room.settings = { deck: 'historical', hidden: true, crowded: true, alternative: true };
    const state = applyCommand(room, 'A', { type: 'startDemo' }, seededRandom(5), null);
    expect(state.edition!.verified).toBe(false);
    expect(state.edition!.demo).toBe(true);
    expect(state.edition!.cards).toHaveLength(7);
    expect(state.settings).toEqual({
      deck: 'base',
      hidden: false,
      crowded: false,
      alternative: false,
    });
    const projected = viewForSeat(state, 'A', EDITION_STATUS);
    expect(projected.edition).toMatchObject({ ready: false, demo: true, raceCount: 1 });
    for (const h of projected.horses)
      expect(h.moves).toEqual(observed.baseProfiles.find((c) => c.horse === h.id)!.moves);
    expect(() => parseEdition(DEMO_EDITION)).toThrow();
  });
  it('finishes the demo after a single race, without final-race doubling or missing deck draws', () => {
    let state = applyCommand(
      addHuman(newRoom('DEMOROOM', seat('A')), seat('B')),
      'A',
      { type: 'startDemo' },
      seededRandom(3),
      null,
    );
    const random = seededRandom(9);
    let steps = 0;
    while (state.phase !== 'gameResults' && steps++ < 1000) {
      const actor = state.seats[state.turn].id;
      const actions = legalActions(state, actor, EDITION_STATUS, afterPresentation(state));
      const action =
        state.phase === 'betting'
          ? actions.find((c) => c.type === 'bet')!
          : state.phase === 'roll'
            ? ({ type: 'roll' } as const)
            : actions.find((c) => c.type === 'move')!;
      state = applyCommand(state, actor, action, random, null, afterPresentation(state));
    }
    expect(state.phase).toBe('gameResults');
    expect(state.race).toBe(1);
    expect(state.results).toHaveLength(1);
    expect(state.remainingCards).toHaveLength(0);
    expect(state.results[0].ledger.every((l) => l.winnings <= 1000 && l.bonus <= 200)).toBe(true);
    expect(
      legalActions(state, state.hostId, EDITION_STATUS).some((c) => c.type === 'nextRace'),
    ).toBe(false);
  });
  it('places horses in draw order and freezes configuration and data', () => {
    const state = started();
    expect(state.horses.map((h) => h.position)).toEqual([0, -1, -2, -3, -4, -5, -6]);
    expect(new Set(state.horses.map((h) => h.id)).size).toBe(7);
    expect(() =>
      command(state, { type: 'settings', settings: { ...state.settings, hidden: true } }),
    ).toThrow();
    const changed = structuredClone(fixture);
    changed.cards[0].moves.head = 99;
    expect(state.edition!.cards[0].moves.head).not.toBe(changed.cards[0].moves.head);
  });
  it('rejects out-of-turn bets and duplicate bets on the same horse', () => {
    let state = started();
    const actor = state.seats[state.turn].id,
      other = state.seats.find((s) => s.id !== actor)!.id;
    expect(() =>
      applyCommand(
        state,
        other,
        { type: 'bet', horseId: 0, chipId: state.hands[other][0].id },
        seededRandom(1),
        fixture,
      ),
    ).toThrow('NOT_YOUR_TURN');
    state = command(state, { type: 'bet', horseId: 0, chipId: state.hands[actor][0].id });
    state = command(state, { type: 'bet', horseId: 1, chipId: state.hands[other][0].id });
    expect(() =>
      command(state, { type: 'bet', horseId: 0, chipId: state.hands[actor][0].id }),
    ).toThrow('ALREADY_BET');
  });
  it('rolls with 3:1:1:1 frequency and persists roll separately from selection', () => {
    const state = racing();
    expect(
      Array.from({ length: 6 }, (_, n) => command(state, { type: 'roll' }, () => n).rolled),
    ).toEqual(['head', 'head', 'head', 'cap', 'carrot', 'shoe']);
    const rolled = command(state, { type: 'roll' }, () => 4);
    const restored = JSON.parse(JSON.stringify(rolled));
    expect(restored.rolled).toBe('carrot');
    expect(restored.phase).toBe('move');
    expect(() => command(restored, { type: 'roll' })).toThrow('WRONG_PHASE');
  });
  it('reconstructs a committed action from recorded random outcomes', () => {
    const base = addHuman(newRoom('TESTROOM', seat('A')), seat('B'));
    const draws: number[] = [],
      random = seededRandom(9);
    const initial = applyCommand(
      base,
      'A',
      { type: 'start' },
      (max) => {
        const value = random(max);
        draws.push(value);
        return value;
      },
      fixture,
    );
    let cursor = 0;
    const replayed = applyCommand(base, 'A', { type: 'start' }, () => draws[cursor++], fixture);
    expect(replayed).toEqual(initial);
    expect(cursor).toBe(draws.length);
  });
  it('backs up from occupied destinations, allows passing, and checks lapped occupancy', () => {
    const state = racing();
    state.horses.forEach((h) => {
      h.position = -h.id - 1;
    });
    state.horses[0].position = 0;
    state.horses[1].position = 3;
    state.horses[2].position = 2;
    expect(movedDestination(state, state.horses[0].id, 3)).toBe(1);
    expect(movedDestination(state, state.horses[0].id, 4)).toBe(4);
    state.horses[1].position = -1;
    expect(movedDestination(state, state.horses[0].id, 11)).toBe(10);
    expect(movedDestination(state, state.horses[0].id, 12)).toBe(12);
  });
  it('marks a zero-movement horse used, and resets only unfinished horses', () => {
    let state = command(racing(), { type: 'roll' }, () => 0);
    const h = state.horses[0];
    state.edition!.cards.find((c) => c.id === h.cardId)!.moves.head = 0;
    state.horses.slice(1).forEach((h) => {
      h.used = true;
    });
    state.horses[1].rank = 1;
    state = command(state, { type: 'move', horseId: h.id });
    expect(state.horses[0].position).toBe(h.position);
    expect(state.horses.filter((h) => h.rank === null).every((h) => !h.used)).toBe(true);
    expect(state.horses[1].used).toBe(true);
  });
  it('does not give the pace marker for a blocked nominal crossing', () => {
    let state = command(racing(), { type: 'roll' }, () => 0);
    state.horses[0].position = 5;
    state.horses[1].position = 6;
    const h = state.horses[0];
    state.edition!.cards.find((c) => c.id === h.cardId)!.moves.head = 1;
    state = command(state, { type: 'move', horseId: h.id });
    expect(state.pace).toBeNull();
  });
});
describe('settlement', () => {
  function almostFinished(race = 1, crowded = false) {
    const state = command(racing(), { type: 'roll' }, () => 0);
    state.race = race;
    state.settings.crowded = crowded;
    state.horses.forEach((h, i) => {
      h.position = i;
      h.rank = null;
      h.used = false;
    });
    state.horses[0].rank = 1;
    state.horses[1].rank = 2;
    state.horses[2].position = 11;
    state.horses[3].position = -5;
    state.horses[4].position = crowded ? -5 : -4;
    state.bets = [
      { seatId: 'A', horseId: state.horses[0].id, chip: { id: 'double', value: 2 } },
      { seatId: 'A', horseId: state.horses[3].id, chip: { id: 'last', value: 1 } },
    ];
    state.pace = state.horses[0].id;
    return state;
  }
  for (let rank = 0; rank < 3; rank++) {
    for (let units = 1; units <= 5; units++) {
      it(`pays the photographed Chinese board cell: rank ${rank + 1}, units ${units}`, () => {
        const state = almostFinished();
        state.seats = ['A', 'B', 'C', 'D', 'E'].map(seat);
        state.bets = state.seats.slice(0, units).map((s) => ({
          seatId: s.id,
          horseId: state.horses[rank].id,
          chip: { id: s.id, value: 1 },
        }));
        const settled = command(state, { type: 'move', horseId: state.horses[2].id });
        expect(settled.results[0].ledger.find((row) => row.seatId === 'A')!.winnings).toBe(
          observed.board.payout[rank][units - 1],
        );
      });
    }
  }
  it('pays a sole 2-chip 1000 plus 200 pace under the requested payout rule', () => {
    const state = almostFinished();
    const result = command(state, { type: 'move', horseId: state.horses[2].id });
    expect(result.results[0].ledger.find((l) => l.seatId === 'A')).toMatchObject({
      winnings: 1000,
      bonus: 200,
      paidPenalty: 100,
      balance: 1100,
    });
    expect(result.phase).toBe('raceResults');
  });
  it('doubles the entire final-race settlement and stops immediately after third place', () => {
    const state = almostFinished(3);
    const result = command(state, { type: 'move', horseId: state.horses[2].id });
    expect(result.seats.find((s) => s.id === 'A')!.money).toBe(2200);
    expect(result.phase).toBe('gameResults');
    expect(result.results[0].ranks.length).toBe(3);
  });
  it('excludes bluff chips from the payout column in both saved settings', () => {
    const state = almostFinished();
    state.settings.alternative = true;
    state.settings.hidden = true;
    state.bets.push({ seatId: 'B', horseId: state.horses[0].id, chip: { id: 'zero', value: 0 } });
    const result = command(state, { type: 'move', horseId: state.horses[2].id });
    expect(result.results[0].ledger.find((l) => l.seatId === 'A')!.winnings).toBe(1000);
    expect(result.results[0].ledger.find((l) => l.seatId === 'B')!.balance).toBe(0);
    state.settings.alternative = false;
    expect(
      command(state, { type: 'move', horseId: state.horses[2].id }).results[0].ledger.find(
        (l) => l.seatId === 'A',
      )!.winnings,
    ).toBe(1000);
    // Removing a zero token has no effect on the payout column.
    state.settings.alternative = true;
    state.bets.pop();
    expect(
      command(state, { type: 'move', horseId: state.horses[2].id }).results[0].ledger.find(
        (l) => l.seatId === 'A',
      )!.winnings,
    ).toBe(1000);
  });
  it('caps penalties at available funds and uses the configured tied-last policy', () => {
    const state = almostFinished(1, true);
    state.bets = [{ seatId: 'A', horseId: state.horses[3].id, chip: { id: 'last', value: 2 } }];
    state.seats.find((s) => s.id === 'A')!.money = 50;
    const result = command(state, { type: 'move', horseId: state.horses[2].id });
    expect(result.results[0].last.length).toBe(2);
    expect(result.seats.find((s) => s.id === 'A')!.money).toBe(0);
    state.edition!.rules.lastTie = 'none';
    expect(command(state, { type: 'move', horseId: state.horses[2].id }).results[0].last).toEqual(
      [],
    );
  });
  it('requires a podium finish for the configured pace bonus', () => {
    const state = almostFinished();
    state.edition!.rules.paceRequiresPodium = true;
    state.pace = state.horses[5].id;
    state.bets.push({ seatId: 'B', horseId: state.pace, chip: { id: 'pace', value: 1 } });
    expect(
      command(state, { type: 'move', horseId: state.horses[2].id }).results[0].ledger.find(
        (l) => l.seatId === 'B',
      )!.bonus,
    ).toBe(0);
  });
});
describe('secret views and bots', () => {
  it('changing an invisible bet cannot change another player’s view or bot decision', () => {
    let state = started();
    state.settings.hidden = true;
    // A fully placed hidden race with consistent 0/1/1/2 allocations.
    state.bets = ['A', 'B'].flatMap((id) =>
      [0, 1, 1, 2].map((value, i) => ({
        seatId: id,
        horseId: i,
        chip: { id: `${id}-secret-${i}`, value },
      })),
    );
    state.hands = { A: [], B: [] };
    state.phase = 'move';
    state.rolled = 'cap';
    state.turn = 0;
    const a = viewForSeat(state, 'A', ready, 1000),
      changed = structuredClone(state);
    [changed.bets[4].chip.value, changed.bets[7].chip.value] = [
      changed.bets[7].chip.value,
      changed.bets[4].chip.value,
    ];
    const b = viewForSeat(changed, 'A', ready, 1000);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain('B-secret');
    expect(a.bets.filter((b) => b.seatId === 'B').every((b) => b.value === null)).toBe(true);
    expect((a as any).remainingCards).toBeUndefined();
    expect((a as any).hands).toBeUndefined();
    expect(chooseBotAction(a, 21, Infinity)).toEqual(chooseBotAction(b, 21, Infinity));
  });
  it('reveals zeros and double chips at settlement, and the host receives no extra secrets', () => {
    const state = started();
    state.settings.hidden = true;
    state.bets = [{ seatId: 'B', horseId: 0, chip: { id: 'secret', value: 2 } }];
    expect(viewForSeat(state, 'A', ready).bets[0].value).toBeNull();
    state.phase = 'raceResults';
    expect(viewForSeat(state, 'A', ready).bets[0].value).toBe(2);
  });
  it('lets a host replace an absent player only after 60 seconds', () => {
    const state = racing();
    state.seats[1].connected = false;
    state.seats[1].disconnectedAt = 1000;
    expect(() =>
      applyCommand(state, 'A', { type: 'replace', seatId: 'B' }, seededRandom(1), fixture, 60000),
    ).toThrow('REPLACE_TOO_SOON');
    expect(
      applyCommand(state, 'A', { type: 'replace', seatId: 'B' }, seededRandom(1), fixture, 61000)
        .seats[1].bot,
    ).toBe(true);
  });
});
describe('all 16 variant combinations', () => {
  for (let mask = 0; mask < 16; mask++)
    it(`completes three races with distinct card profiles and 2–6 seats: ${mask}`, () => {
      let state = newRoom('TESTROOM', seat('A'));
      const random = seededRandom(mask + 1);
      for (let i = 1; i < 2 + (mask % 5); i++) state = addHuman(state, seat(String(i)));
      state.settings = {
        deck: mask & 1 ? 'historical' : 'base',
        hidden: !!(mask & 2),
        crowded: !!(mask & 4),
        alternative: !!(mask & 8),
      };
      state = applyCommand(state, 'A', { type: 'start' }, random, fixture);
      const used = new Set<string>();
      let moves = 0;
      while (state.phase !== 'gameResults' && moves++ < 4000) {
        for (const h of state.horses) used.add(h.cardId);
        if (state.phase === 'raceResults')
          state = applyCommand(
            state,
            state.hostId,
            { type: 'nextRace' },
            random,
            fixture,
            afterPresentation(state),
          );
        else {
          const actor = state.seats[state.turn].id;
          const legal = legalActions(state, actor, ready, afterPresentation(state));
          const action =
            state.phase === 'betting'
              ? legal.find((c) => c.type === 'bet')!
              : state.phase === 'roll'
                ? ({ type: 'roll' } as const)
                : legal
                    .filter((c): c is { type: 'move'; horseId: number } => c.type === 'move')
                    .sort((a, b) => {
                      const ah = state.horses.find((h) => h.id === a.horseId)!,
                        bh = state.horses.find((h) => h.id === b.horseId)!;
                      return (
                        state.edition!.cards.find((c) => c.id === bh.cardId)!.moves[state.rolled!] -
                        state.edition!.cards.find((c) => c.id === ah.cardId)!.moves[state.rolled!]
                      );
                    })[0];
          state = applyCommand(state, actor, action, random, fixture, afterPresentation(state));
        }
        expect(state.seats.every((s) => s.money >= 0)).toBe(true);
      }
      expect(state.phase).toBe('gameResults');
      expect(state.results.length).toBe(3);
      expect(used.size).toBe(21);
      expect(state.remainingCards.length).toBe(state.settings.deck === 'base' ? 0 : 7);
    });
});
