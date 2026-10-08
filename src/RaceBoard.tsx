import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import observed from '../docs/observed-components.json';
import { GameSymbol } from './GameArt';
import { getBoardTheme } from './themes';
import {
  HORSE_COLORS,
  SYMBOLS,
  type BetView,
  type GameView,
  type HorseView,
  type Language,
  type Symbol,
} from './shared/types';
import { buildTrack, mixPoint, physicalSpace } from './board/geometry';
import './race-board.css';

const PLAYER_COLORS = ['#365971', '#84464f', '#916d3a', '#496a55', '#705887', '#a76638'];
export const seatColor = (index: number) =>
  PLAYER_COLORS[Math.max(0, index) % PLAYER_COLORS.length];
const symbolNames: Record<Symbol, { en: string; 'zh-Hant': string }> = {
  head: { en: 'Horse head', 'zh-Hant': '馬頭' },
  cap: { en: 'Jockey cap', 'zh-Hant': '騎師帽' },
  carrot: { en: 'Carrot', 'zh-Hant': '紅蘿蔔' },
  shoe: { en: 'Horseshoe', 'zh-Hant': '馬蹄鐵' },
};

const lobbyHorses: HorseView[] = observed.baseProfiles.map((profile) => ({
  id: profile.horse,
  cardId: `photographed-${profile.horse}`,
  names: profile.names,
  moves: profile.moves,
  position: -profile.horse,
  used: false,
  rank: null,
}));

export interface RaceBoardProps {
  view: GameView;
  language: Language;
  selectedChip?: string | null;
  onHorseSelect: (horseId: number) => void;
  interactionLocked?: boolean;
  /** Fractional authoritative presentation positions, while a horse is travelling. */
  displayPositions?: Readonly<Record<number, number>>;
  /** Keep a card face up until its horse's movement presentation has arrived. */
  displayUsed?: Readonly<Record<number, boolean>>;
  movingHorseId?: number | null;
  children?: ReactNode;
}

function BoardDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="race-board-dialog"
      aria-labelledby={id}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <button type="button" className="rb-dialog-close" aria-label="Close / 關閉" onClick={onClose}>
        ×
      </button>
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}

export function CardFront({
  horse,
  symbol,
  language,
}: {
  horse: HorseView;
  symbol: Symbol | null;
  language: Language;
}) {
  // Only the original Blue Ocean profile can use the complete printed specimen.
  // Historical / later cards must show their actual names and movement values.
  const exactSpecimen =
    horse.names.en.toLowerCase() === 'blue ocean' &&
    horse.moves.head === 4 &&
    horse.moves.cap === 10 &&
    horse.moves.carrot === 7 &&
    horse.moves.shoe === 1;
  if (exactSpecimen)
    return (
      <span className="rb-card-face rb-card-front rb-exact-source">
        <span className="rb-exact-art" />
        {symbol && (
          <span
            className="rb-exact-highlight"
            style={{ '--stat-index': SYMBOLS.indexOf(symbol) } as CSSProperties}
          />
        )}
      </span>
    );
  return (
    <span className="rb-card-face rb-card-front">
      <span className="rb-card-portrait">
        <span className="rb-card-number">{String(horse.id + 1).padStart(2, '0')}</span>
      </span>
      <span className="rb-card-name">{horse.names[language]}</span>
      <span className="rb-card-en">{horse.names.en.toUpperCase()}</span>
      <span className="rb-card-stats">
        {SYMBOLS.map((key) => (
          <span key={key} className={`rb-stat ${symbol === key ? 'highlight' : ''}`}>
            <GameSymbol symbol={key} />
            <span>{symbolNames[key].en.toUpperCase()}</span>
            <strong>{horse.moves[key]}</strong>
          </span>
        ))}
      </span>
    </span>
  );
}

