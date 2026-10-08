import { describe, expect, it } from 'vitest';
import {
  addHuman,
  applyCommand,
  legalActions,
  newRoom,
  seededRandom,
  viewForSeat,
} from '../src/shared/engine';
import { EDITION_STATUS } from '../src/shared/edition';
import { SERIES_EDITION } from '../src/shared/demo';
import type { GameCommand, GameState } from '../src/shared/types';
import { seat } from './fixture';

function series() {
  return applyCommand(
    addHuman(newRoom('TIMETEST', seat('A')), seat('B')),
    'A',
    { type: 'startSeries' },
    seededRandom(1),
    null,
    1000,
  );
}
function racing() {
  const state = series();
  state.phase = 'roll';
  state.turn = 0;
  return state;
}
function command(state: GameState, actor: string, cmd: GameCommand, now: number) {
  return applyCommand(state, actor, cmd, () => 0, null, now);
}

describe('shared authoritative presentation', () => {
  it('reveals exactly one server roll to every viewer and rejects early selection', () => {
    const state = command(racing(), 'A', { type: 'roll' }, 1000);
    expect(state.presentation).toMatchObject({
      kind: 'roll',
      startedAt: 1000,
      endsAt: 5050,
      duration: 4050,
      symbol: 'head',
    });
    expect(viewForSeat(state, 'A', EDITION_STATUS, 2000).presentation).toEqual(
      viewForSeat(state, 'B', EDITION_STATUS, 2000).presentation,
    );
    expect(legalActions(state, 'A', EDITION_STATUS, 5049).some((c) => c.type === 'move')).toBe(
      false,
    );
    expect(() => command(state, 'A', { type: 'move', horseId: state.horses[0].id }, 5049)).toThrow(
      'PRESENTATION_ACTIVE',
    );
    expect(
      legalActions(state, 'A', EDITION_STATUS, 5050).filter((c) => c.type === 'move'),
    ).toHaveLength(7);
    const moved = command(state, 'A', { type: 'move', horseId: state.horses[0].id }, 5050);
    expect(moved.presentation?.kind).toBe('move');
    expect(moved.presentation?.from).toBe(0);
    expect(moved.presentation?.to).toBe(moved.horses[0].position);
    expect(moved.presentation!.endsAt - moved.presentation!.moveEndsAt!).toBe(720);
    expect(() => command(moved, 'B', { type: 'roll' }, moved.presentation!.endsAt - 1)).toThrow(
      'PRESENTATION_ACTIVE',
    );
    expect(command(moved, 'B', { type: 'roll' }, moved.presentation!.endsAt).rolled).toBe('head');
  });

  it('host pause freezes dice, blocks players, survives serialization and resumes remaining time', () => {
    let state = command(racing(), 'A', { type: 'roll' }, 1000);
    expect(() => command(state, 'B', { type: 'pause', paused: true }, 2000)).toThrow('HOST_ONLY');
    state = command(state, 'A', { type: 'pause', paused: true }, 2000);
    state = JSON.parse(JSON.stringify(state));
    expect(viewForSeat(state, 'B', EDITION_STATUS, 99000)).toMatchObject({
      paused: true,
      pausedAt: 2000,
    });
    expect(() => command(state, 'A', { type: 'move', horseId: 0 }, 99000)).toThrow('GAME_PAUSED');
    state = command(state, 'A', { type: 'boardTheme', boardTheme: 'nocturne' }, 99000);
    state = command(state, 'A', { type: 'pause', paused: false }, 100000);
    expect(state.presentation).toMatchObject({ startedAt: 99000, endsAt: 103050 });
    expect(state.pausedAt).toBeNull();
    expect(legalActions(state, 'A', EDITION_STATUS, 103049).some((c) => c.type === 'move')).toBe(
      false,
    );
    expect(legalActions(state, 'A', EDITION_STATUS, 103050).some((c) => c.type === 'move')).toBe(
      true,
    );
  });

  it('preserves prior card faces for the last move of a cycle and shifts movement on pause', () => {
    let state = command(racing(), 'A', { type: 'roll' }, 1000);
    state.horses.slice(1).forEach((h) => {
      h.used = true;
    });
    const selected = state.horses[0].id;
    state = command(state, 'A', { type: 'move', horseId: selected }, 5050);
    expect(state.presentation!.priorUsed).toHaveLength(6);
    expect(state.presentation!.priorUsed).not.toContain(selected);
    expect(state.horses.every((h) => !h.used)).toBe(true);
    const previous = structuredClone(state.presentation!);
    state = command(state, 'A', { type: 'pause', paused: true }, 5100);
    state = command(state, 'A', { type: 'pause', paused: false }, 6100);
    expect(state.presentation!.moveEndsAt).toBe(previous.moveEndsAt! + 1000);
    expect(state.presentation!.endsAt).toBe(previous.endsAt + 1000);
  });
});

