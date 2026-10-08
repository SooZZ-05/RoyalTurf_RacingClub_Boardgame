import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Tabletop } from './Tabletop';
import { PlayDashboard } from './PlayDashboard';
import { GameSymbol, HorsePortrait, SymbolDie } from './GameArt';
import { BOARD_THEMES, getBoardTheme, themeVariables } from './themes';
import { api, useRoom } from './useRoom';
import { errorText, strings } from './i18n';
import { EDITION_STATUS } from './shared/edition';
import {
  DEFAULT_SETTINGS,
  DEFAULT_BOARD_THEME,
  HORSE_COLORS,
  SYMBOLS,
  type EditionStatus,
  type GameCommand,
  type GameView,
  type Language,
  type ReplayFrame,
  type Settings,
  type BoardTheme,
} from './shared/types';

const money = (n: number) => n.toLocaleString('en-US');

function ThemePicker({
  value,
  language,
  disabled = false,
  guest = false,
  onChange,
}: {
  value: BoardTheme;
  language: Language;
  disabled?: boolean;
  guest?: boolean;
  onChange: (theme: BoardTheme) => void;
}) {
  const t = strings(language);
  return (
    <section className="theme-picker" aria-label={t.boardTheme}>
      <div className="theme-picker-heading">
        <span className="eyebrow">{t.boardTheme}</span>
        <span>{guest ? t.themeHostOnly : t.themeShared}</span>
      </div>
      <div className="theme-options" role="group" aria-label={t.chooseTheme}>
        {BOARD_THEMES.map((theme, index) => (
          <button
            type="button"
            key={theme.id}
            data-theme-option={theme.id}
            aria-pressed={value === theme.id}
            disabled={disabled || guest}
            onClick={() => value !== theme.id && onChange(theme.id)}
            style={themeVariables(theme) as CSSProperties}
          >
            <span className="theme-miniature" aria-hidden="true">
              <span className="theme-mini-track" />
              <span className="theme-mini-crest">{['A', 'B', 'C'][index]}</span>
            </span>
            <span className="theme-option-copy">
              <strong>{theme.name[language]}</strong>
              <small>{theme.description[language]}</small>
            </span>
            <span className="theme-selected" aria-hidden="true">
              {value === theme.id ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
function Modal({
  children,
  title,
  onClose,
  close,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  close: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} className="modal">
      <div className="modal-heading">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label={close} className="icon-button">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Tutorial({ language, onClose }: { language: Language; onClose: () => void }) {
  const [step, setStep] = useState(0),
    t = strings(language);
  const steps = [
    [t.help1Title, t.help1, '① ① ②'],
    [t.help2Title, t.help2, '♞ → ?'],
    [t.help3Title, t.help3, '♞ · ♞'],
    [t.help4Title, t.help4, '1 · 2 · 3'],
    [t.help5Title, t.help5, '× 2'],
    [t.help6Title, t.help6, '⓪ ? ②'],
  ];
  return (
    <Modal title={t.tutorial} onClose={onClose} close={t.close}>
      <div className="tutorial-visual" aria-hidden="true">
        {steps[step][2]}
      </div>
      <span className="eyebrow">
        {step + 1} / {steps.length}
      </span>
      <h3>{steps[step][0]}</h3>
      <p>{steps[step][1]}</p>
      <div className="step-dots">
        {steps.map((_, i) => (
          <span key={i} className={i === step ? 'active' : ''} />
        ))}
      </div>
      <div className="modal-actions">
        <button
          className="button secondary"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
        >
          {t.previous}
        </button>
        <button
          className="button primary"
          onClick={() => (step === steps.length - 1 ? onClose() : setStep(step + 1))}
        >
          {step === steps.length - 1 ? t.done : t.next} →
        </button>
      </div>
      {!EDITION_STATUS.ready && <small className="muted-text">{t.rulesNote}</small>}
    </Modal>
  );
}
function SettingsPanel({
  settings,
  language,
  disabled,
  onChange,
}: {
  settings: Settings;
  language: Language;
  disabled: boolean;
  onChange: (settings: Settings) => void;
}) {
  const t = strings(language);
  return (
    <div className="settings-panel">
      <label className="field-label">{t.deck}</label>
      <div className="deck-choice">
        {(['base', 'historical'] as const).map((deck) => (
          <button
            key={deck}
            disabled={disabled || (deck === 'historical' && !EDITION_STATUS.ready)}
            aria-pressed={settings.deck === deck}
            onClick={() => onChange({ ...settings, deck })}
            className={settings.deck === deck ? 'selected' : ''}
          >
            <span>{deck === 'base' ? '♞' : '♜'}</span>
            <b>{t[deck]}</b>
            <small>{deck === 'base' ? t.baseHint : t.historicalHint}</small>
          </button>
        ))}
      </div>
      {(['hidden', 'crowded'] as const).map((key) => (
        <label className="setting-toggle" key={key}>
          <div>
            <b>{t[key]}</b>
            <small>{t[`${key}Hint`]}</small>
          </div>
          <input
            type="checkbox"
            checked={settings[key]}
            disabled={disabled}
            onChange={(event) => onChange({ ...settings, [key]: event.target.checked })}
          />
          <span className="switch" aria-hidden="true" />
        </label>
      ))}
    </div>
  );
}
function EditionNotice({
  status,
  language,
  onDetails,
}: {
  status: EditionStatus;
  language: Language;
  onDetails: () => void;
}) {
  const t = strings(language);
  if (status.ready)
    return (
      <div className="edition-ready">
        ✓ {t.verified} · {status.version}
      </div>
    );
  return (
    <div className="edition-notice">
      <span className="notice-icon">i</span>
      <div>
        <strong>{t.pendingTitle}</strong>
        <p>{t.pendingText}</p>
        <button onClick={onDetails}>{t.details} ↗</button>
      </div>
    </div>
  );
}
function HorseCards({
  view,
  language,
  selectedChip,
  onSelect,
}: {
  view: GameView | null;
  language: Language;
  selectedChip: string | null;
  onSelect: (id: number) => void;
}) {
  const t = strings(language);
  return (
    <div className="horse-cards">
      {HORSE_COLORS.map((color, id) => {
        const h = view?.horses.find((h) => h.id === id);
        const legal = view?.legal.some(
          (c) =>
            (c.type === 'move' && c.horseId === id) ||
            (c.type === 'bet' && c.horseId === id && c.chipId === selectedChip),
        );
        return (
          <button
            key={id}
            className={`horse-card ${legal ? 'actionable' : ''} ${h?.used ? 'resting' : ''}`}
            onClick={() => onSelect(id)}
            disabled={!legal}
            style={{ '--horse-color': color } as CSSProperties}
            aria-label={`${id + 1}. ${h?.names[language] ?? (language === 'en' ? 'Horse' : '賽馬')}`}
          >
            <div className="horse-card-heading">
              <span className="horse-disc" style={{ background: color }}>
                {id + 1}
              </span>
              <span>
                {h?.names[language] ?? `${language === 'en' ? 'Horse' : '賽馬'} ${id + 1}`}
              </span>
              <small>{h?.rank ? `#${h.rank}` : h?.used ? t.used : ''}</small>
            </div>
            <div className="horse-card-art">
              <HorsePortrait color={color} />
              <span aria-hidden="true">{String(id + 1).padStart(2, '0')}</span>
            </div>
            <div className="horse-moves">
              {SYMBOLS.map((symbol) => (
                <span key={symbol} title={t[symbol]}>
                  <GameSymbol symbol={symbol} />
                  <b>{h?.moves[symbol] ?? '—'}</b>
                </span>
              ))}
            </div>
            <div className="horse-card-footer">
              <span>
                {h ? (h.rank ? t.finished : `${t.position} ${h.position}`) : t.pendingShort}
              </span>
              <div className="mini-bets">
                {view?.bets
                  .filter((b) => b.horseId === id)
                  .map((b) => (
                    <span
                      key={b.seatId}
                      title={view.seats.find((s) => s.id === b.seatId)?.name}
                      style={{
                        background: HORSE_COLORS[view.seats.findIndex((s) => s.id === b.seatId)],
                      }}
                    >
                      {b.value ?? '?'}
                    </span>
                  ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
function Results({ view, language }: { view: GameView; language: Language }) {
  const t = strings(language),
    result = view.results.at(-1)!;
  const winners = view.seats.filter((s) => s.money === Math.max(...view.seats.map((s) => s.money)));
  return (
    <section className="results-panel">
      <span className="eyebrow">
        {view.phase === 'gameResults' ? t.gameResults : t.raceResults}
      </span>
      {view.phase === 'gameResults' && (
        <h2>
          {winners.map((s) => s.name).join(' & ')}
          <small>{winners.length > 1 ? t.jointWinners : t.winner}</small>
        </h2>
      )}
      <div className="podium-list">
        {result.ranks.map((id, index) => (
          <div key={id}>
            <span className="medal">{index + 1}</span>
            <b>{view.horses.find((h) => h.id === id)?.names[language]}</b>
          </div>
        ))}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.name}</th>
              <th>{t.winnings}</th>
              <th>{t.bonus}</th>
              <th>{t.penalty}</th>
              <th>{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {result.ledger.map((row) => (
              <tr key={row.seatId}>
                <td>{view.seats.find((s) => s.id === row.seatId)?.name}</td>
                <td>+{money(row.winnings)}</td>
                <td>+{money(row.bonus)}</td>
                <td>−{money(row.paidPenalty)}</td>
                <td>
                  <strong>{money(row.balance)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function Replay({
  game,
  frames,
  language,
  onClose,
}: {
  game: GameView;
  frames: ReplayFrame[];
  language: Language;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0),
    t = strings(language),
    frame = frames[index];
  return (
    <Modal title={t.replay} onClose={onClose} close={t.close}>
      <Tabletop
        // Older public frames contain no wager snapshots. Do not paint final-race
        // chips onto earlier races or onto frames before those bets were placed.
        view={frame ? { ...game, ...frame, bets: [], legal: [], activeId: null } : game}
        language={language}
        onSelect={() => {}}
      />
      <label className="field-label" htmlFor="replay-step">
        {t.action} {index + 1} / {frames.length} · {t.round} {frame?.race ?? 3}
      </label>
      <input
        id="replay-step"
        type="range"
        min={0}
        max={Math.max(0, frames.length - 1)}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
      />
      <div className="modal-actions">
        <button
          className="button secondary"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          {t.previous}
        </button>
        <button
          className="button primary"
          disabled={index >= frames.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          {t.next} →
        </button>
      </div>
    </Modal>
  );
}
export function App() {
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem('royal-turf-language') === 'en' ? 'en' : 'zh-Hant',
  );
  const [tab, setTab] = useState<'create' | 'join'>(() =>
    new URLSearchParams(location.search).has('room') ? 'join' : 'create',
  );
  const [name, setName] = useState(() => localStorage.getItem('royal-turf-name') ?? '');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [bots, setBots] = useState(1),
    [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [previewTheme, setPreviewTheme] = useState<BoardTheme>(DEFAULT_BOARD_THEME);
  const [tutorial, setTutorial] = useState(false),
    [details, setDetails] = useState(false),
    [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false),
    [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [edition, setEdition] = useState(EDITION_STATUS);
  const [replay, setReplay] = useState<{ game: GameView; replay: ReplayFrame[] } | null>(null);
  const room = useRoom(),
    t = strings(language),
    view = room.view;
  const currentTheme = getBoardTheme(view?.boardTheme ?? previewTheme);
  useEffect(() => {
    if (view?.presentation?.kind === 'roll') {
      setTutorial(false);
      setDetails(false);
    }
  }, [view?.presentation?.id]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `${t.title} · Racing Club`;
    localStorage.setItem('royal-turf-language', language);
  }, [language, t.title]);
  useEffect(() => {
    api('/edition')
      .then(setEdition)
      .catch(() => {
        /* A table can still be previewed before the local API is started. */
      });
  }, []);
  useEffect(() => {
    if (!view?.hand.some((c) => c.id === selectedChip)) setSelectedChip(view?.hand[0]?.id ?? null);
  }, [view?.hand, selectedChip]);
  const enter = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      localStorage.setItem('royal-turf-name', name.trim());
      await room.enter(
        tab === 'join' ? code.trim().toUpperCase() : null,
        name.trim(),
        bots,
        settings,
        previewTheme,
      );
    } catch (error) {
      room.setError(error instanceof Error ? error.message : 'NETWORK');
    } finally {
      setBusy(false);
    }
  };
  const selectHorse = (horseId: number) => {
    if (room.pending) return;
    const action = view?.legal.find(
      (c) =>
        (c.type === 'move' && c.horseId === horseId) ||
        (c.type === 'bet' && c.horseId === horseId && c.chipId === selectedChip),
    );
    if (action) room.command(action);
  };
  const send = (command: GameCommand) => room.command(command);
  const can = (type: GameCommand['type']) =>
    !!view?.legal.some((c) => c.type === type) && room.connection === 'live' && !room.pending;
  const isHost = view?.selfId === view?.hostId;
  const copyInvite = async () => {
    const url = new URL(location.href);
    url.searchParams.set('room', view!.code);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      room.setError('NETWORK');
    }
  };
  return (
    <div
      className={`app ${view ? 'in-room' : ''}`}
      data-board-theme={currentTheme.id}
      style={themeVariables(currentTheme) as CSSProperties}
    >
      <header className="site-header">
        <a href="/" className="brand" aria-label={t.home}>
          <span className="brand-seal" aria-hidden="true">
            ♞
          </span>
          <div>
            <strong>{t.title}</strong>
            <small>ROYAL TURF · RACING CLUB</small>
          </div>
        </a>
        <nav>
          <button className="text-button" onClick={() => setTutorial(true)}>
            {t.rules} <span>↗</span>
          </button>
          <button
            className="language-button"
            aria-label={t.changeLanguage}
            onClick={() => setLanguage(language === 'en' ? 'zh-Hant' : 'en')}
          >
            {language === 'en' ? '繁中' : 'EN'}
          </button>
        </nav>
      </header>
      {room.error && (
        <div className="error-banner" role="alert">
          {errorText(room.error, language)}
          <button onClick={() => room.setError(null)} aria-label={t.close}>
            ×
          </button>
        </div>
      )}
      {!view ? (
        <main className="clubhouse">
          <section className="hero">
            <span className="eyebrow">
              <span className="diamond">✦</span> {t.eyebrow}
            </span>
            <h1>
              {language === 'en' ? (
                <>
                  The next race
                  <br />
                  is yours.
                </>
              ) : (
                <>
                  好馬不等人，
                  <br />
                  好戲等你入座。
                </>
              )}
            </h1>
            <p>{t.subtitle}</p>
            <div className="hero-tags">
              <span>2—6 {language === 'en' ? 'PLAYERS' : '名玩家'}</span>
              <span>3 {language === 'en' ? 'RACES' : '場比賽'}</span>
              <span>{language === 'en' ? 'ONE TABLE' : '一桌好朋友'}</span>
            </div>
            <button className="learn-link" onClick={() => setTutorial(true)}>
              <span>▷</span> {t.tutorial}
            </button>
          </section>
          <div className="hero-table">
            <Tabletop
              view={null}
              language={language}
              onSelect={() => {}}
              boardTheme={previewTheme}
            />
          </div>
          <section className="entry-panel">
            <div className="panel-tabs">
              <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>
                {t.create}
              </button>
              <button className={tab === 'join' ? 'active' : ''} onClick={() => setTab('join')}>
                {t.join}
              </button>
            </div>
            <form onSubmit={enter}>
              <p>{tab === 'create' ? t.createHint : t.joinHint}</p>
              <label className="field-label" htmlFor="guest-name">
                {t.name}
              </label>
              <input
                id="guest-name"
                name="name"
                autoComplete="nickname"
                maxLength={24}
                required
                placeholder={t.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {tab === 'join' ? (
                <>
                  <label className="field-label" htmlFor="room-code">
                    {t.roomCode}
                  </label>
                  <input
                    id="room-code"
                    name="code"
                    required
                    minLength={8}
                    maxLength={8}
                    pattern="[A-Za-z2-9]{8}"
                    placeholder={t.codePlaceholder}
                    className="code-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </>
              ) : (
                <div className="bot-stepper">
                  <label htmlFor="bot-count">{t.bots}</label>
                  <div>
                    <button
                      type="button"
                      disabled={bots === 0}
                      onClick={() => setBots(bots - 1)}
                      aria-label="−"
                    >
                      −
                    </button>
                    <output id="bot-count">{bots}</output>
                    <button
                      type="button"
                      disabled={bots === 5}
                      onClick={() => setBots(bots + 1)}
                      aria-label="+"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              {tab === 'create' && (
                <ThemePicker
                  value={previewTheme}
                  language={language}
                  disabled={busy}
                  onChange={setPreviewTheme}
                />
              )}
              <button
                className="button primary full"
                disabled={busy || !name.trim() || room.connection === 'connecting'}
              >
                {busy ? t.network : t.enter} <span>→</span>
              </button>
            </form>
            <div className="entry-footnote">
              <span className="status-dot" />
              {edition.ready ? t.verified : t.pendingShort}
              <button onClick={() => setDetails(true)} aria-label={t.details}>
                i
              </button>
            </div>
          </section>
          <div className="home-bottom">
            <span>✦</span>
            <p>{t.footer}</p>
            <span>{t.privateTables}</span>
          </div>
        </main>
      ) : (
        <PlayDashboard
          room={room}
          language={language}
          onLanguage={() => setLanguage(language === 'en' ? 'zh-Hant' : 'en')}
          onRules={() => setTutorial(true)}
          onDetails={() => setDetails(true)}
          onReplay={async () => {
            const data = await room.getReplay();
            if (data) setReplay({ game: view, replay: data.replay });
          }}
          lobbySettings={
            <SettingsPanel
              language={language}
              settings={view.settings}
              disabled={!isHost || room.pending || room.connection !== 'live'}
              onChange={(settings) => send({ type: 'settings', settings })}
            />
          }
        />
      )}
      <footer>
        <span>ROYAL TURF RACING CLUB</span>
        <span>
          Reiner Knizia · {language === 'en' ? 'Private digital adaptation' : '私人數位改編'}
        </span>
      </footer>
      {tutorial && <Tutorial language={language} onClose={() => setTutorial(false)} />}
      {replay && (
        <Replay
          game={replay.game}
          frames={replay.replay}
          language={language}
          onClose={() => setReplay(null)}
        />
      )}
      {details && (
        <Modal title={t.dataGate} onClose={() => setDetails(false)} close={t.close}>
          <EditionNotice status={edition} language={language} onDetails={() => {}} />
          {(edition.ready || edition.missing.length > 0) && (
            <ul className="missing-list">
              {(language === 'en'
                ? edition.ready
                  ? [
                      'All 21 basic movement profiles and all 28 historical profiles are sourced from public physical-card photographs.',
                      'Basic families are mapped by their invariant head values into the Japanese/Chinese colours and names. Known Chinese card values match the source set.',
                      'Untranscribed Chinese historical names use their printed English names. The two published historical renames are preserved.',
                      'Crowded-field tied-last losses use a disclosed digital convention: all tied horses incur losses. Complete Chinese-manual certification remains separate from playable source-backed data.',
                    ]
                  : edition.missing
                : edition.ready
                  ? [
                      '完整 21 張基本卡與 28 張歷史名馬卡的數值均來自公開實體卡牌照片。',
                      '基本馬族以固定馬頭數值對應日文／中文版本的馬色與名稱；已知繁中卡牌數值與來源相符。',
                      '尚未核對的歷史名馬中文名以原版英文名顯示，兩匹已出版更名的馬依新版名稱呈現。',
                      '並駕齊驅採明示數位約定：並列墊底都計算罰金。可遊玩的來源數據與完整繁中規則書認證分別標示。',
                    ]
                  : ['尚未載入完整公開牌組資料，可以使用七張卡練習賽。']
              ).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <a
            href="https://punchboardgame.pixnet.net/blog/posts/9573680628"
            target="_blank"
            rel="noreferrer"
            className="source-link"
          >
            {language === 'en' ? 'Read the original edition introduction' : '閱讀原版遊戲介紹'} ↗
          </a>
        </Modal>
      )}
    </div>
  );
}