export function RaceBoard({
  view,
  language,
  selectedChip,
  onHorseSelect,
  interactionLocked = false,
  displayPositions,
  displayUsed,
  movingHorseId = null,
  children,
}: RaceBoardProps) {
  const theme = getBoardTheme(view.boardTheme);
  const text = (zh: string, en: string) => (language === 'en' ? en : zh);
  const horses = [...(view.horses.length ? view.horses : lobbyHorses)].sort((a, b) => a.id - b.id);
  const track = useMemo(() => buildTrack(view.boardTheme), [view.boardTheme]);
  const [inspection, setInspection] = useState<
    { kind: 'card' | 'bets'; horseId: number } | { kind: 'payout' } | null
  >(null);
  const rollPresentationId = view.presentation?.kind === 'roll' ? view.presentation.id : null;
  useEffect(() => {
    // Native dialogs occupy the browser's top layer. Clear inspections when
    // anyone rolls so every player can see the shared dice-result presentation.
    if (rollPresentationId) setInspection(null);
  }, [rollPresentationId]);
  const uniqueId = useId().replaceAll(':', '');
  const finishPattern = `rb-finish-${uniqueId}`;
  const titleId = `rb-track-title-${uniqueId}`;
  const table = view.rules?.payout ?? observed.board.payout;
  const unitBonus = (view.rules?.paceBonus ?? 100) * (view.race === 3 ? 2 : 1);
  const unitPenalty = (view.rules?.lastPenalty ?? 100) * (view.race === 3 ? 2 : 1);
  const settlement =
    ['raceResults', 'gameResults'].includes(view.phase) && movingHorseId === null
      ? view.results.find((result) => result.race === view.race)
      : undefined;
  const isLast = (id: number) => !!settlement?.last.includes(id);
  const lastStand: [number, number] = view.boardTheme === 'nocturne' ? [1120, 438] : [1140, 442];

  const used = (horse: HorseView) => displayUsed?.[horse.id] ?? horse.used;
  const position = (horse: HorseView) => displayPositions?.[horse.id] ?? horse.position;
  const canSelect = (horseId: number) =>
    !interactionLocked &&
    view.legal.some(
      (command) =>
        (command.type === 'move' && command.horseId === horseId) ||
        (command.type === 'bet' && command.horseId === horseId && command.chipId === selectedChip),
    );
  const choose = (horse: HorseView) =>
    canSelect(horse.id)
      ? onHorseSelect(horse.id)
      : setInspection({ kind: 'card', horseId: horse.id });
  const inspectedHorse =
    inspection && 'horseId' in inspection
      ? horses.find((horse) => horse.id === inspection.horseId)
      : undefined;
  const player = (id: string) => view.seats.find((seat) => seat.id === id);
  const chip = (bet: BetView, key?: string) => {
    const seat = player(bet.seatId);
    const initial = seat?.name.trim().slice(0, 1).toUpperCase() || '?';
    return (
      <span
        key={key}
        className={`rb-bet-chip ${bet.value === null ? 'face-down' : 'face-up'}`}
        style={
          {
            '--bettor': seatColor(view.seats.findIndex((seat) => seat.id === bet.seatId)),
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <b>{bet.value === null ? initial : bet.value}</b>
        {bet.value !== null && <small>{initial}</small>}
      </span>
    );
  };
  const payoutTable = (detail: boolean) => (
    <table className={`rb-payout-table ${detail ? 'detail' : ''}`}>
      <caption className="rb-sr-only">
        {text(
          '同一匹馬的非零下注人數與每票獎金',
          'Players with positive bets on a horse and winnings per unit',
        )}
      </caption>
      <thead>
        <tr>
          <th scope="col">{text('下注人數', 'Bettors')}</th>
          {['1', '2', '3', '4', '5+'].map((value) => (
            <th key={value} scope="col">
              {value}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.map((row, index) => (
          <tr key={index}>
            <th scope="row">
              {text(['冠軍', '亞軍', '季軍'][index], ['1st', '2nd', '3rd'][index])}
            </th>
            {row.map((amount, column) => (
              <td key={column}>{amount}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const checkpoint = track.cells.find((cell) => cell.number === 18)!;
  const checkpointEdge = mixPoint(checkpoint.inner, checkpoint.innerNext, 0.5);
  const anchors = {
    'royal-club': [88.1, 80.8],
    'imperial-porcelain': [88.5, 80.3],
    nocturne: [92.4, 81.6],
  }[view.boardTheme];

  return (
    <section
      className="race-board"
      data-board-theme={view.boardTheme}
      aria-label={text('皇家賽馬場棋盤', 'Royal Turf game board')}
    >
      <div
        className="race-board-scene"
        style={
          { '--rb-atlas': `url('/game-art/horse-sprites-${view.boardTheme}.png')` } as CSSProperties
        }
      >
        <img
          className="rb-backdrop"
          src={`/game-art/${view.boardTheme}-empty-board.png`}
          alt={theme.description[language]}
          draggable="false"
          fetchPriority="high"
        />
        <svg
          className="rb-numbered-track"
          viewBox="0 0 1536 1024"
          role="img"
          aria-labelledby={titleId}
          data-race-direction="clockwise"
        >
          <title id={titleId}>
            {text(
              '順時針 36 格賽道，第 18 格領先點；起點 −6 至 0 對應 30 至 36',
              '36 spaces clockwise, checkpoint 18; starting positions −6 to 0 share spaces 30 to 36',
            )}
          </title>
          <defs>
            <pattern id={finishPattern} width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="#faf4e7" />
              <path d="M0 0h6v6H0zM6 6h6v6H6z" fill="#26342d" />
            </pattern>
          </defs>
          {track.cells.map((cell) => (
            <g
              key={cell.number}
              data-cell={cell.number}
              data-start-offset={cell.alias ?? undefined}
            >
              <polygon
                points={[cell.inner, cell.outer, cell.outerNext, cell.innerNext]
                  .map((point) => point.join(','))
                  .join(' ')}
                className={`rb-track-cell ${cell.number === 18 ? 'checkpoint' : ''}`}
              />
              {cell.number !== 36 && (
                <line
                  x1={cell.inner[0]}
                  y1={cell.inner[1]}
                  x2={cell.outer[0]}
                  y2={cell.outer[1]}
                  className="rb-track-divider"
                />
              )}
              <text
                x={cell.label[0]}
                y={cell.label[1] + 6}
                textAnchor="middle"
                className={`rb-track-number ${cell.alias !== null ? 'starting' : ''}`}
              >
                <tspan>{cell.number}</tspan>
                {cell.alias !== null && (
                  <tspan className="rb-start-alias">
                    {' '}
                    / {cell.alias === 0 ? '0' : `−${Math.abs(cell.alias)}`}
                  </tspan>
                )}
              </text>
            </g>
          ))}
          <polygon
            points={track.finishPoints.map((point) => point.join(',')).join(' ')}
            fill={`url(#${finishPattern})`}
            data-finish-between="36,1"
          />
          <g transform={`translate(${checkpointEdge.join(' ')})`} data-checkpoint="18">
            <path d="M0 3 L5 9 L0 15 L-5 9 Z" className="rb-checkpoint-diamond" />
            <rect x="-77" y="20" width="154" height="43" rx="5" className="rb-checkpoint-plate" />
            <text x="0" y="39" textAnchor="middle" className="rb-checkpoint-title">
              {text('18 領先點', 'CHECKPOINT 18')}
            </text>
            <text x="0" y="53" textAnchor="middle" className="rb-checkpoint-caption">
              {view.pace === null
                ? text('首匹通過領取標記', 'FIRST HORSE TAKES THE MARKER')
                : `${text('領先馬', 'PACE HORSE')} ${view.pace + 1} · +$${unitBonus}`}
            </text>
          </g>
          {settlement && settlement.last.length > 0 && (
            <g data-last-place-space="7" transform={`translate(${lastStand.join(' ')})`}>
              <ellipse rx="44" ry="14" className="rb-last-stand" />
              <text x="0" y="37" textAnchor="middle" className="rb-last-stand-label">
                7 · −${unitPenalty}
              </text>
            </g>
          )}
          {[5, 24].map((space) => {
            const cell = track.cells.find((cell) => cell.number === space)!;
            const edge = mixPoint(cell.inner, cell.innerNext, 0.5);
            const center = mixPoint(edge, [768, 365], 0.06);
            const after = track.point(space + 1),
              before = track.point(space);
            const angle = (Math.atan2(after[1] - before[1], after[0] - before[0]) * 180) / Math.PI;
            return (
              <path
                key={space}
                d="M-15 0 H15 M7 -6 L15 0 L7 6"
                className="rb-direction-arrow"
                transform={`translate(${center.join(' ')}) rotate(${angle})`}
              />
            );
          })}
        </svg>
        <div
          className="rb-horse-pieces"
          role="group"
          aria-label={text('棋盤上的七匹賽馬', 'Seven horse pieces on the board')}
        >
          {horses.map((horse) => {
            const progress = position(horse);
            const moving = movingHorseId === horse.id;
            const onPodium = horse.rank !== null && !moving;
            const onLastStand = isLast(horse.id) && !moving;
            let point = track.point(progress);
            const before = track.point(progress - 0.05),
              after = track.point(progress + 0.05);
            const dx = after[0] - before[0];
            const moveFrom =
              view.presentation?.kind === 'move'
                ? (view.presentation.from ?? progress)
                : (view.lastMove?.from ?? progress);
            const packPosition = (other: HorseView) =>
              other.id === movingHorseId ? moveFrom : position(other);
            const packAt = moving ? moveFrom : progress;
            const companions = onPodium
              ? []
              : horses.filter(
                  (other) =>
                    (other.rank === null || other.id === movingHorseId) &&
                    Math.abs(physicalSpace(packPosition(other)) - physicalSpace(packAt)) < 0.01,
                );
            const packSize = companions.length;
            let pieceWidth = 100;
            if (packSize > 1) {
              // A compact pack makes every horse selectable even when the
              // crowded variant starts all seven on one physical space.
              // The old radial fan could hide pieces underneath the prize table.
              const index = companions.findIndex((other) => other.id === horse.id);
              const packedWidth = packSize > 3 ? 64 : 80;
              // Leave the source pack continuously during the first step;
              // the other figurines keep their positions throughout the move.
              const departing = moving ? Math.min(1, Math.abs(progress - moveFrom)) : 0;
              pieceWidth = packedWidth + (100 - packedWidth) * departing;
              const columns = Math.min(packSize, 4),
                row = Math.floor(index / columns);
              const rowCount = Math.min(columns, packSize - row * columns);
              const spacing = packSize > 3 ? 55 : 64;
              point = [
                point[0] + ((index % columns) - (rowCount - 1) / 2) * spacing * (1 - departing),
                point[1] + (packSize > 4 ? (row ? 23 : -23) : 0) * (1 - departing),
              ];
            }
            if (onPodium) {
              const podium =
                view.boardTheme === 'royal-club'
                  ? [
                      [768, 272],
                      [694, 286],
                      [840, 286],
                    ]
                  : [
                      [768, 258],
                      [676, 284],
                      [858, 284],
                    ];
              point = podium[Math.min(2, Math.max(0, horse.rank! - 1))] as [number, number];
            }
            if (onLastStand) {
              const index = settlement!.last.indexOf(horse.id);
              point = [
                lastStand[0] + (index - (settlement!.last.length - 1) / 2) * 72,
                lastStand[1],
              ];
              pieceWidth = settlement!.last.length > 1 ? 64 : 100;
            }
            const status = onPodium
              ? text(`第 ${horse.rank} 名`, `Place ${horse.rank}`)
              : moving
                ? text('前進中', 'Moving')
                : used(horse)
                  ? text('已行動', 'Already moved')
                  : canSelect(horse.id)
                    ? text('可以選擇', 'Available')
                    : text('等待回合', 'Waiting');
            const description = `${horse.id + 1} ${horse.names[language]} · ${isLast(horse.id) ? text('墊底', 'Last place') : status} · ${text('位置', 'Position')} ${horse.position}`;
            return (
              <button
                type="button"
                key={horse.id}
                className={`rb-horse-piece ${canSelect(horse.id) ? 'selectable' : ''} ${used(horse) ? 'used' : ''} ${moving ? 'moving' : ''} ${onPodium ? 'podium' : ''} ${onLastStand ? 'last-stand' : ''}`}
                data-on-last-stand={onLastStand ? 'true' : undefined}
                data-horse-piece={horse.id}
                data-position={horse.position}
                data-progress-position={progress}
                aria-label={description}
                title={description}
                onClick={() => choose(horse)}
                style={
                  {
                    left: `${(point[0] / 1536) * 100}%`,
                    top: `${(point[1] / 1024) * 100}%`,
                    zIndex: Math.round(point[1]),
                    '--piece-color': HORSE_COLORS[horse.id],
                    '--piece-width': `${(pieceWidth / 1536) * 100}cqw`,
                    '--sprite-x': `${((horse.id % 4) / 3) * 100}%`,
                    '--sprite-y': horse.id < 4 ? '0%' : '100%',
                    '--base-anchor': `${anchors[horse.id < 4 ? 0 : 1]}%`,
                    '--piece-facing': dx > 0.08 && !onPodium ? -1 : 1,
                    '--piece-hop': moving
                      ? `${Math.sin((progress - Math.floor(progress)) * Math.PI) * 0.26}cqw`
                      : '0cqw',
                  } as CSSProperties
                }
              >
                <span className="rb-piece-ground" />
                <span className="rb-piece-art" />
                <span className="rb-piece-number">{horse.id + 1}</span>
                {isLast(horse.id) && (
                  <span className="rb-last-marker" aria-hidden="true">
                    7
                  </span>
                )}
                {view.pace === horse.id && (
                  <span
                    className="rb-pace-marker"
                    title={text('第 18 格領先馬', 'Checkpoint 18 leader')}
                  >
                    ◆
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <section
          className="rb-payout-plate"
          aria-label={text('每票獎金表', 'Winnings per betting unit')}
        >
          <div className="rb-payout-title">
            <span>{text('每票獎金', 'PRIZE PER UNIT')}</span>
            <span>↗</span>
          </div>
          {payoutTable(false)}
          <button
            type="button"
            className="rb-payout-expand"
            aria-label={text('放大獎金表', 'Enlarge prize schedule')}
            onClick={() => setInspection({ kind: 'payout' })}
          />
        </section>
        <div className="race-board-infield-action">{children}</div>
        <div
          className="rb-cards-rail"
          aria-label={text('棋盤卡槽與玩家下注', 'Card slots and player bets')}
        >
          {horses.map((horse) => {
            const bets = view.bets.filter((bet) => bet.horseId === horse.id);
            const flipped = used(horse) || (horse.rank !== null && movingHorseId !== horse.id);
            const legal = canSelect(horse.id);
            const betDescription = bets
              .map(
                (bet) =>
                  `${player(bet.seatId)?.name}: ${bet.value === null ? text('暗注', 'Hidden') : bet.value}`,
              )
              .join(', ');
            return (
              <div
                key={horse.id}
                className={`rb-card-bay ${legal ? 'available' : ''} ${isLast(horse.id) ? 'last-place' : ''}`}
                data-last-place={isLast(horse.id) ? 'true' : undefined}
                style={{ '--horse': HORSE_COLORS[horse.id] } as CSSProperties}
                data-horse-slot={horse.id}
              >
                {view.pace === horse.id && (
                  <span
                    className="rb-card-award"
                    aria-label={text(
                      `領頭獎金每票 ${unitBonus} 元，派彩時領取`,
                      `Checkpoint award: ${unitBonus} per betting unit at settlement`,
                    )}
                  >
                    ◆ +${unitBonus}
                  </span>
                )}
                {isLast(horse.id) && (
                  <span className="rb-card-loss">
                    {text('墊底', 'LAST')} −{unitPenalty}
                  </span>
                )}
                <div className="rb-card-shell">
                  <button
                    type="button"
                    className={`rb-horse-card ${flipped ? 'flipped' : ''}`}
                    data-horse-card={horse.id}
                    aria-label={`${horse.id + 1} ${horse.names[language]} · ${flipped ? text('已行動', 'Already moved') : legal && view.rolled ? text(`前進 ${horse.moves[view.rolled]} 格`, `Move ${horse.moves[view.rolled]} spaces`) : text('查看卡牌', 'View card')}`}
                    onClick={() => choose(horse)}
                  >
                    <CardFront
                      horse={horse}
                      symbol={!interactionLocked && !flipped ? view.rolled : null}
                      language={language}
                    />
                    <span className="rb-card-face rb-card-back">
                      <span className="rb-card-back-art" />
                    </span>
                  </button>
                  <span className="rb-cradle-label">
                    <b>{String(horse.id + 1).padStart(2, '0')}</b>
                    {horse.names[language]}
                  </span>
                  <button
                    type="button"
                    className="rb-card-inspect"
                    aria-label={text(
                      `放大${horse.names[language]}卡牌`,
                      `Enlarge ${horse.names[language]} card`,
                    )}
                    onClick={() => setInspection({ kind: 'card', horseId: horse.id })}
                  >
                    ⌕
                  </button>
                </div>
                <button
                  type="button"
                  className={`rb-bet-well ${legal && view.phase === 'betting' ? 'available' : ''}`}
                  aria-label={`${horse.names[language]} · ${text('下注區', 'Bets')} · ${betDescription || text('尚無下注', 'No bets')}`}
                  onClick={() =>
                    legal && view.phase === 'betting'
                      ? onHorseSelect(horse.id)
                      : setInspection({ kind: 'bets', horseId: horse.id })
                  }
                >
                  <span className={`rb-well-chips ${bets.length > 3 ? 'dense' : ''}`}>
                    {bets.map((bet) => chip(bet, bet.seatId))}
                  </span>
                  {!bets.length && legal && view.phase === 'betting' && (
                    <span className="rb-place-bet">+</span>
                  )}
                </button>
                {flipped && (
                  <span className="rb-used-label">
                    {horse.rank !== null
                      ? text(`第${horse.rank}名`, `#${horse.rank}`)
                      : text('已行動', 'USED')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {inspection && (
        <BoardDialog
          title={
            inspection.kind === 'payout'
              ? text('每票獎金', 'Prize schedule')
              : `${String(inspectedHorse!.id + 1).padStart(2, '0')} · ${inspectedHorse!.names[language]}`
          }
          onClose={() => setInspection(null)}
        >
          {inspection.kind === 'payout' ? (
            <>
              <p>
                {text(
                  '依完賽名次及這匹馬上的非零下注人數查表。1、2 號籌碼各算一人，0 號不計；每票獎金再乘以你的籌碼數值。',
                  'Look up the finishing place and number of players with positive bets on this horse. A 1 or 2 chip counts once; a 0 chip does not count. Multiply the prize per unit by your chip value.',
                )}
              </p>
              {payoutTable(true)}
              <p className="rb-payout-checkpoint">
                {text(
                  `首匹到達或通過第 18 格的馬，下注者每票加領 $${unitBonus}，於賽後派彩時支付${view.rules?.paceRequiresPodium ? '（此版本須進入前三名）' : '，無須進入前三名'}。`,
                  `The first horse reaching or passing 18 earns $${unitBonus} per betting unit, paid at race settlement${view.rules?.paceRequiresPodium ? ' if it finishes in the top three' : ' regardless of final place'}.`,
                )}
              </p>
              <p className="rb-payout-last">
                {text(
                  `第三匹馬完賽時立即結束比賽；押注當時最落後的馬，每票扣 $${unitPenalty}。0 票不扣款，2 票扣雙倍；餘額不足時只付現有金額。`,
                  `The race stops at the third finisher. Bets on the horse furthest behind lose $${unitPenalty} per unit. A 0-chip loses nothing; a 2-chip loses twice as much. Payment is capped at available money.`,
                )}
              </p>

              <p className="rb-payout-formula">
                {text('每票獎金 × 你的籌碼數值', 'Prize per unit × your chip value')}
              </p>
              <p>
                {text(
                  '0 號籌碼不增加下注人數，也不獲獎金。5 人以上使用 5+ 欄。第 3 場獎金加倍。',
                  'A 0 chip does not increase the bettor count and earns no prize. Use 5+ for five or more positive bettors. Race 3 pays double.',
                )}
              </p>
            </>
          ) : inspection.kind === 'card' ? (
            <>
              <div
                className="rb-large-card"
                style={{ '--horse': HORSE_COLORS[inspectedHorse!.id] } as CSSProperties}
              >
                <CardFront horse={inspectedHorse!} symbol={view.rolled} language={language} />
              </div>
              <dl className="rb-accessible-stats">
                {SYMBOLS.map((symbol) => (
                  <div key={symbol}>
                    <dt>
                      <GameSymbol symbol={symbol} />
                      {symbolNames[symbol][language]}
                    </dt>
                    <dd>{inspectedHorse!.moves[symbol]}</dd>
                  </div>
                ))}
              </dl>
              <p>
                {text('位置', 'Position')} {inspectedHorse!.position} ·{' '}
                {used(inspectedHorse!)
                  ? text('本輪已行動', 'Already moved this cycle')
                  : text('本輪尚未行動', 'Available this cycle')}
              </p>
              {canSelect(inspectedHorse!.id) && (
                <button
                  type="button"
                  className="rb-dialog-action"
                  onClick={() => {
                    onHorseSelect(inspectedHorse!.id);
                    setInspection(null);
                  }}
                >
                  {view.phase === 'betting'
                    ? text('下注這匹馬', 'Bet on this horse')
                    : text('選擇這匹馬前進', 'Move this horse')}
                </button>
              )}
              <nav className="rb-inspect-nav" aria-label={text('查看其他賽馬', 'Inspect horses')}>
                {horses.map((horse) => (
                  <button
                    type="button"
                    key={horse.id}
                    onClick={() => setInspection({ kind: 'card', horseId: horse.id })}
                    aria-pressed={horse.id === inspectedHorse!.id}
                    style={{ '--horse': HORSE_COLORS[horse.id] } as CSSProperties}
                  >
                    {horse.id + 1}
                  </button>
                ))}
              </nav>
            </>
          ) : (
            <>
              <div className="rb-bet-rows">
                {view.seats.map((seat, index) => {
                  const bet = view.bets.find(
                    (item) => item.seatId === seat.id && item.horseId === inspectedHorse!.id,
                  );
                  return (
                    <div key={seat.id} className="rb-bet-row">
                      <span className="rb-bettor-avatar" style={{ background: seatColor(index) }}>
                        {seat.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        {seat.name}
                        {seat.id === view.selfId && <small>{text('你的下注', 'Your bet')}</small>}
                      </span>
                      <span className="rb-bet-caption">
                        {bet
                          ? bet.value === null
                            ? text('數值未公開', 'Hidden value')
                            : text(`${bet.value} 票`, `${bet.value} units`)
                          : text('未下注', 'No bet')}
                      </span>
                      {bet ? chip(bet) : '—'}
                    </div>
                  );
                })}
              </div>
              <p>
                {view.settings.hidden
                  ? text(
                      '暗注：只會顯示自己的籌碼數值，結算時全桌揭注。',
                      'Hidden bets: only your chip values are visible until the race is settled.',
                    )
                  : text(
                      '公開下注：所有玩家可看到已放置的籌碼。',
                      'Open betting: all players can see the placed chips.',
                    )}
              </p>
              {canSelect(inspectedHorse!.id) && view.phase === 'betting' && (
                <button
                  type="button"
                  className="rb-dialog-action"
                  onClick={() => {
                    onHorseSelect(inspectedHorse!.id);
                    setInspection(null);
                  }}
                >
                  {text('將選中籌碼押在這匹馬', 'Place selected chip on this horse')}
                </button>
              )}
            </>
          )}
        </BoardDialog>
      )}
    </section>
  );
}
