import { useId } from 'react';
import type { Symbol } from './shared/types';

/** One vector icon vocabulary for both movement cards and the symbol die. */
export function GameSymbol({ symbol }: { symbol: Symbol }) {
  return (
    <svg className="game-symbol" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {symbol === 'head' && (
        <>
          <path
            fill="currentColor"
            d="M6 28c0-7 3-13 8-17l-5 3-5-4 8-6 3-3 2 5 5 2 6 10-3 5-8-3-1 8Z"
          />
          <path
            d="m14 5-4-4 1 7M20 11h.1"
            stroke="var(--symbol-cutout, var(--theme-card))"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      {symbol === 'cap' && (
        <>
          <path
            d="M5 21v-4a11 11 0 0 1 22 0v4ZM5 21l-3 5h17l8-5M16 6v15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M7 19v-2a9 9 0 0 1 7-8v10Z" fill="currentColor" />
        </>
      )}
      {symbol === 'carrot' && (
        <>
          <path d="M12 9C16 6 24 12 22 16L4 29Z" fill="currentColor" />
          <path
            d="m17 8 1-6m2 8 7-6m-5 8 8-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="m11 15 4 3m-7 3 3 2"
            stroke="var(--symbol-cutout, var(--theme-card))"
            strokeWidth="1.4"
          />
        </>
      )}
      {symbol === 'shoe' && (
        <>
          <path
            d="M7 4h5l-1 11c-1 10 11 10 10 0L20 4h5l2 12c2 17-24 17-22 0Z"
            fill="currentColor"
          />
          <path
            d="M9 9h.1M8 16h.1M10 23h.1M16 26h.1M22 23h.1M24 16h.1M23 9h.1"
            stroke="var(--symbol-cutout, var(--theme-card))"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

/** Small code-native equestrian relief, recoloured without changing horse identity. */
export function HorsePortrait({ color }: { color: string }) {
  const gradient = `horse-relief-${useId().replaceAll(':', '')}`;
  return (
    <svg viewBox="0 0 180 88" aria-hidden="true" focusable="false" className="horse-portrait">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset=".38" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity=".7" />
        </linearGradient>
      </defs>
      <ellipse cx="91" cy="77" rx="64" ry="4" fill="currentColor" opacity=".09" />
      <path
        d="M48 42C26 29 22 57 6 57c15 7 27-1 33-8l7-1M43 48c-1 13-14 17-13 25l16 1 1-4-8-2 20-20M83 51l20 12 18 10 6-3-23-17-7-11"
        fill={color}
        stroke="currentColor"
        strokeOpacity=".18"
        strokeWidth="1"
      />
      <path
        d="M38 41c7-12 24-17 42-11l17 4c12-6 12-22 23-26l5-6 3 10 11 3 10 13-3 6-12-2-9-8-9 27-12 3-13-7c-13 9-26 8-35 4L45 69l-1 6H29l1-5 8-1 4-16c-6-4-6-8-4-12Z"
        fill={`url(#${gradient})`}
        stroke="currentColor"
        strokeOpacity=".25"
        strokeWidth="1.2"
      />
      <path
        d="m100 45 12 9 6 12 11 6-2 4-17-7-7-12-14-6M45 34c-8 2-15 9-24 14 13-1 22-5 25-10M119 9c-14 4-10 18-21 22l8 3c9-10 9-17 16-19"
        fill={color}
        stroke="currentColor"
        strokeOpacity=".2"
      />
      <path
        d="m125 15 8 14 10-3M129 20l-15 24"
        fill="none"
        stroke="var(--theme-metal)"
        strokeWidth="1.5"
      />
      <circle cx="132" cy="20" r="1.2" fill="#20252b" />
      <path
        d="M49 40c14 6 29 5 43-1"
        fill="none"
        stroke="#fff"
        strokeOpacity=".45"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function SymbolDie({
  symbol,
  rolling,
  label,
}: {
  symbol: Symbol;
  rolling: boolean;
  label: string;
}) {
  return (
    <div className={`symbol-die ${rolling ? 'rolling' : ''}`} role="img" aria-label={label}>
      <div className="die-top" aria-hidden="true">
        <GameSymbol symbol="head" />
      </div>
      <div className="die-side" aria-hidden="true">
        <GameSymbol symbol="shoe" />
      </div>
      <div className="die-front">
        <GameSymbol symbol={symbol} />
      </div>
    </div>
  );
}
