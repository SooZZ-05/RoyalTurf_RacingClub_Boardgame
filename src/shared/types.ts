export const SYMBOLS = ['head', 'cap', 'carrot', 'shoe'] as const;
export type Symbol = (typeof SYMBOLS)[number];
export type Language = 'zh-Hant' | 'en';
export type Names = Record<Language, string>;
export type Moves = Record<Symbol, number>;
export type Deck = 'base' | 'historical';
export type Phase = 'lobby' | 'betting' | 'roll' | 'move' | 'raceResults' | 'gameResults';
export const BOARD_THEME_IDS = ['royal-club', 'imperial-porcelain', 'nocturne'] as const;
export type BoardTheme = (typeof BOARD_THEME_IDS)[number];
export const DEFAULT_BOARD_THEME: BoardTheme = 'royal-club';
export interface Settings {
  deck: Deck;
  hidden: boolean;
  crowded: boolean;
  alternative: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  deck: 'base',
  hidden: false,
  crowded: false,
  alternative: false,
};
export const HORSE_COLORS = [
  '#f1ecda',
  '#3f4044',
  '#e596a8',
  '#508ed0',
  '#e7bf4a',
  '#62a47b',
  '#dd8651',
];
export interface Card {
  id: string;
  deck: Deck;
  horse: number | null;
  names: Names;
  moves: Moves;
  evidence: string;
}
export interface Edition {
  id: string;
  version: string;
  verified: true;
  demo?: false;
  raceCount?: 3;
  verification: { reviewer: string; date: string; sources: string[] };
  cards: Card[];
  rules: {
    trackLength: number;
    finishDistance: number;
    paceDistance: number;
    payout: [number[], number[], number[]];
    paceBonus: number;
    lastPenalty: number;
    paceRequiresPodium: boolean;
    lastTie: 'all' | 'none';
    penaltyAfterWinnings: boolean;
    laterStarter: 'totalMoney' | 'raceWinnings';
    sharedVictory: boolean;
    evidence: Record<string, string>;
  };
}
/** Complete published numerical decks; Chinese manual/label certification is separate. */
export interface PublishedEdition extends Omit<Edition, 'verified'> {
  verified: false;
  sourceBacked: true;
}
export type FullEdition = Edition | PublishedEdition;
export interface DemoEdition extends Omit<Edition, 'verified' | 'demo' | 'raceCount'> {
  verified: false;
  demo: true;
  raceCount: 1;
}
/** Three-race adaptation using only the seven photographed profiles. */
export interface SeriesEdition extends Omit<Edition, 'verified' | 'demo' | 'raceCount'> {
  verified: false;
  demo: false;
  raceCount: 3;
  reuseProfiles: true;
}
export type PlayableEdition = FullEdition | DemoEdition | SeriesEdition;
export interface Presentation {
  id: number;
  kind: 'roll' | 'move';
  actorId: string;
  symbol: Symbol;
  startedAt: number;
  endsAt: number;
  duration: number;
  horseId?: number;
  from?: number;
  to?: number;
  moveEndsAt?: number;
  priorUsed?: number[];
}
export interface Seat {
  id: string;
  name: string;
  bot: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  money: number;
}
export interface Chip {
  id: string;
  value: number;
}
export interface Bet {
  seatId: string;
  horseId: number;
  chip: Chip;
}
export interface Horse {
  id: number;
  cardId: string;
  position: number;
  used: boolean;
  rank: number | null;
}
export interface Ledger {
  seatId: string;
  winnings: number;
  bonus: number;
  penalty: number;
  paidPenalty: number;
  balance: number;
}
export interface RaceResult {
  race: number;
  ranks: number[];
  last: number[];
  pace: number | null;
  ledger: Ledger[];
  bets: Bet[];
}
export interface RecordedEvent {
  revision: number;
  at: number;
  actor: string;
  command: GameCommand;
  random: number[];
}
export interface ReplayFrame {
  revision: number;
  race: number;
  phase: Phase;
  horses: HorseView[];
  rolled: Symbol | null;
  pace: number | null;
  lastMove: GameState['lastMove'];
  actor: string;
  action: GameCommand['type'];
}
export interface GameState {
  schema: 1;
  /** Saved payouts upgraded to count positive chips, excluding bluff chips. */
  payoutCountingVersion?: 1;
  code: string;
  revision: number;
  phase: Phase;
  boardTheme: BoardTheme;
  /** Cosmetic changes are excluded from the revision used to seed bot decisions. */
  boardThemeChanges: number;
  paused: boolean;
  pausedAt: number | null;
  presentation: Presentation | null;
  settings: Settings;
  seats: Seat[];
  hostId: string;
  race: number;
  turn: number;
  starter: number;
  edition: PlayableEdition | null;
  remainingCards: string[];
  horses: Horse[];
  hands: Record<string, Chip[]>;
  bets: Bet[];
  rolled: Symbol | null;
  pace: number | null;
  results: RaceResult[];
  lastMove: {
    horseId: number;
    from: number;
    to: number;
    symbol: Symbol;
    distance: number;
    blocked: number;
  } | null;
}
export type GameCommand =
  | { type: 'boardTheme'; boardTheme: BoardTheme }
  | { type: 'pause'; paused: boolean }
  | { type: 'settings'; settings: Settings }
  | { type: 'addBot' }
  | { type: 'removeBot'; seatId: string }
  | { type: 'start' }
  | { type: 'startDemo' }
  | { type: 'startSeries' }
  | { type: 'bet'; horseId: number; chipId: string }
  | { type: 'roll' }
  | { type: 'move'; horseId: number }
  | { type: 'nextRace' }
  | { type: 'rematch' }
  | { type: 'replace'; seatId: string };
export interface CommandEnvelope {
  commandId: string;
  expectedRevision: number;
  command: GameCommand;
}
export interface HorseView extends Horse {
  names: Names;
  moves: Moves;
}
export interface BetView {
  seatId: string;
  horseId: number;
  value: number | null;
}
export interface EditionStatus {
  ready: boolean;
  verified?: boolean;
  id: string;
  version: string;
  missing: string[];
  demo?: boolean;
  raceCount?: number;
  limitedProfiles?: boolean;
  supportedDecks?: Deck[];
}
export interface GameView {
  code: string;
  revision: number;
  phase: Phase;
  boardTheme: BoardTheme;
  paused: boolean;
  pausedAt: number | null;
  presentation: Presentation | null;
  serverNow: number;
  settings: Settings;
  seats: Seat[];
  hostId: string;
  selfId: string;
  race: number;
  activeId: string | null;
  horses: HorseView[];
  hand: Chip[];
  bets: BetView[];
  rolled: Symbol | null;
  pace: number | null;
  results: RaceResult[];
  lastMove: GameState['lastMove'];
  legal: GameCommand[];
  edition: EditionStatus;
  rules: Edition['rules'] | null;
}
