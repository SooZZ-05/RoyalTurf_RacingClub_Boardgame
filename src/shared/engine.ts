import {
  BOARD_THEME_IDS,
  DEFAULT_BOARD_THEME,
  DEFAULT_SETTINGS,
  SYMBOLS,
  type BetView,
  type FullEdition,
  type EditionStatus,
  type GameCommand,
  type GameState,
  type GameView,
  type Seat,
  type Settings,
} from './types';
import { DEMO_EDITION, SERIES_EDITION, upgradeKnownEdition } from './demo';
import { calculateRaceLedger, upgradePayoutCounting } from './settlement';

export const ROLL_PRESENTATION_MS = 4050;
export function movementDuration(distance: number) {
  return Math.max(450, Math.min(1800, Math.abs(distance) * 110));
}
export function presentationBusy(state: GameState, now = Date.now()) {
  return !!state.presentation && (state.pausedAt ?? now) < state.presentation.endsAt;
}

export type Random = (max: number) => number;
export class GameError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
function requireRule(ok: unknown, code: string): asserts ok {
  if (!ok) throw new GameError(code);
}
function pick(max: number, random: Random) {
  const n = random(max);
  requireRule(Number.isInteger(n) && n >= 0 && n < max, 'INVALID_RANDOM');
  return n;
}
export function shuffle<T>(items: T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pick(i + 1, random);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function newRoom(code: string, seat: Seat): GameState {
  return {
    schema: 1,
    payoutCountingVersion: 1,
    code,
    revision: 0,
    phase: 'lobby',
    boardTheme: DEFAULT_BOARD_THEME,
    boardThemeChanges: 0,
    paused: false,
    pausedAt: null,
    presentation: null,
    settings: { ...DEFAULT_SETTINGS },
    seats: [seat],
    hostId: seat.id,
    race: 0,
    turn: 0,
    starter: 0,
    edition: null,
    remainingCards: [],
    horses: [],
    hands: {},
    bets: [],
    rolled: null,
    pace: null,
    results: [],
    lastMove: null,
  };
}
export function addHuman(state: GameState, seat: Seat): GameState {
  requireRule(state.phase === 'lobby', 'GAME_STARTED');
  requireRule(state.seats.length < 6, 'ROOM_FULL');
  requireRule(!state.seats.some((s) => s.id === seat.id), 'INVALID_SEAT');
  return { ...state, revision: state.revision + 1, seats: [...state.seats, seat] };
}
function prepareRace(state: GameState, random: Random) {
  const edition = state.edition!;
  if ('reuseProfiles' in edition && edition.reuseProfiles)
    state.remainingCards = edition.cards
      .filter((card) => card.deck === state.settings.deck)
      .map((card) => card.id);
  const pool = shuffle(state.remainingCards, random);
  const selected: string[] = [];
  if (state.settings.deck === 'historical') selected.push(...pool.slice(0, 7));
  else {
    const colors = new Set<number>();
    for (const id of pool) {
      const card = edition.cards.find((c) => c.id === id)!;
      if (!colors.has(card.horse!)) {
        colors.add(card.horse!);
        selected.push(id);
      }
      if (selected.length === 7) break;
    }
  }
  requireRule(selected.length === 7, 'INCOMPLETE_DECK');
  state.remainingCards = pool.filter((id) => !selected.includes(id));
  state.horses = selected.map((cardId, order) => ({
    id: state.settings.deck === 'base' ? edition.cards.find((c) => c.id === cardId)!.horse! : order,
    cardId,
    position: state.settings.crowded || order === 0 ? 0 : -order,
    used: false,
    rank: null,
  }));
  state.hands = Object.fromEntries(
    state.seats.map((s) => [
      s.id,
      (state.settings.hidden ? [0, 1, 1, 2] : [1, 1, 2]).map((value, i) => ({
        id: `r${state.race}-${s.id}-${i}`,
        value,
      })),
    ]),
  );
  state.bets = [];
  state.rolled = null;
  state.pace = null;
  state.lastMove = null;
  state.presentation = null;
  state.turn = state.starter;
  state.phase = 'betting';
}
function active(state: GameState, actor: string) {
  requireRule(state.seats[state.turn]?.id === actor, 'NOT_YOUR_TURN');
}
function host(state: GameState, actor: string) {
  requireRule(state.hostId === actor, 'HOST_ONLY');
}
export function movedDestination(state: GameState, horseId: number, distance: number): number {
  const horse = state.horses.find((h) => h.id === horseId)!;
  let destination = horse.position + distance;
  const rules = state.edition!.rules;
  if (state.settings.crowded || destination >= rules.finishDistance) return destination;
  const mod = (n: number) => ((n % rules.trackLength) + rules.trackLength) % rules.trackLength;
  const occupied = new Set(
    state.horses.filter((h) => h.id !== horseId && h.rank === null).map((h) => mod(h.position)),
  );
  while (destination > horse.position && occupied.has(mod(destination))) destination--;
  return destination;
}
function settle(state: GameState) {
  const rules = state.edition!.rules;
  const ranks = state.horses
    .filter((h) => h.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .map((h) => h.id);
  const remaining = state.horses.filter((h) => h.rank === null);
  const lowest = Math.min(...remaining.map((h) => h.position));
  let last = remaining.filter((h) => h.position === lowest).map((h) => h.id);
  if (last.length > 1 && rules.lastTie === 'none') last = [];
  const ledger = calculateRaceLedger(
    rules,
    state.settings,
    state.race,
    state.seats,
    state.bets,
    ranks,
    last,
    state.pace,
  );
  for (const row of ledger) state.seats.find((seat) => seat.id === row.seatId)!.money = row.balance;
  state.results.push({
    race: state.race,
    ranks,
    last,
    pace: state.pace,
    ledger,
    bets: structuredClone(state.bets),
  });
  state.phase = state.race === (state.edition!.raceCount ?? 3) ? 'gameResults' : 'raceResults';
  state.rolled = null;
}
export function applyCommand(
  previous: GameState,
  actor: string,
  command: GameCommand,
  random: Random,
  availableEdition: FullEdition | null,
  now = Date.now(),
): GameState {
  requireRule(
    previous.seats.some((s) => s.id === actor),
    'INVALID_SEAT',
  );
  const state = structuredClone(previous);
  upgradeKnownEdition(state);
  upgradePayoutCounting(state);
  state.boardTheme ??= DEFAULT_BOARD_THEME;
  state.boardThemeChanges ??= 0;
  state.paused ??= false;
  state.pausedAt ??= null;
  state.presentation ??= null;
  if (!['boardTheme', 'pause', 'replace'].includes(command.type)) {
    requireRule(!state.paused, 'GAME_PAUSED');
    requireRule(!presentationBusy(state, now), 'PRESENTATION_ACTIVE');
  }
  switch (command.type) {
    case 'boardTheme':
      host(state, actor);
      requireRule(BOARD_THEME_IDS.includes(command.boardTheme), 'INVALID_BOARD_THEME');
      state.boardTheme = command.boardTheme;
      state.boardThemeChanges++;
      break;
    case 'pause': {
      host(state, actor);
      requireRule(
        state.phase !== 'lobby' && (state.phase !== 'gameResults' || presentationBusy(state, now)),
        'WRONG_PHASE',
      );
      if (command.paused === state.paused) break;
      if (command.paused) state.pausedAt = now;
      else {
        const delay = now - state.pausedAt!;
        if (state.presentation && state.pausedAt! < state.presentation.endsAt) {
          state.presentation.startedAt += delay;
          state.presentation.endsAt += delay;
          if (state.presentation.moveEndsAt !== undefined) state.presentation.moveEndsAt += delay;
        }
        state.pausedAt = null;
      }
      state.paused = command.paused;
      break;
    }
    case 'settings':
      host(state, actor);
      requireRule(state.phase === 'lobby', 'WRONG_PHASE');
      state.settings = { ...command.settings };
      break;
    case 'addBot':
      host(state, actor);
      requireRule(state.phase === 'lobby', 'WRONG_PHASE');
      requireRule(state.seats.length < 6, 'ROOM_FULL');
      state.seats.push({
        id: `bot-${state.revision}`,
        name: `Bot ${state.seats.filter((s) => s.bot).length + 1}`,
        bot: true,
        connected: true,
        disconnectedAt: null,
        money: 0,
      });
      break;
    case 'removeBot':
      host(state, actor);
      requireRule(state.phase === 'lobby', 'WRONG_PHASE');
      requireRule(
        state.seats.some((s) => s.id === command.seatId && s.bot),
        'INVALID_SEAT',
      );
      state.seats = state.seats.filter((s) => s.id !== command.seatId);
      break;
    case 'start':
    case 'startSeries':
    case 'startDemo': {
      host(state, actor);
      requireRule(state.phase === 'lobby', 'WRONG_PHASE');
      requireRule(state.seats.length >= 2 && state.seats.length <= 6, 'NEED_PLAYERS');
      if (command.type === 'start')
        requireRule(
          availableEdition &&
            (availableEdition.verified ||
              ('sourceBacked' in availableEdition && availableEdition.sourceBacked)),
          'EDITION_UNVERIFIED',
        );
      state.edition = structuredClone(
        command.type === 'startDemo'
          ? DEMO_EDITION
          : command.type === 'startSeries'
            ? SERIES_EDITION
            : availableEdition!,
      );
      if (state.edition.demo) state.settings = { ...DEFAULT_SETTINGS };
      if (command.type === 'startSeries')
        requireRule(state.settings.deck === 'base', 'DECK_UNAVAILABLE');
      state.race = 1;
      state.remainingCards = state.edition.cards
        .filter((c) => c.deck === state.settings.deck)
        .map((c) => c.id);
      state.starter = pick(state.seats.length, random);
      prepareRace(state, random);
      break;
    }
    case 'bet': {
      requireRule(state.phase === 'betting', 'WRONG_PHASE');
      active(state, actor);
      requireRule(
        state.horses.some((h) => h.id === command.horseId),
        'INVALID_HORSE',
      );
      requireRule(
        !state.bets.some((b) => b.seatId === actor && b.horseId === command.horseId),
        'ALREADY_BET',
      );
      const chip = state.hands[actor]?.find((c) => c.id === command.chipId);
      requireRule(chip, 'INVALID_CHIP');
      state.bets.push({ seatId: actor, horseId: command.horseId, chip });
      state.hands[actor] = state.hands[actor].filter((c) => c.id !== chip.id);
      state.turn = (state.turn + 1) % state.seats.length;
      if (state.seats.every((s) => state.hands[s.id].length === 0)) {
        state.phase = 'roll';
        state.turn = state.starter;
      }
      break;
    }
    case 'roll': {
      requireRule(state.phase === 'roll', 'WRONG_PHASE');
      active(state, actor);
      const faces = ['head', 'head', 'head', 'cap', 'carrot', 'shoe'] as const;
      state.rolled = faces[pick(6, random)];
      state.phase = 'move';
      state.presentation = {
        id: state.revision + 1,
        kind: 'roll',
        actorId: actor,
        symbol: state.rolled,
        startedAt: now,
        endsAt: now + ROLL_PRESENTATION_MS,
        duration: ROLL_PRESENTATION_MS,
      };
      break;
    }
    case 'move': {
      requireRule(state.phase === 'move' && state.rolled, 'WRONG_PHASE');
      active(state, actor);
      const horse = state.horses.find((h) => h.id === command.horseId);
      requireRule(horse && horse.rank === null && !horse.used, 'HORSE_UNAVAILABLE');
      const card = state.edition!.cards.find((c) => c.id === horse.cardId)!;
      const distance = card.moves[state.rolled];
      const from = horse.position;
      const priorUsed = state.horses.filter((h) => h.used).map((h) => h.id);
      horse.position = movedDestination(state, horse.id, distance);
      horse.used = true;
      const moveMs = movementDuration(horse.position - from);
      state.presentation = {
        id: state.revision + 1,
        kind: 'move',
        actorId: actor,
        symbol: state.rolled,
        startedAt: now,
        endsAt: now + moveMs + 720,
        duration: moveMs + 720,
        moveEndsAt: now + moveMs,
        horseId: horse.id,
        from,
        to: horse.position,
        priorUsed,
      };
      state.lastMove = {
        horseId: horse.id,
        from,
        to: horse.position,
        symbol: state.rolled,
        distance,
        blocked: from + distance - horse.position,
      };
      if (state.pace === null && horse.position >= state.edition!.rules.paceDistance)
        state.pace = horse.id;
      if (horse.position >= state.edition!.rules.finishDistance)
        horse.rank = state.horses.filter((h) => h.rank !== null).length + 1;
      if (state.horses.filter((h) => h.rank !== null).length === 3) {
        settle(state);
        break;
      }
      if (state.horses.filter((h) => h.rank === null).every((h) => h.used))
        for (const h of state.horses) if (h.rank === null) h.used = false;
      state.rolled = null;
      state.phase = 'roll';
      state.turn = (state.turn + 1) % state.seats.length;
      break;
    }
    case 'nextRace': {
      host(state, actor);
      requireRule(state.phase === 'raceResults', 'WRONG_PHASE');
      const values = state.seats.map((s) =>
        state.edition!.rules.laterStarter === 'totalMoney'
          ? s.money
          : state.results.at(-1)!.ledger.find((l) => l.seatId === s.id)!.winnings +
            state.results.at(-1)!.ledger.find((l) => l.seatId === s.id)!.bonus -
            state.results.at(-1)!.ledger.find((l) => l.seatId === s.id)!.paidPenalty,
      );
      const highest = Math.max(...values);
      const tied = values.flatMap((v, i) => (v === highest ? [i] : []));
      state.starter = tied[pick(tied.length, random)];
      state.race++;
      prepareRace(state, random);
      break;
    }
    case 'rematch': {
      host(state, actor);
      requireRule(state.phase === 'gameResults', 'WRONG_PHASE');
      const room = newRoom(state.code, { ...state.seats[0], money: 0 });
      room.seats = state.seats.map((s) => ({ ...s, money: 0 }));
      room.hostId = state.hostId;
      room.settings = state.settings;
      room.boardTheme = state.boardTheme;
      room.boardThemeChanges = state.boardThemeChanges;
      room.revision = state.revision;
      Object.assign(state, room);
      break;
    }
    case 'replace': {
      host(state, actor);
      requireRule(state.phase !== 'lobby' && state.phase !== 'gameResults', 'WRONG_PHASE');
      const seat = state.seats.find((s) => s.id === command.seatId);
      requireRule(
        seat &&
          !seat.connected &&
          !seat.bot &&
          seat.disconnectedAt !== null &&
          now - seat.disconnectedAt >= 60000,
        'REPLACE_TOO_SOON',
      );
      seat.bot = true;
      break;
    }
  }
  state.revision++;
  return state;
}
export function legalActions(
  state: GameState,
  actor: string,
  status: EditionStatus,
  now = Date.now(),
): GameCommand[] {
  const commands: GameCommand[] = [];
  if (actor === state.hostId) {
    for (const boardTheme of BOARD_THEME_IDS) commands.push({ type: 'boardTheme', boardTheme });
    if (state.phase === 'lobby') {
      if (state.seats.length < 6) commands.push({ type: 'addBot' });
      for (const s of state.seats.filter((s) => s.bot))
        commands.push({ type: 'removeBot', seatId: s.id });
      if (status.ready && state.seats.length >= 2) commands.push({ type: 'start' });
      if (state.seats.length >= 2) commands.push({ type: 'startDemo' });
      if (state.seats.length >= 2 && state.settings.deck === 'base')
        commands.push({ type: 'startSeries' });
    }
    if (state.phase !== 'lobby' && (state.phase !== 'gameResults' || presentationBusy(state, now)))
      commands.push({ type: 'pause', paused: !state.paused });
    if (state.phase === 'raceResults') commands.push({ type: 'nextRace' });
    if (state.phase === 'gameResults') commands.push({ type: 'rematch' });
    if (state.phase !== 'lobby' && state.phase !== 'gameResults')
      for (const s of state.seats)
        if (!s.bot && !s.connected && s.disconnectedAt !== null && now - s.disconnectedAt >= 60000)
          commands.push({ type: 'replace', seatId: s.id });
  }
  if (state.paused || presentationBusy(state, now))
    return commands.filter((c) => ['boardTheme', 'pause', 'replace'].includes(c.type));
  if (state.seats[state.turn]?.id !== actor) return commands;
  if (state.phase === 'roll') commands.push({ type: 'roll' });
  if (state.phase === 'move')
    for (const h of state.horses.filter((h) => h.rank === null && !h.used))
      commands.push({ type: 'move', horseId: h.id });
  if (state.phase === 'betting')
    for (const chip of state.hands[actor] ?? [])
      for (const h of state.horses)
        if (!state.bets.some((b) => b.seatId === actor && b.horseId === h.id))
          commands.push({ type: 'bet', horseId: h.id, chipId: chip.id });
  return commands;
}
export function viewForSeat(
  state: GameState,
  selfId: string,
  status: EditionStatus,
  now = Date.now(),
): GameView {
  requireRule(
    state.seats.some((s) => s.id === selfId),
    'INVALID_SEAT',
  );
  const revealed = state.phase === 'raceResults' || state.phase === 'gameResults';
  const bets: BetView[] = state.bets.map((b) => ({
    seatId: b.seatId,
    horseId: b.horseId,
    value: !state.settings.hidden || revealed || b.seatId === selfId ? b.chip.value : null,
  }));
  return {
    code: state.code,
    revision: state.revision,
    phase: state.phase,
    boardTheme: state.boardTheme ?? DEFAULT_BOARD_THEME,
    paused: state.paused ?? false,
    pausedAt: state.pausedAt ?? null,
    presentation: state.presentation ? structuredClone(state.presentation) : null,
    serverNow: now,
    settings: { ...state.settings },
    seats: structuredClone(state.seats),
    hostId: state.hostId,
    selfId,
    race: state.race,
    activeId: ['betting', 'roll', 'move'].includes(state.phase)
      ? (state.seats[state.turn]?.id ?? null)
      : null,
    horses: state.horses.map((h) => {
      const card = state.edition!.cards.find((c) => c.id === h.cardId)!;
      return { ...h, names: { ...card.names }, moves: { ...card.moves } };
    }),
    hand: structuredClone(state.hands[selfId] ?? []),
    bets,
    rolled: state.rolled,
    pace: state.pace,
    results: structuredClone(state.results),
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    legal: legalActions(state, selfId, status, now),
    edition: state.edition
      ? {
          ready:
            state.edition.verified ||
            ('sourceBacked' in state.edition && state.edition.sourceBacked),
          verified: state.edition.verified,
          id: state.edition.id,
          version: state.edition.version,
          missing: state.edition.verified ? [] : status.missing,
          demo: !!state.edition.demo,
          raceCount: state.edition.raceCount ?? 3,
          limitedProfiles: !state.edition.verified && !('sourceBacked' in state.edition),
          supportedDecks:
            state.edition.verified || 'sourceBacked' in state.edition
              ? ['base', 'historical']
              : ['base'],
        }
      : status,
    rules: state.edition ? structuredClone(state.edition.rules) : null,
  };
}
export function seededRandom(seed: number): Random {
  let s = seed >>> 0;
  return (max) => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) % max;
  };
}
export function meanMovement(moves: Record<(typeof SYMBOLS)[number], number>) {
  return (moves.head * 3 + moves.cap + moves.carrot + moves.shoe) / 6;
}
