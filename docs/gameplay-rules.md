# Gameplay audit: selected Traditional Chinese reference

Reviewed 8 October 2026. The default complete-deck game follows the [Chinese introduction supplied by the user](https://punchboardgame.pixnet.net/blog/posts/9573680628). Its checkpoint award has no podium condition in that introduction. The [English Winner's Circle transcription](https://www.rulespal.com/winners-circle/rulebook) explicitly imposes a top-three condition; that edition's exception must not override the chosen Chinese reference. The playable rule configuration is version1.2. All49movement profiles are now sourced; see [published-card-sources.md](published-card-sources.md).

## Implemented rules

User-requested payout change (8 October 2026): choose the payout column by the number of players with a positive chip (1 or 2), excluding all 0 chips. Multiply the table amount by the owner’s chip value. This is a custom payout rule, differing from the published standard and alternative payouts. Existing saved race settlements are recalculated once; played race history is preserved.

| Rule                    | Server behavior and verification                                                                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seats and meeting       | 2–6players; three races; most accumulated money wins. Equal final balances share victory.                                                                                                                                                                  |
| Setup                   | Random card draw order gives starting progress0,−1,…,−6. Fixed colour card slots are independent of starting order.                                                                                                                                        |
| Track                   | 36physical spaces clockwise. Starts−6…0 share spaces30…36. Crossing the finish boundary36/0→1 after a lap finishes at progress37.                                                                                                                          |
| Basic betting           | Each player has1,1,2. Take turns placing one chip on a horse; one chip per player per horse. **Choose any remaining chip in any order**; selection is explicit and is never automatically preselected. Placement itself costs no money.                    |
| Hidden betting          | Four chips0,1,1,2on four horses; only the owner sees values until settlement. A0chip is a bluff with no award or loss.                                                                                                                                     |
| Dice and choice         | Horse head has three of six faces; cap, carrot and shoe have one each. The active player can choose any unfinished face-up horse, including one they did not bet on.                                                                                       |
| Movement                | Move by the card's matching value. Passing is allowed; a blocked destination falls back to the first free space, stopping at the original position if fully blocked. Occupancy is by physical cell.                                                        |
| Card cycle              | A chosen horse's card flips even if it moved zero. After all unfinished horses have been selected, reset their cards. Finished horses leave play.                                                                                                          |
| Checkpoint18            | The first horse actually reaching or passing18 permanently takes the pace marker. Its bettors receive **$100per betting unit at race settlement, regardless of final place**. A2chip receives$200. Reaching18 does not immediately change player balances. |
| Race end and last horse | Stop immediately when the third horse finishes. The furthest-behind unfinished horse is last; its bettors lose **$100per unit**, so a2chip loses$200. Do not continue racing to find a seventh finisher.                                                   |
| Prize table             | Count positive chips on each podium horse, select the1/2/3/4/5+column, then multiply that per-unit prize by the owner's chip. The photographed Chinese table's third-place/3unit cell is150.                                                               |
| Settlement order        | Pay podium prizes and checkpoint bonuses, then deduct last-place losses. A player pays no more than their available money; balances cannot go negative. The ledger records the full assessed loss and actual capped payment separately.                    |
| Race three              | Double prizes, checkpoint bonuses **and losses**: checkpoint+$200per unit, last−$200per unit.                                                                                                                                                              |
| Later starter           | The wealthiest player starts races two and three; choose randomly among tied leaders.                                                                                                                                                                      |
| Crowded field           | Start together at0and allow shared spaces. **Unverified edge case:** the retrieved rules do not resolve tied last horses; the interface explicitly discloses the digital convention of charging every tied-last horse.                                     |

The Chinese article establishes basic setup, player/chip turns, movement, flipping, checkpoint awards, last-place losses and race-three doubling. The [Group SNE publisher overview](https://www.groupsne.co.jp/products/bg/royalturf/index.html) corroborates the meeting structure, occupancy, card cycles, component counts and variants. The English transcription supplies compatible die, payment-cap and variant details; its incompatible checkpoint condition is excluded. The [SNE walkthrough](https://anboard-games.com/games/royal-turf/) supports the printed finish-line convention, while its different checkpoint condition is also excluded.

## Settlement examples

In race1or2, a2chip on a non-podium checkpoint horse earns$200. A1chip on the last horse loses$100. If the same horse took the checkpoint and ends last, apply both the bonus and loss. In race3these amounts double. A0chip earns and loses nothing, and never affects the payout-table column.

If a player has$0, earns a$100checkpoint bonus and owes a$200last-place loss, the actual deduction is$100and their final balance is$0. The results show the$200assessed loss and explain the balance cap; this avoids hiding a valid last-place penalty behind a displayed zero balance.

## Content and saved-game handling

Normal games use21basic cards or28historical cards, selecting seven fresh profiles per race and removing used cards. All49movement profiles are sourced from physical card photographs and cross-checked against known Japanese/Chinese samples. The optional single-race practice mode uses the original seven photographed profiles. Existing seven-profile match snapshots are preserved. Historical English names are used where Chinese labels remain unsourced; complete Chinese-manual certification remains separate from playable data. See [published-card-sources.md](published-card-sources.md).

Known version1.0seven-profile saves are upgraded once to1.1. Recorded settlements are recomputed in race order with the corrected checkpoint rule, including capped losses and accumulated balances. Played horse moves, starting orders and random events are preserved. Other editions retain their own frozen rules. The Worker persists the repair and a new revision, so reconnection and restart retain the correction.

## Evidence and remaining uncertainty

`tests/chinese-rules.test.ts` covers both shipped modes, free chip order, first/blocked checkpoint crossings, no instant payment, non-podium awards,0/1/2chips, last-place losses, bonus-plus-loss on one horse,5+units, all three race multipliers, the die faces and saved-ledger repair. Existing engine tests cover the full table, blocking, cycles, betting restrictions, variants and later starters. Worker tests prove shared views and persisted correction after restart. Browser tests verify manual2→0→1→1betting, privacy, checkpoint/last-place explanations and actual displayed balances.

Complete Chinese-manual/label certification remains separate from the playable49-profile set. The underspecified crowded-field tied-last convention is disclosed rather than presented as an official exception.

Further source research is recorded in [published-card-sources.md](published-card-sources.md) and [remaining-rule-research.md](remaining-rule-research.md). The certification template now prefills all49published numerical profiles while leaving untranslated Chinese labels, reviewer certification and the underspecified tied-last exception unresolved.
