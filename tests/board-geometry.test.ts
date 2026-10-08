import { describe, expect, it } from 'vitest';
import { BOARD_THEME_IDS } from '../src/shared/types';
import { buildTrack } from '../src/board/geometry';

describe.each(BOARD_THEME_IDS)('%s board geometry', (theme) => {
  it('has one playable clockwise circuit with a checkpoint at 18', () => {
    const track = buildTrack(theme);
    expect(track.cells).toHaveLength(36);
    expect(new Set(track.cells.map((cell) => cell.number)).size).toBe(36);
    for (let i = 1; i <= 36; i++) expect(track.cells.some((cell) => cell.number === i)).toBe(true);
    // Clockwise on the screen: start on the bottom left, climb the left edge,
    // pass 18 across the top, and descend on the right before the final row.
    expect(track.point(4)[0]).toBeLessThan(300);
    expect(track.point(18)[1]).toBeLessThan(220);
    expect(track.point(24)[0]).toBeGreaterThan(1200);
    expect(track.point(30)[1]).toBeGreaterThan(500);
    const circuit = Array.from({ length: 36 }, (_, i) => track.point(i + 1));
    const signedArea = circuit.reduce((sum, point, index) => {
      const next = circuit[(index + 1) % circuit.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0);
    expect(signedArea).toBeGreaterThan(0);
    expect(track.cells.filter((cell) => cell.number === 18)).toHaveLength(1);
  });

  it('shares seven start offsets with spaces 30–36 without extra track cells', () => {
    const track = buildTrack(theme);
    for (let start = -6; start <= 0; start++) {
      expect(track.point(start)).toEqual(track.point(start + 36));
      expect(track.cells.find((cell) => cell.number === start + 36)?.alias).toBe(start);
    }
    expect(track.cells.filter((cell) => cell.alias !== null)).toHaveLength(7);
    expect(track.point(37)).toEqual(track.point(1));
  });

  it('keeps a moving horse continuous when crossing the finish boundary', () => {
    const track = buildTrack(theme);
    const justBefore = track.point(35.9999),
      justAfter = track.point(36.0001);
    expect(Math.hypot(justAfter[0] - justBefore[0], justAfter[1] - justBefore[1])).toBeLessThan(
      0.1,
    );
    const start = track.point(36),
      next = track.point(37),
      half = track.point(36.5);
    expect(half[0]).toBeCloseTo((start[0] + next[0]) / 2, 5);
    expect(half[1]).toBeCloseTo((start[1] + next[1]) / 2, 5);
  });
});
