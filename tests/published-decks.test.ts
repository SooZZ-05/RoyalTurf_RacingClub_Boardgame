import { describe, expect, it } from 'vitest';
import { EDITION, EDITION_STATUS, parsePublishedEdition } from '../src/shared/edition';
import {
  addHuman,
  applyCommand,
  legalActions,
  newRoom,
  seededRandom,
  viewForSeat,
} from '../src/shared/engine';
import observed from '../docs/observed-components.json';
import raw from '../src/data/edition.json';
import { seat } from './fixture';

// Independent transcription of rows/columns in the complete21-tile photograph.
const printedBase = [
  [
    [1, 15, 8, 4],
    [1, 8, 9, 10],
    [1, 3, 12, 12],
  ],
  [
    [2, 14, 1, 9],
    [2, 5, 11, 8],
    [2, 9, 8, 7],
  ],
  [
    [3, 9, 5, 7],
    [3, 10, 10, 1],
    [3, 1, 5, 15],
  ],
  [
    [4, 10, 7, 1],
    [4, 1, 13, 4],
    [4, 7, 3, 8],
  ],
  [
    [5, 1, 1, 13],
    [5, 6, 7, 2],
    [5, 8, 1, 6],
  ],
  [
    [6, 1, 10, 1],
    [6, 6, 4, 2],
    [6, 2, 2, 8],
  ],
  [
    [7, 1, 1, 7],
    [7, 3, 3, 3],
    [7, 5, 3, 1],
  ],
];