describe('researched seven-profile series', () => {
  it('uses the finish boundary after36 and checkpoint18, including a blocked crossing', () => {
    const state = series();
    expect(state.edition!.rules).toMatchObject({
      trackLength: 36,
      finishDistance: 37,
      paceDistance: 18,
    });
    state.phase = 'move';
    state.turn = 0;
    state.rolled = 'head';
    state.horses.forEach((h, i) => {
      h.position = i + 1;
    });
    const horse = state.horses[0];
    state.edition!.cards.find((c) => c.id === horse.cardId)!.moves.head = 1;
    horse.position = 35;
    expect(
      command(state, 'A', { type: 'move', horseId: horse.id }, 1000).horses[0].rank,
    ).toBeNull();
    horse.position = 36;
    expect(command(state, 'A', { type: 'move', horseId: horse.id }, 1000).horses[0].rank).toBe(1);
    horse.position = 17;
    expect(command(state, 'A', { type: 'move', horseId: horse.id }, 1000).pace).toBe(horse.id);
    state.horses[1].position = 18;
    expect(command(state, 'A', { type: 'move', horseId: horse.id }, 1000).pace).toBeNull();
  });

  for (let variants = 0; variants < 8; variants++)
    it(`completes three races with photographed data and supported variants ${variants}`, () => {
      const random = seededRandom(variants + 1);
      let state = addHuman(newRoom('SERIESTEST', seat('A')), seat('B'));
      state.settings = {
        deck: 'base',
        hidden: !!(variants & 1),
        crowded: !!(variants & 2),
        alternative: !!(variants & 4),
      };
      state = applyCommand(state, 'A', { type: 'startSeries' }, random, null, 1000);
      let now = 1000,
        steps = 0;
      while (state.phase !== 'gameResults' && steps++ < 2000) {
        now = Math.max(now + 1, state.presentation?.endsAt ?? 0);
        const actor = state.phase === 'raceResults' ? state.hostId : state.seats[state.turn].id;
        const legal = legalActions(state, actor, EDITION_STATUS, now);
        const next = legal.find(
          (c) =>
            c.type ===
            (state.phase === 'raceResults'
              ? 'nextRace'
              : state.phase === 'betting'
                ? 'bet'
                : state.phase === 'roll'
                  ? 'roll'
                  : 'move'),
        )!;
        state = applyCommand(state, actor, next, random, null, now);
        for (const card of state.edition!.cards)
          expect(card.moves).toEqual(SERIES_EDITION.cards.find((c) => c.id === card.id)!.moves);
        expect(state.seats.every((s) => s.money >= 0)).toBe(true);
      }
      expect(state.results).toHaveLength(3);
      expect(state.phase).toBe('gameResults');
      expect(state.edition!.verified).toBe(false);
      expect(viewForSeat(state, 'A', EDITION_STATUS, now).edition).toMatchObject({
        demo: false,
        limitedProfiles: true,
        raceCount: 3,
        supportedDecks: ['base'],
      });
      expect(state.results.every((r) => r.ranks.length === 3)).toBe(true);
      expect(state.results.every((r) => r.bets.length === (state.settings.hidden ? 8 : 6))).toBe(
        true,
      );
    });

  it('rejects unavailable historical profiles and keeps complete-edition validation explicit', () => {
    const state = addHuman(newRoom('SERIESTEST', seat('A')), seat('B'));
    state.settings.deck = 'historical';
    expect(() => command(state, 'A', { type: 'startSeries' }, 1000)).toThrow('DECK_UNAVAILABLE');
    expect(() => command(state, 'A', { type: 'start' }, 1000)).toThrow('EDITION_UNVERIFIED');
  });
});
