import { payoutColumnCount } from './shared/settlement';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CardFront, RaceBoard, seatColor } from './RaceBoard';
import { GameSymbol } from './GameArt';
import { BOARD_THEMES } from './themes';
import { strings } from './i18n';
import type { useRoom } from './useRoom';
import {
  HORSE_COLORS,
  type GameCommand,
  type GameView,
  type HorseView,
  type Language,
  type Symbol,
} from './shared/types';
import './play-dashboard.css';

type Props = {
  room: ReturnType<typeof useRoom>;
  language: Language;
  onLanguage: () => void;
  onRules: () => void;
  onDetails: () => void;
  onReplay: () => void;
  lobbySettings: ReactNode;
};
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} className="play-dialog" onCancel={onClose}>
      <div className="play-dialog-heading">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close / 關閉">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

/** All viewers advance from the server clock; pause stops at the same shared instant. */
function usePresentation(view: GameView) {
  const offset = useMemo(() => (view.serverNow ?? Date.now()) - Date.now(), [view.serverNow]);
  const [clock, setClock] = useState(Date.now());
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!view.presentation || view.paused) return;
    let frame: number;
    const tick = () => {
      setClock(Date.now());
      if (Date.now() + offset < view.presentation!.endsAt) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [view.presentation?.id, view.presentation?.endsAt, view.paused, offset]);
  const now = view.paused && view.pausedAt ? view.pausedAt : clock + offset;
  const p = view.presentation;
  const locked = !!p && now < p.endsAt;
  const elapsed = p ? Math.max(0, now - p.startedAt) : 0;
  const positions: Record<number, number> = Object.fromEntries(
    view.horses.map((h) => [h.id, h.position]),
  );
  const used: Record<number, boolean> = Object.fromEntries(view.horses.map((h) => [h.id, h.used]));
  let movingHorseId: number | null = null;
  if (p?.kind === 'move' && locked && p.horseId !== undefined) {
    const duration = Math.max(1, (p.moveEndsAt ?? p.endsAt) - p.startedAt);
    const progress = Math.min(1, elapsed / duration);
    const from = p.from ?? 0;
    const ranked = view.horses.find((h) => h.id === p.horseId)?.rank !== null;
    const to = ranked ? Math.min(p.to ?? from, view.rules?.finishDistance ?? 37) : (p.to ?? from);
    // Easing each physical step keeps a legible forward path around the numbered oval.
    const steps = Math.max(1, Math.abs(to - from));
    const distance = progress * steps;
    const fraction = distance % 1;
    const eased = Math.floor(distance) + fraction * fraction * (3 - 2 * fraction);
    positions[p.horseId] = reduced ? to : from + (to - from) * (eased / steps);
    for (const h of view.horses) used[h.id] = (p.priorUsed ?? []).includes(h.id);
    if (progress >= 1) used[p.horseId] = true;
    else movingHorseId = p.horseId;
  }
  return { p, elapsed, locked, positions, used, movingHorseId, reduced };
}
const faceSymbols: Symbol[] = ['head', 'head', 'cap', 'shoe', 'carrot', 'head'];
const frontAngles: Record<Symbol, [number, number]> = {
  head: [0, 0],
  cap: [0, -90],
  shoe: [0, 90],
  carrot: [-90, 0],
};
function Cube({
  symbol,
  elapsed,
  rolling = false,
  front = false,
  reduced = false,
}: {
  symbol: Symbol;
  elapsed: number;
  rolling?: boolean;
  front?: boolean;
  reduced?: boolean;
}) {
  const [x, y] = frontAngles[symbol];
  const q = Math.min(1, elapsed / 1350);
  const spin = rolling && !reduced ? 720 * (1 - Math.pow(1 - q, 2)) : 0;
  const a = rolling && !reduced ? q : 1;
  return (
    <div className="live-die-stage" role="img" aria-label={strings('en')[symbol]}>
      <div
        className="live-die-cube"
        style={{
          transform: `rotateX(${(front ? x : x - 16) * a + spin}deg) rotateY(${(front ? y : y + 24) * a + spin}deg)`,
        }}
      >
        {faceSymbols.map((face, index) => (
          <div key={index} className={`live-die-face face-${index}`} data-symbol={face}>
            <GameSymbol symbol={face} />
          </div>
        ))}
      </div>
    </div>
  );
}
function DiceReveal({
  symbol,
  elapsed,
  reduced,
  origin,
}: {
  symbol: Symbol;
  elapsed: number;
  reduced: boolean;
  origin: { x: number; y: number; scale: number };
}) {
  const t = Math.max(0, elapsed - 1350);
  const amount = reduced ? 1 : t < 650 ? t / 650 : t < 2250 ? 1 : Math.max(0, (2700 - t) / 450);
  const q = amount * amount * (3 - 2 * amount);
  return (
    <div className="live-dice-reveal" aria-live="polite" role="status" data-symbol={symbol}>
      <div className="live-reveal-scrim" style={{ opacity: q }} />
      <div className="live-reveal-body">
        <div
          className="live-reveal-flight"
          style={{
            transform: `translate(${origin.x * (1 - q)}px, ${origin.y * (1 - q)}px) scale(${origin.scale + (1 - origin.scale) * q})`,
          }}
        >
          <Cube symbol={symbol} elapsed={elapsed} front reduced={reduced} />
        </div>
        <div className="live-reveal-copy" style={{ opacity: q }}>
          <small>全桌擲骰結果 · DICE RESULT</small>
          <h2>{strings('zh-Hant')[symbol]}</h2>
          <p>{strings('en')[symbol]}</p>
          <span>選擇一匹尚未行動的馬 · Choose an available horse</span>
        </div>
      </div>
    </div>
  );
}
function ResultHorseCard({
  horse,
  view,
  language,
}: {
  horse: HorseView;
  view: GameView;
  language: Language;
}) {
  return (
    <div className="race-board result-card-theme" data-board-theme={view.boardTheme}>
      <div
        className="rb-large-card result-horse-card"
        data-result-card={horse.id}
        role="img"
        aria-label={`${horse.id + 1} · ${horse.names[language]}`}
        style={{ '--horse': HORSE_COLORS[horse.id] } as CSSProperties}
      >
        <CardFront horse={horse} symbol={null} language={language} />
      </div>
    </div>
  );
}
function RaceResults({ view, language }: { view: GameView; language: Language }) {
  const t = strings(language),
    result = view.results.at(-1);
  if (!result) return null;
  const en = language === 'en';
  const multiplier = result.race === 3 ? 2 : 1;
  const horseName = (id: number) => {
    const horse = view.horses.find((h) => h.id === id);
    return `${id + 1} · ${horse?.names[language] ?? id}`;
  };
  const winners = view.seats.filter((s) => s.money === Math.max(...view.seats.map((s) => s.money)));
  return (
    <div className="live-results">
      {view.phase === 'gameResults' && (
        <h3>
          {winners.map((s) => s.name).join(' & ')} ·{' '}
          {winners.length > 1 ? t.jointWinners : t.winner}
        </h3>
      )}
      <div className="live-podium play-podium">
        {result.ranks.map((id, i) => (
          <div key={id}>
            <b>{i + 1}</b>
            <span className="result-horse-identity">
              <i style={{ background: HORSE_COLORS[id] }} />
              {horseName(id)}
            </span>
            {view.horses.find((h) => h.id === id) && (
              <ResultHorseCard
                horse={view.horses.find((h) => h.id === id)!}
                view={view}
                language={language}
              />
            )}
          </div>
        ))}
      </div>
      <div className="live-settlement-details">
        <p data-settlement="pace">
          <b>{t.pace}:</b>{' '}
          {result.pace === null
            ? language === 'en'
              ? 'No checkpoint horse'
              : '沒有領頭馬'
            : view.horses.find((h) => h.id === result.pace)?.names[language]}
          {result.pace !== null && (
            <span>
              {language === 'en'
                ? ` · +$${(view.rules?.paceBonus ?? 100) * (result.race === 3 ? 2 : 1)} per betting unit${view.rules?.paceRequiresPodium ? ' when in the top three' : ', regardless of final place'}`
                : ` · 每票 +$${(view.rules?.paceBonus ?? 100) * (result.race === 3 ? 2 : 1)}${view.rules?.paceRequiresPodium ? '（須進入前三名）' : '，不受最終名次影響'}`}
            </span>
          )}
        </p>
        <p data-settlement="last">
          <b>{t.last}:</b>{' '}
          {result.last
            .map((id) => view.horses.find((h) => h.id === id)?.names[language])
            .join(' / ')}
          <span>
            {language === 'en'
              ? ` · −$${(view.rules?.lastPenalty ?? 100) * (result.race === 3 ? 2 : 1)} per betting unit`
              : ` · 每票 −$${(view.rules?.lastPenalty ?? 100) * (result.race === 3 ? 2 : 1)}`}
          </span>
        </p>
      </div>
      <div className="result-special-horses">
        {[
          ...(result.pace === null ? [] : [{ id: result.pace, label: t.pace }]),
          ...result.last.map((id) => ({ id, label: t.last })),
        ].map(({ id, label }) => {
          const horse = view.horses.find((h) => h.id === id);
          return (
            horse && (
              <div key={`${label}-${id}`}>
                <b>
                  {label} · {horseName(id)}
                </b>
                <ResultHorseCard horse={horse} view={view} language={language} />
              </div>
            )
          );
        })}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.name}</th>
              <th>{t.winnings}</th>
              <th>{t.bonus}</th>
              <th>{t.penalty}</th>
              <th>{en ? 'Balance' : '累計餘額'}</th>
            </tr>
          </thead>
          <tbody>
            {result.ledger.map((row) => (
              <tr key={row.seatId}>
                <td>{view.seats.find((s) => s.id === row.seatId)?.name}</td>
                <td>+{row.winnings}</td>
                <td>+{row.bonus}</td>
                <td>
                  −{row.paidPenalty}
                  {row.penalty > row.paidPenalty && (
                    <small className="live-capped-loss">
                      {language === 'en'
                        ? `$${row.penalty} assessed; payment capped by balance`
                        : `應扣 $${row.penalty}；餘額不足，實扣 $${row.paidPenalty}`}
                    </small>
                  )}
                </td>
                <td>
                  <b>{row.balance.toLocaleString()}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="result-calculations">
        <h3>{en ? 'Every player’s calculation' : '每位玩家的獎金明細'}</h3>
        {result.ledger.map((row) => {
          const opening = row.balance - row.winnings - row.bonus + row.paidPenalty;
          const net = row.winnings + row.bonus - row.paidPenalty;
          return (
            <section key={row.seatId} data-calculation-seat={row.seatId}>
              <h4>{view.seats.find((seat) => seat.id === row.seatId)?.name}</h4>
              <p>
                {en ? 'Opening balance' : '賽前餘額'}: ${opening.toLocaleString()}
                {multiplier === 2 && (
                  <strong>
                    {' '}
                    · {en ? 'Race 3: all prizes and penalties × 2' : '第三場：全部獎金及罰金 × 2'}
                  </strong>
                )}
              </p>
              <ul>
                {result.bets
                  .filter((bet) => bet.seatId === row.seatId)
                  .map((bet) => {
                    const horseBets = result.bets.filter((b) => b.horseId === bet.horseId);
                    const count = payoutColumnCount(horseBets.map((b) => b.chip.value));
                    const rank = result.ranks.indexOf(bet.horseId);
                    const unit =
                      rank >= 0 && rank < 3 && count > 0
                        ? (view.rules?.payout[rank][Math.min(5, count) - 1] ?? 0)
                        : 0;
                    const prize = unit * bet.chip.value * multiplier;
                    const bonusUnit = view.rules?.paceBonus ?? 100;
                    const penaltyUnit = view.rules?.lastPenalty ?? 100;
                    const bonusEligible =
                      bet.horseId === result.pace && (!view.rules?.paceRequiresPodium || rank >= 0);
                    const last = result.last.includes(bet.horseId);
                    return (
                      <li key={bet.chip.id} data-bet-calculation={bet.horseId}>
                        <b>
                          <i style={{ background: HORSE_COLORS[bet.horseId] }} />
                          {horseName(bet.horseId)}
                        </b>
                        <span>
                          {en
                            ? `Your bet: ${bet.chip.value} · Shared payout column: ${count} positive chips (0 excluded)`
                            : `你的下注：${bet.chip.value} · 共享獎金欄：${count} 枚有效籌碼（不含 0）`}
                        </span>
                        <span>
                          {en ? 'Place prize' : '名次獎金'}
                          {rank >= 0 ? ` (${rank + 1})` : ''}:{' '}
                          {rank >= 0
                            ? `$${unit} × ${bet.chip.value} × ${multiplier} = +$${prize}`
                            : en
                              ? '$0 · outside the top three'
                              : '$0 · 未進入前三名'}
                        </span>
                        <span>
                          {en ? 'Checkpoint bonus' : '領頭獎金'}:{' '}
                          {bonusEligible
                            ? `$${bonusUnit} × ${bet.chip.value} × ${multiplier} = +$${bonusUnit * bet.chip.value * multiplier}`
                            : '+$0'}
                        </span>
                        <span>
                          {en ? 'Last-place penalty' : '墊底罰金'}:{' '}
                          {last
                            ? `$${penaltyUnit} × ${bet.chip.value} × ${multiplier} = −$${penaltyUnit * bet.chip.value * multiplier}`
                            : '−$0'}
                        </span>
                      </li>
                    );
                  })}
              </ul>
              <p>
                {en ? 'Race earnings' : '本場淨收益'}: ${row.winnings} + ${row.bonus} − $
                {row.paidPenalty} = {net < 0 ? '−' : '+'}${Math.abs(net).toLocaleString()}
              </p>
              <p>
                {en ? 'Penalty paid' : '實付罰金'}: min(${row.penalty}, $
                {opening + (view.rules?.penaltyAfterWinnings ? row.winnings + row.bonus : 0)}) = $
                {row.paidPenalty}
              </p>
              <p className="result-balance">
                <b>
                  {en ? 'Closing balance' : '賽後累計餘額'}: ${opening.toLocaleString()} + $
                  {row.winnings} + ${row.bonus} − ${row.paidPenalty} = $
                  {row.balance.toLocaleString()}
                </b>
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
export function PlayDashboard({
  room,
  language,
  onLanguage,
  onRules,
  onDetails,
  onReplay,
  lobbySettings,
}: Props) {
  const view = room.view!,
    t = strings(language),
    en = language === 'en';
  const [menu, setMenu] = useState(false),
    [lobby, setLobby] = useState(view.phase === 'lobby');
  const [exit, setExit] = useState(false),
    [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [copied, setCopied] = useState(false),
    [dismissedResult, setDismissedResult] = useState('');
  const [origin, setOrigin] = useState({ x: 0, y: 0, scale: 0.25 });
  const dieRef = useRef<HTMLDivElement>(null);
  const animation = usePresentation(view);
  const isHost = view.selfId === view.hostId;
  const displayActiveId =
    animation.locked && animation.p?.kind === 'move' ? animation.p.actorId : view.activeId;
  useEffect(() => {
    if (animation.p?.kind === 'roll') setMenu(false);
  }, [animation.p?.id]);
  const live = room.connection === 'live' && !room.pending;
  const can = (type: GameCommand['type']) => live && view.legal.some((c) => c.type === type);
  const command = (c: GameCommand) => room.command(c);
  useEffect(() => {
    if (view.phase !== 'lobby') setLobby(false);
  }, [view.phase]);
  useEffect(() => {
    // Each wager begins with the player's own choice, not the first chip in the hand.
    if (view.activeId !== view.selfId || !view.hand.some((c) => c.id === selectedChip))
      setSelectedChip(null);
  }, [view.hand, selectedChip, view.activeId, view.selfId]);
  useEffect(() => {
    if (animation.p?.kind !== 'roll') return;
    const rect = dieRef.current?.getBoundingClientRect();
    if (rect)
      setOrigin({
        x: rect.x + rect.width / 2 - innerWidth / 2,
        y: rect.y + rect.height / 2 - (innerHeight / 2 - 85),
        scale: rect.width / Math.min(180, innerWidth * 0.36),
      });
  }, [animation.p?.id]);
  const copyInvite = async () => {
    try {
      const invitation = new URL(location.href);
      invitation.searchParams.set('room', view.code);
      await navigator.clipboard.writeText(invitation.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      room.setError('NETWORK');
    }
  };
  const selectHorse = (horseId: number) => {
    if (!live || view.paused || animation.locked) return;
    const action = view.legal.find(
      (c) =>
        (c.type === 'move' && c.horseId === horseId) ||
        (c.type === 'bet' && c.horseId === horseId && c.chipId === selectedChip),
    );
    if (action) command(action);
  };
  const rolling = animation.locked && animation.p?.kind === 'roll' && animation.elapsed < 1350;
  const revealing = animation.locked && animation.p?.kind === 'roll' && animation.elapsed >= 1350;
  const moving = animation.locked && animation.p?.kind === 'move';
  const symbol = animation.p?.symbol ?? view.rolled ?? view.lastMove?.symbol ?? 'head';
  const activeName = view.seats.find((s) => s.id === displayActiveId)?.name ?? '';
  const phaseTitle = view.paused
    ? en
      ? 'Table paused'
      : '棋桌已暫停'
    : rolling
      ? en
        ? 'Rolling…'
        : '擲骰中…'
      : revealing
        ? en
          ? 'The result'
          : '擲骰結果'
        : moving
          ? en
            ? 'On the move'
            : '賽馬前進中'
          : view.phase === 'lobby'
            ? t.waiting
            : view.phase === 'betting'
              ? t.betting
              : view.phase === 'roll'
                ? t.roll
                : view.phase === 'move'
                  ? t.move
                  : t.results;
  const resultKey = `${view.race}:${view.phase}`;
  const resultsReady = ['raceResults', 'gameResults'].includes(view.phase) && !animation.locked;
  return (
    <main
      className={`play-dashboard ${view.paused ? 'is-paused' : ''}`}
      data-phase={view.phase}
      data-presentation={rolling ? 'rolling' : revealing ? 'revealing' : moving ? 'moving' : 'idle'}
    >
      <header className="play-topbar">
        <a
          className="play-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setExit(true);
          }}
        >
          <span>♞</span>
          <div>
            {t.title}
            <small>ROYAL TURF · RACING CLUB</small>
          </div>
        </a>
        <div
          className="play-scoreboard"
          aria-label={en ? 'Rankings and current turn' : '排名與當前回合'}
        >
          {view.seats.map((seat, i) => {
            const rank = 1 + view.seats.filter((s) => s.money > seat.money).length;
            const active = displayActiveId === seat.id;
            return (
              <div
                key={seat.id}
                className={`play-player seat ${active ? 'active' : ''}`}
                aria-current={active ? 'step' : undefined}
                style={{ '--player-color': seatColor(i) } as CSSProperties}
              >
                <span className="play-rank">{String(rank).padStart(2, '0')}</span>
                <span className="play-avatar">{seat.name[0]}</span>
                <div className="play-player-name">
                  <b>
                    {seat.name}
                    {seat.id === view.selfId && <em> {t.you}</em>}
                  </b>
                  <small>
                    {active
                      ? en
                        ? seat.id === view.selfId
                          ? 'YOUR TURN'
                          : 'CURRENT TURN'
                        : '當前回合'
                      : seat.bot
                        ? t.bot
                        : seat.id === view.hostId
                          ? t.host
                          : seat.connected
                            ? t.online
                            : t.offline}
                  </small>
                </div>
                <strong>{seat.money.toLocaleString()}</strong>
              </div>
            );
          })}
        </div>
        <button
          className="play-menu-button"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-label={en ? 'Game menu' : '遊戲選單'}
        >
          ☰ <span>{en ? 'Menu' : '選單'}</span>
        </button>
      </header>
      <div className="play-meta">
        <span>
          <span className="room-code">{view.code}</span>
          <span className={`connection ${room.connection === 'live' ? 'live' : ''}`}>
            <i />
            {room.connection === 'live' ? t.connected : t.reconnecting}
          </span>
        </span>
        <span>
          {view.phase === 'lobby'
            ? t.preview
            : `${en ? 'RACE' : '第'} ${view.race} / ${view.edition.raceCount ?? 3}${view.race === 3 ? ' · ×2' : ''}`}{' '}
          · {BOARD_THEMES.find((x) => x.id === view.boardTheme)?.name[language]}
        </span>
        <button onClick={copyInvite}>{copied ? t.copied : t.invite} ↗</button>
      </div>
      <div className="play-board-wrap">
        <RaceBoard
          view={view}
          language={language}
          selectedChip={selectedChip}
          onHorseSelect={selectHorse}
          interactionLocked={!live || view.paused || animation.locked}
          displayPositions={animation.positions}
          displayUsed={animation.used}
          movingHorseId={animation.movingHorseId}
        >
          <section className="play-turn turn-panel" aria-label={phaseTitle}>
            <small className="play-turn-eyebrow">
              {view.phase === 'lobby'
                ? 'THE PRIVATE RACING CLUB'
                : view.activeId === view.selfId
                  ? en
                    ? 'YOUR TURN'
                    : '輪到你了'
                  : activeName}
            </small>
            <h1>{phaseTitle}</h1>
            <p>
              {view.phase === 'lobby'
                ? en
                  ? 'Invite your friends. The next race is yours.'
                  : '邀請好友入座，準備好就開賽。'
                : view.phase === 'betting'
                  ? view.activeId === view.selfId
                    ? t.selectChip
                    : `${activeName} · ${t.betting}`
                  : moving
                    ? `${view.horses.find((h) => h.id === animation.p?.horseId)?.names[language] ?? ''} · +${(animation.p?.to ?? 0) - (animation.p?.from ?? 0)}`
                    : view.phase === 'move'
                      ? t.chooseHorse
                      : en
                        ? 'One roll. Seven possibilities.'
                        : '一次擲骰，七種可能。'}
            </p>
            {view.phase === 'lobby' ? (
              <button className="play-primary" onClick={() => setLobby(true)}>
                {en ? 'Prepare the race' : '準備賽事'} →
              </button>
            ) : view.phase === 'betting' ? (
              <div className="play-chips chips" role="group" aria-label={t.selectChip}>
                {view.hand.map((chip) => (
                  <button
                    key={chip.id}
                    data-chip-id={chip.id}
                    data-chip-value={chip.value}
                    aria-pressed={selectedChip === chip.id}
                    onClick={() => setSelectedChip(chip.id)}
                    disabled={view.activeId !== view.selfId || !live || view.paused}
                  >
                    {chip.value}
                  </button>
                ))}
                {!view.hand.length && <span>{en ? 'Bets placed' : '已完成下注'}</span>}
              </div>
            ) : resultsReady ? (
              <button className="play-primary" onClick={() => setDismissedResult('')}>
                {t.results} →
              </button>
            ) : (
              <div className="play-die-action">
                <div ref={dieRef} className={`play-source-die ${revealing ? 'is-hidden' : ''}`}>
                  <Cube
                    symbol={symbol}
                    elapsed={animation.elapsed}
                    rolling={rolling}
                    reduced={animation.reduced}
                  />
                </div>
                <div>
                  {view.phase === 'roll' && !moving ? (
                    <button
                      className="play-primary"
                      disabled={!can('roll') || animation.locked}
                      onClick={() => command({ type: 'roll' })}
                    >
                      {t.roll} ↗
                    </button>
                  ) : (
                    <b className="play-result-label">{t[symbol]}</b>
                  )}
                  <small>
                    {view.lastMove && !rolling
                      ? `${t.lastMove} · ${view.horses.find((h) => h.id === view.lastMove?.horseId)?.names[language] ?? ''}`
                      : en
                        ? 'Shared with every player'
                        : '全桌共用骰子結果'}
                  </small>
                </div>
              </div>
            )}
          </section>
        </RaceBoard>
      </div>
      <div className="play-bottom">
        <span>
          {view.pace === null
            ? '18 · CHECKPOINT'
            : `18 · ${t.pace} · ${view.horses.find((h) => h.id === view.pace)?.names[language]} · +$${(view.rules?.paceBonus ?? 100) * (view.race === 3 ? 2 : 1)} ${en ? 'per unit at settlement' : '／票，派彩時領取'}`}
        </span>
        <button onClick={onRules}>{t.rules} ↗</button>
      </div>
      {revealing && (
        <DiceReveal
          symbol={symbol}
          elapsed={animation.elapsed}
          reduced={animation.reduced}
          origin={origin}
        />
      )}
      {menu && (
        <Dialog title={en ? 'At your table' : '棋桌選單'} onClose={() => setMenu(false)}>
          {view.phase !== 'lobby' && (
            <button
              className="play-menu-row"
              disabled={!can('pause')}
              onClick={() => {
                command({ type: 'pause', paused: !view.paused });
                setMenu(false);
              }}
            >
              {view.paused ? '▶' : 'Ⅱ'}{' '}
              {view.paused ? (en ? 'Resume game' : '繼續遊戲') : en ? 'Pause game' : '暫停遊戲'}
              <small>{en ? 'Host · for every player' : '桌主控制 · 全桌同步'}</small>
            </button>
          )}
          <div className="play-theme-heading">
            {t.boardTheme}
            <small>{isHost ? t.themeShared : t.themeHostOnly}</small>
          </div>
          <div className="play-theme-options theme-picker">
            {BOARD_THEMES.map((theme, i) => (
              <button
                key={theme.id}
                data-theme-option={theme.id}
                aria-pressed={theme.id === view.boardTheme}
                disabled={!isHost || !live}
                onClick={() => command({ type: 'boardTheme', boardTheme: theme.id })}
              >
                <span className={`play-theme-thumb theme-${i}`} />
                <span>
                  <b>{theme.name[language]}</b>
                  <small>{theme.description[language]}</small>
                </span>
                <em>{theme.id === view.boardTheme ? '✓' : ''}</em>
              </button>
            ))}
          </div>
          <button className="play-menu-row" onClick={onLanguage}>
            {en ? '繁體中文' : 'English'} <small>{en ? 'Change language' : '切換語言'}</small>
          </button>
          {view.phase === 'lobby' && (
            <button
              className="play-menu-row"
              onClick={() => {
                setMenu(false);
                setLobby(true);
              }}
            >
              {t.settings} →
            </button>
          )}
          {view.legal
            .filter((c) => c.type === 'replace')
            .map((c) => (
              <button key={c.seatId} className="play-menu-row" onClick={() => command(c)}>
                {view.seats.find((s) => s.id === c.seatId)?.name} · {t.replace}
              </button>
            ))}
          <button
            className="play-menu-row play-exit"
            onClick={() => {
              setMenu(false);
              setExit(true);
            }}
          >
            ↗ {en ? 'Exit game' : '離開遊戲'}
          </button>
        </Dialog>
      )}
      {lobby && view.phase === 'lobby' && (
        <Dialog title={t.waiting} onClose={() => setLobby(false)}>
          <p>{t.lobbyHint}</p>
          <div className="play-lobby-seats">
            {view.seats.map((s) => (
              <div key={s.id}>
                <b>{s.name}</b>
                <span>{s.bot ? t.bot : s.id === view.hostId ? t.host : t.online}</span>
                {s.bot && isHost && (
                  <button
                    aria-label={`${t.remove} ${s.name}`}
                    disabled={!can('removeBot')}
                    onClick={() => command({ type: 'removeBot', seatId: s.id })}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {can('addBot') && (
            <button className="button secondary" onClick={() => command({ type: 'addBot' })}>
              ＋ {t.addBot}
            </button>
          )}
          {lobbySettings}
          <p className="play-edition-scope">
            {view.edition.ready
              ? en
                ? '21 basic profiles or 28 historical horses · three races. Each race draws seven fresh cards; used profiles are removed. Historical names use their printed English names where Chinese labels are unavailable.'
                : '21 張基本卡或 28 張歷史名馬卡 · 三場賽事。每場抽七張新卡，已用卡不再使用。尚未核對的歷史名馬中文名稱以原版英文名顯示。'
              : en
                ? 'Seven photographed profiles · practice series. These profiles are reused each race.'
                : '七張已拍照核對卡牌 · 練習賽事，每場重用這七張卡。'}{' '}
            <button onClick={onDetails}>{en ? 'Card sources' : '資料來源'} ↗</button>
          </p>
          {isHost ? (
            <div className="play-lobby-actions">
              <button
                className="play-primary"
                disabled={!can(view.edition.ready ? 'start' : 'startSeries')}
                onClick={() => command({ type: view.edition.ready ? 'start' : 'startSeries' })}
              >
                {en ? 'Start three races' : '開始三場賽事'} →
              </button>
              <button
                className="text-button"
                disabled={!can('startDemo')}
                onClick={() => command({ type: 'startDemo' })}
              >
                {en ? 'One practice race' : '先玩一場'}
              </button>
            </div>
          ) : (
            <p>{en ? 'Waiting for the host to start.' : '等待桌主開賽。'}</p>
          )}
        </Dialog>
      )}
      {view.paused && !menu && !exit && (
        <div className="play-pause" role="status">
          <span>Ⅱ</span>
          <h2>{en ? 'The table is paused' : '棋桌已暫停'}</h2>
          <p>{en ? 'Horses and dice will resume together.' : '賽馬與骰子會從暫停的位置繼續。'}</p>
          {isHost && (
            <button
              className="play-primary"
              disabled={!can('pause')}
              onClick={() => command({ type: 'pause', paused: false })}
            >
              {en ? 'Resume game' : '繼續遊戲'} →
            </button>
          )}
          <button onClick={() => setMenu(true)}>{en ? 'Menu' : '選單'}</button>
        </div>
      )}
      {resultsReady && dismissedResult !== resultKey && !menu && !view.paused && (
        <Dialog
          title={view.phase === 'gameResults' ? t.gameResults : `${t.raceResults} · ${view.race}`}
          onClose={() => setDismissedResult(resultKey)}
        >
          <RaceResults view={view} language={language} />
          <div className="play-lobby-actions">
            {isHost && (
              <button
                className="play-primary"
                disabled={!can(view.phase === 'gameResults' ? 'rematch' : 'nextRace')}
                onClick={() => {
                  command({ type: view.phase === 'gameResults' ? 'rematch' : 'nextRace' });
                  if (view.phase === 'gameResults') setLobby(true);
                }}
              >
                {view.phase === 'gameResults' ? t.rematch : t.nextRace} →
              </button>
            )}
            {view.phase === 'gameResults' && (
              <>
                <button className="text-button" onClick={room.exportResults}>
                  {t.export}
                </button>
                <button className="text-button" onClick={onReplay}>
                  {t.replay}
                </button>
              </>
            )}
          </div>
        </Dialog>
      )}
      {exit && (
        <Dialog title={en ? 'Leave the table?' : '離開這張棋桌？'} onClose={() => setExit(false)}>
          <p>
            {en
              ? 'Your seat is saved on this browser. Reopen the invitation to return. The host can let a computer take over after you have been away for a minute.'
              : '此瀏覽器會保留你的座位，再開邀請連結即可返回。離線一分鐘後，桌主可讓電腦接手。'}
          </p>
          <div className="play-lobby-actions">
            <button className="text-button" onClick={() => setExit(false)}>
              {t.back}
            </button>
            <button className="play-primary" onClick={room.leave}>
              {en ? 'Leave table' : '離開棋桌'} ↗
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
