import type { Bet, Edition, GameState, Ledger, Seat, Settings } from './types';

/** User-selected payouts: each positive chip counts once; bluff chips count zero. */
export function payoutColumnCount(values: readonly number[]): number {
  return values.filter((value) => value > 0).length;
}

/** All payments are per betting unit, including checkpoint awards and last-place losses. */
export function calculateRaceLedger(
  rules: Edition['rules'],
  settings: Settings,
  race: number,
  seats: readonly Seat[],
  bets: readonly Bet[],
  ranks: readonly number[],
  last: readonly number[],
  pace: number | null,
): Ledger[] {
  const multiplier = race === 3 ? 2 : 1;
  return seats.map((seat) => {
    let winnings = 0,
      bonus = 0,
      penalty = 0;
    for (const bet of bets.filter((b) => b.seatId === seat.id)) {
      const horseBets = bets.filter((b) => b.horseId === bet.horseId);
      const count = payoutColumnCount(horseBets.map((b) => b.chip.value));
      const rank = ranks.indexOf(bet.horseId);
      if (rank >= 0 && rank < 3 && bet.chip.value > 0)
        winnings += rules.payout[rank][Math.min(5, count) - 1] * bet.chip.value * multiplier;
      if (bet.horseId === pace && (!rules.paceRequiresPodium || rank >= 0))
        bonus += rules.paceBonus * bet.chip.value * multiplier;
      if (last.includes(bet.horseId)) penalty += rules.lastPenalty * bet.chip.value * multiplier;
    }
    const available = seat.money + (rules.penaltyAfterWinnings ? winnings + bonus : 0);
    const paidPenalty = Math.min(available, penalty);
    return {
      seatId: seat.id,
      winnings,
      bonus,
      penalty,
      paidPenalty,
      balance: seat.money + winnings + bonus - paidPenalty,
    };
  });
}

/** Recalculate saved settlements once when adopting the requested positive-chip rule.
 * Match history and bets stay intact; subsequent races retain their played starting order. */
export function upgradePayoutCounting(state: GameState): boolean {
  if (!state.edition || state.payoutCountingVersion === 1) return false;
  if (state.results.length) {
    const balances = state.seats.map((seat) => ({ ...seat, money: 0 }));
    for (const result of state.results) {
      result.ledger = calculateRaceLedger(
        state.edition.rules,
        state.settings,
        result.race,
        balances,
        result.bets,
        result.ranks,
        result.last,
        result.pace,
      );
      for (const row of result.ledger) {
        const seat = balances.find((s) => s.id === row.seatId);
        if (seat) seat.money = row.balance;
      }
    }
    for (const seat of state.seats) seat.money = balances.find((s) => s.id === seat.id)!.money;
  }
  state.payoutCountingVersion = 1;
  return true;
}
