import { payoutColumnCount } from './settlement';
import { meanMovement, seededRandom, type Random } from './engine';
import type { GameCommand, GameView } from './types';

// Deliberately accepts the same redacted view a human receives, never GameState.
export function chooseBotAction(view: GameView, seed: number, budgetMs = 0): GameCommand | null {
  const candidates = view.legal.filter((c) => ['bet', 'roll', 'move'].includes(c.type));
  if (!candidates.length) return null;
  if (candidates[0].type === 'roll') return candidates[0];
  const random = seededRandom(seed);
  const deadline = performance.now() + budgetMs;
  const totals = candidates.map(() => 0),
    counts = candidates.map(() => 0);
  const initial = candidates.map((c) => heuristic(view, c));
  // Production uses the deterministic heuristic: keeps each Durable Object request
  // within the Free plan's short CPU budget. Optional rollouts are for analysis.
  if (budgetMs <= 0) return candidates[best(initial)];
  for (let n = 0; n < 64; n++) {
    for (let i = 0; i < candidates.length; i++) {
      if (performance.now() >= deadline)
        return candidates[best(totals.map((t, j) => (counts[j] ? t / counts[j] : initial[j])))];
      totals[i] += rollout(view, candidates[i], random);
      counts[i]++;
    }
  }
  return candidates[best(totals.map((t, i) => t / counts[i]))];
}
function best(values: number[]) {
  return values.indexOf(Math.max(...values));
}
function heuristic(view: GameView, command: GameCommand) {
  if (command.type !== 'bet' && command.type !== 'move') return 0;
  const h = view.horses.find((h) => h.id === command.horseId)!;
  const own = view.bets.find((b) => b.seatId === view.selfId && b.horseId === h.id)?.value ?? 0;
  const support = view.bets
    .filter((b) => b.horseId === h.id && b.seatId !== view.selfId)
    .reduce((sum, b) => sum + (b.value ?? 1), 0);
  if (command.type === 'move')
    return (own * 2 - support * 0.3) * h.moves[view.rolled!] + h.position * own * 0.1;
  const chip = view.hand.find((c) => c.id === command.chipId)!;
  const quality = meanMovement(h.moves) / Math.max(1, view.rules!.finishDistance - h.position);
  return (chip.value * quality * 400) / (support + chip.value + 1);
}
function rollout(view: GameView, candidate: GameCommand, random: Random): number {
  const rules = view.rules!;
  const horses = view.horses.map((h) => ({ ...h }));
  const bets = view.bets.map((b) => ({ ...b, value: b.value ?? 0 }));
  // Assign unknown chips without replacement; the observed choice of horses is public.
  for (const seat of view.seats) {
    let chips = view.settings.hidden ? [0, 1, 1, 2] : [1, 1, 2];
    for (const b of view.bets.filter((b) => b.seatId === seat.id && b.value !== null))
      chips.splice(chips.indexOf(b.value!), 1);
    for (const b of view.bets.filter((b) => b.seatId === seat.id && b.value === null)) {
      const value = chips.splice(random(chips.length), 1)[0];
      bets.find((x) => x.seatId === b.seatId && x.horseId === b.horseId)!.value = value;
    }
    if (candidate.type === 'bet' && seat.id === view.selfId) {
      const value = view.hand.find((c) => c.id === candidate.chipId)!.value;
      bets.push({ seatId: seat.id, horseId: candidate.horseId, value });
      chips.splice(chips.indexOf(value), 1);
    }
    for (const value of chips) {
      const available = horses.filter(
        (h) => !bets.some((b) => b.seatId === seat.id && b.horseId === h.id),
      );
      const sorted = available.sort(
        (a, b) =>
          meanMovement(b.moves) / Math.max(1, rules.finishDistance - b.position) -
          meanMovement(a.moves) / Math.max(1, rules.finishDistance - a.position),
      );
      const h = sorted[random(Math.min(3, sorted.length))];
      bets.push({ seatId: seat.id, horseId: h.id, value });
    }
  }
  let pace = view.pace;
  let turn = Math.max(
    0,
    view.seats.findIndex((s) => s.id === view.activeId),
  );
  const ranks = horses
    .filter((h) => h.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .map((h) => h.id);
  const advance = (id: number, symbol: keyof (typeof horses)[number]['moves']) => {
    const h = horses.find((h) => h.id === id)!;
    let to = h.position + h.moves[symbol];
    if (!view.settings.crowded && to < rules.finishDistance) {
      const mod = (p: number) => ((p % rules.trackLength) + rules.trackLength) % rules.trackLength;
      const occupied = new Set(
        horses.filter((x) => x.id !== id && x.rank === null).map((x) => mod(x.position)),
      );
      while (to > h.position && occupied.has(mod(to))) to--;
    }
    h.position = to;
    h.used = true;
    if (pace === null && to >= rules.paceDistance) pace = id;
    if (to >= rules.finishDistance) {
      ranks.push(id);
      h.rank = ranks.length;
    }
    if (horses.filter((x) => x.rank === null).every((x) => x.used))
      for (const x of horses) if (x.rank === null) x.used = false;
    turn = (turn + 1) % view.seats.length;
  };
  if (candidate.type === 'move') advance(candidate.horseId, view.rolled!);
  const faces = ['head', 'head', 'head', 'cap', 'carrot', 'shoe'] as const;
  for (let n = 0; n < 1500 && ranks.length < 3; n++) {
    const symbol = faces[random(6)];
    const available = horses.filter((h) => h.rank === null && !h.used);
    const seatId = view.seats[turn].id;
    const scores = available.map((h) => {
      const own = bets.find((b) => b.seatId === seatId && b.horseId === h.id)?.value ?? 0;
      const rivals = bets
        .filter((b) => b.seatId !== seatId && b.horseId === h.id)
        .reduce((sum, b) => sum + b.value, 0);
      return (
        (own * 2 - rivals * 0.3) * h.moves[symbol] + (own ? h.position * 0.1 : 0) + random(10) * 0.1
      );
    });
    advance(available[best(scores)].id, symbol);
  }
  const unfinished = horses.filter((h) => h.rank === null);
  const lowest = Math.min(...unfinished.map((h) => h.position));
  let last = unfinished.filter((h) => h.position === lowest).map((h) => h.id);
  if (last.length > 1 && rules.lastTie === 'none') last = [];
  let earnings = 0,
    penalty = 0;
  for (const bet of bets.filter((b) => b.seatId === view.selfId)) {
    const rank = ranks.indexOf(bet.horseId);
    const all = bets.filter((b) => b.horseId === bet.horseId);
    const count = payoutColumnCount(all.map((b) => b.value));
    if (rank >= 0 && bet.value) earnings += rules.payout[rank][Math.min(count, 5) - 1] * bet.value;
    if (pace === bet.horseId && (!rules.paceRequiresPodium || rank >= 0))
      earnings += rules.paceBonus * bet.value;
    if (last.includes(bet.horseId)) penalty += rules.lastPenalty * bet.value;
  }
  const multiplier = view.race === 3 ? 2 : 1;
  return (
    earnings * multiplier -
    Math.min(
      penalty * multiplier,
      view.seats.find((s) => s.id === view.selfId)!.money +
        (rules.penaltyAfterWinnings ? earnings * multiplier : 0),
    )
  );
}