describe('complete published movement decks', () => {
  it('loads49 sourced profiles without claiming complete Chinese-manual certification', () => {
    expect(EDITION).not.toBeNull();
    expect(EDITION_STATUS).toMatchObject({
      ready: true,
      verified: false,
      limitedProfiles: false,
      supportedDecks: ['base', 'historical'],
    });
    expect(EDITION!.cards).toHaveLength(49);
    expect(new Set(EDITION!.cards.map((c) => c.id)).size).toBe(49);
    expect(EDITION!.cards.filter((c) => c.deck === 'historical')).toHaveLength(28);
    expect(
      EDITION!.cards.every((c) => c.evidence.startsWith('https://boardgamegeek.com/image/')),
    ).toBe(true);
    expect(EDITION!.rules).toMatchObject({
      paceDistance: 18,
      paceBonus: 100,
      paceRequiresPodium: false,
      lastPenalty: 100,
    });
  });
  it('matches every basic tile and all directly photographed Japanese/Chinese observations', () => {
    for (let horse = 0; horse < 7; horse++) {
      const cards = EDITION!.cards.filter((c) => c.deck === 'base' && c.horse === horse);
      expect(cards.map((c) => Object.values(c.moves))).toEqual(printedBase[horse]);
      expect(cards.every((c) => c.moves.head === horse + 1)).toBe(true);
      expect(cards.every((c) => c.names.en === observed.baseProfiles[horse].names.en)).toBe(true);
    }
    for (const card of [...observed.baseProfiles, ...observed.sneReferenceProfiles])
      expect(
        EDITION!.cards.some(
          (c) =>
            c.deck === 'base' &&
            c.horse === card.horse &&
            JSON.stringify(c.moves) === JSON.stringify(card.moves),
        ),
      ).toBe(true);
    for (const card of observed.historicalProfiles)
      expect(
        EDITION!.cards.find((c) => c.deck === 'historical' && c.names.en === card.names.en)!.moves,
      ).toEqual(card.moves);
  });
  it('keeps the two published historical renames and the other real printed names', () => {
    expect(EDITION!.cards.find((c) => c.names.en === 'Secretariat')!.moves).toEqual({
      head: 4,
      cap: 7,
      carrot: 5,
      shoe: 6,
    });
    expect(EDITION!.cards.find((c) => c.names.en === 'Seabiscuit')!.moves).toEqual({
      head: 7,
      cap: 1,
      carrot: 5,
      shoe: 3,
    });
    expect(EDITION!.cards.find((c) => c.names.en === 'Regret')!.moves).toEqual({
      head: 1,
      cap: 20,
      carrot: 4,
      shoe: 3,
    });
    expect(EDITION!.cards.some((c) => ['Challedon', 'Count Fleet'].includes(c.names.en))).toBe(
      false,
    );
    expect(
      EDITION!.cards.every(
        (c) => c.moves.head * 3 + c.moves.cap + c.moves.carrot + c.moves.shoe === 30,
      ),
    ).toBe(true);
  });
  it('matches an independent transcription of all four historical card sheets', () => {
    const printed = {
      Armed: [4, 4, 2, 12],
      Busher: [4, 1, 16, 1],
      Stymie: [3, 12, 4, 5],
      'Devil Diver': [2, 14, 1, 9],
      Zev: [2, 6, 6, 12],
      'Twilight Tear': [2, 9, 8, 7],
      Alsab: [1, 6, 12, 9],
      'Top Flight': [1, 3, 12, 12],
      Regret: [1, 20, 4, 3],
      'Gallant Fox': [5, 8, 3, 4],
      Exterminator: [5, 6, 7, 2],
      Discovery: [4, 10, 7, 1],
      Assault: [5, 1, 1, 13],
      Gallorette: [3, 9, 5, 7],
      'Sir Barton': [3, 10, 10, 1],
      Secretariat: [4, 7, 5, 6],
      'Twenty Grand': [3, 1, 5, 15],
      'Grey Lag': [2, 4, 12, 8],
      "Man o' War": [7, 4, 4, 1],
      Citation: [7, 3, 3, 3],
      Seabiscuit: [7, 1, 5, 3],
      'War Admiral': [7, 1, 1, 7],
      Colin: [6, 5, 6, 1],
      Whirlaway: [6, 1, 10, 1],
      Equipoise: [6, 5, 3, 4],
      'Phar Lap': [6, 3, 2, 7],
      Sysonby: [5, 4, 5, 6],
      'Old Rosebud': [1, 10, 9, 8],
    };
    expect(Object.keys(printed)).toHaveLength(28);
    for (const [name, values] of Object.entries(printed))
      expect(
        Object.values(
          EDITION!.cards.find((c) => c.deck === 'historical' && c.names.en === name)!.moves,
        ),
      ).toEqual(values);
  });
  it('requires complete cardinality, evidence and nonempty names for published data too', () => {
    const missing = structuredClone(raw);
    missing.cards.pop();
    expect(() => parsePublishedEdition(missing)).toThrow();
    const noEvidence = structuredClone(raw);
    noEvidence.cards[0].evidence = '';
    expect(() => parsePublishedEdition(noEvidence)).toThrow();
    const uncertified = structuredClone(raw);
    uncertified.sourceBacked = false;
    expect(() => parsePublishedEdition(uncertified)).toThrow();
  });

  for (const deck of ['base', 'historical'] as const)
    for (let variants = 0; variants < 8; variants++)
      it(`plays three real-card races without reuse: ${deck}, variants${variants}`, () => {
        const random = seededRandom(variants + 51);
        let state = addHuman(addHuman(newRoom('FULLDECK', seat('A')), seat('B')), seat('C'));
        state.settings = {
          deck,
          hidden: !!(variants & 1),
          crowded: !!(variants & 2),
          alternative: !!(variants & 4),
        };
        state = applyCommand(state, 'A', { type: 'start' }, random, EDITION, 1000);
        const used = new Set<string>();
        let race = 0,
          now = 1000,
          steps = 0;
        while (state.phase !== 'gameResults' && steps++ < 3000) {
          if (state.race !== race) {
            expect(state.horses).toHaveLength(7);
            expect(new Set(state.horses.map((h) => h.id)).size).toBe(7);
            for (const horse of state.horses) {
              expect(used.has(horse.cardId)).toBe(false);
              used.add(horse.cardId);
            }
            race = state.race;
            expect(state.remainingCards).toHaveLength((deck === 'base' ? 21 : 28) - race * 7);
          }
          now = Math.max(now + 1, state.presentation?.endsAt ?? 0);
          const actor = state.phase === 'raceResults' ? state.hostId : state.seats[state.turn].id;
          const type =
            state.phase === 'raceResults'
              ? 'nextRace'
              : state.phase === 'betting'
                ? 'bet'
                : state.phase === 'roll'
                  ? 'roll'
                  : 'move';
          const action = legalActions(state, actor, EDITION_STATUS, now).find(
            (c) => c.type === type,
          )!;
          state = applyCommand(state, actor, action, random, EDITION, now);
        }
        expect(state.phase).toBe('gameResults');
        expect(state.results).toHaveLength(3);
        expect(used.size).toBe(21);
        expect(state.results.every((r) => r.ranks.length === 3)).toBe(true);
        expect(state.seats.every((s) => s.money >= 0)).toBe(true);
        expect(viewForSeat(state, 'A', EDITION_STATUS, now).edition).toMatchObject({
          ready: true,
          verified: false,
          limitedProfiles: false,
          supportedDecks: ['base', 'historical'],
        });
        expect(EDITION!.cards).toEqual(parsePublishedEdition(raw).cards);
      });
});
