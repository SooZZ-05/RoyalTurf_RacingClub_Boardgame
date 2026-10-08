import { DEFAULT_BOARD_THEME, type BoardTheme, type Names } from './shared/types';

export interface BoardThemeDesign {
  id: BoardTheme;
  name: Names;
  description: Names;
  scene: string;
  frame: string;
  field: string;
  track: string;
  trackLine: string;
  metal: string;
  label: string;
  card: string;
  cardInk: string;
  die: string;
  dieInk: string;
  bodyRoughness: number;
  bodyMetalness: number;
  faceted: boolean;
}

export const BOARD_THEMES: readonly BoardThemeDesign[] = [
  {
    id: 'royal-club',
    name: { en: 'Royal Club', 'zh-Hant': '皇家俱樂部' },
    description: { en: 'Walnut · Emerald · Brass', 'zh-Hant': '胡桃木 · 翡翠綠 · 黃銅' },
    scene: '#e5e0d3',
    frame: '#62432e',
    field: '#153e30',
    track: '#e3d9bd',
    trackLine: '#b29960',
    metal: '#bba064',
    label: '#253b2e',
    card: '#f7f1e4',
    cardInk: '#203c30',
    die: '#214b38',
    dieInk: '#eed6a0',
    bodyRoughness: 0.27,
    bodyMetalness: 0.12,
    faceted: false,
  },
  {
    id: 'imperial-porcelain',
    name: { en: 'Imperial Porcelain', 'zh-Hant': '御瓷雅苑' },
    description: { en: 'Porcelain · Ink blue · Champagne', 'zh-Hant': '白瓷 · 墨藍 · 香檳金' },
    scene: '#eae9e4',
    frame: '#192f4c',
    field: '#eee9dc',
    track: '#faf7ed',
    trackLine: '#bbab7d',
    metal: '#b9a574',
    label: '#203958',
    card: '#fffcf3',
    cardInk: '#203958',
    die: '#faf5e8',
    dieInk: '#203958',
    bodyRoughness: 0.16,
    bodyMetalness: 0.05,
    faceted: false,
  },
  {
    id: 'nocturne',
    name: { en: 'Nocturne', 'zh-Hant': '夜幕賽會' },
    description: { en: 'Obsidian · Platinum · Oxblood', 'zh-Hant': '黑曜石 · 鉑金 · 酒紅' },
    scene: '#202329',
    frame: '#15171b',
    field: '#292a2e',
    track: '#bebbb2',
    trackLine: '#737579',
    metal: '#c6c7c5',
    label: '#252a31',
    card: '#24282e',
    cardInk: '#efede6',
    die: '#20242a',
    dieInk: '#e7e6e0',
    bodyRoughness: 0.34,
    bodyMetalness: 0.28,
    faceted: true,
  },
];

export function getBoardTheme(id: BoardTheme = DEFAULT_BOARD_THEME): BoardThemeDesign {
  return BOARD_THEMES.find((theme) => theme.id === id) ?? BOARD_THEMES[0];
}

export function themeVariables(theme: BoardThemeDesign): Record<string, string> {
  return {
    '--theme-scene': theme.scene,
    '--theme-frame': theme.frame,
    '--theme-field': theme.field,
    '--theme-track': theme.track,
    '--theme-track-line': theme.trackLine,
    '--theme-metal': theme.metal,
    '--theme-label': theme.label,
    '--theme-card': theme.card,
    '--theme-card-ink': theme.cardInk,
    '--theme-die': theme.die,
    '--theme-die-ink': theme.dieInk,
  };
}
