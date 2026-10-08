# Exact Chinese edition verification

**All49movement profiles are sourced and playable.** See [published-card-sources.md](published-card-sources.md). Complete Traditional Chinese manual/name certification remains separate. `sourceBacked:true` enables the reviewed published numerical decks; `verified:false` preserves this distinction. The optional seven-profile practice mode remains available.

## Source record

| Source                                                                                                                      | Establishes                                                                                                                      | Does not establish                                     |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [Supplied Pixnet article](https://punchboardgame.pixnet.net/blog/posts/9573680628)                                          | Turn sequence; starts0…−6; blocking; checkpoint bonus without a stated podium condition; last-place losses; three races/doubling | All 49 profiles, finish threshold, several edge rules  |
| [Chinese retailer description](https://www.punchboardgame.com/products/皇家賽馬場-winners-circle-繁體中文版-rk知名作品新版) | Based on SNE 2017; 21 base cards; 1/1/2 bets; used profiles removed; combinable variants                                         | An authoritative complete Chinese rulebook             |
| [Group SNE](https://www.groupsne.co.jp/products/bg/royalturf/index.html)                                                    | Designer, edition identity, components, player count and variant capabilities                                                    | Machine-readable numerical profiles                    |
| [English rulebook transcription](https://www.rulespal.com/winners-circle/rulebook)                                          | English reference table, die distribution, podium-conditioned pace bonus, loss cap                                               | That every value and exception is identical in Chinese |
| [SNE walkthrough](https://anboard-games.com/games/royal-turf/)                                                              | Detailed variant descriptions and supporting SNE rules                                                                           | Resolution of every Chinese-edition edge case          |

The research bibliography is [Reiner Knizia’s official list](https://www.knizia.de/pdfs/List-Games-Website-2501.pdf). Original Royal Turf and later Winner’s Circle editions have different track/rule details. Their data must not be silently mixed.

## Required inputs

- The complete Traditional Chinese rulebook, including all variant pages.
- A clear image of the entire board and payout matrix.
- Fronts of all 21 base and 28 historical cards, with readable names and four icon values.
- A publisher clarification where the manual is silent or contradictory.

The public photographs are now readable. [observed-components.json](observed-components.json) records **seven base profiles, eight historical movement profiles, all 15 payout cells, 36 physical spaces, and pace position 18** with exact source-image URLs. Further public photographs now supply all remaining movement profiles. Untranscribed Chinese historical labels use their printed English identities. The complete Chinese manual remains required for an edition-wide cross-check. The researched finish convention is progress37: cross the line between36/0 and1 after completing the lap. The selected Chinese article awards checkpoint18per unit without a podium restriction; the different English exception is not used by the shipped modes.

Further research on8October2026 found three additional directly readable Japanese2017profiles (Snow White1/8/9/10, Red Carpet3/1/5/15, Blue Ocean4/1/13/4). They are prefilled as explicitly sourced reference observations in the template, bringing it to10base movement profiles. This was followed by complete21/28-card photographs and independent sheet checks; all numerical profiles are now implemented. See [remaining-rule-research.md](remaining-rule-research.md) for photograph URLs and retrieval outcomes. The playable seven-profile pool remains unchanged.

The Chinese board's third-place / 3-unit payout is **150**; the RulesPal transcription rechecked on7October2026 also lists150. Use the photograph as the authority. Synthetic horse profiles in `tests/fixture.ts` remain test inputs only; the fixture's payout grid now references the photographed Chinese board.

## Transcription

Generate a fresh partially filled template with:

```sh
npx tsx scripts/create-edition-template.ts docs/edition-template.json
```

The supplied template has all 49 slots, prefills the photographed facts, and deliberately uses `null` for missing values. For each card, record the exact Chinese name, an English display translation/name, its printed horse/color where applicable, four values (`head`, `cap`, `carrot`, `shoe`) and an evidence reference such as `Chinese manual p. 4; physical card photo base-white-2.jpg`.

Horse IDs follow betting-area order: white 0, black 1, pink 2, blue 3, yellow 4, green 5, orange 6. Confirm this ordering against the Chinese board. Base cards require three profiles per horse. Historical profiles are assigned to betting areas in draw order, so their `horse` field can be null.

The rules object must explicitly resolve:

- `trackLength`: number of physical spaces. `finishDistance`: forward distance from starting position 0 that finishes a horse. These are separate so a finish-line convention cannot produce an off-by-one error.
- `paceDistance`, `paceBonus`, `paceRequiresPodium`, and every payout cell for 1/2/3/4/5+ units.
- `lastPenalty`, `lastTie` (`all` tied-rearmost horses or `none`), `penaltyAfterWinnings`, `laterStarter` (`totalMoney` or `raceWinnings`), and shared victory for final money ties.
- `deckHandling`: the implemented base algorithm shuffles unused profiles, skips duplicate colors for this race without removing those skipped profiles, then removes the selected seven; historical mode draws seven unused cards. Verify that this matches the manual.
- `occupancy`: the implemented default uses physical spaces modulo track length, ignores finished horses, stops at the original position if blocked, and removes a horse as soon as it reaches the verified finish distance. Verify lapping and finish-line examples. Crowded mode bypasses occupancy checks.

Every listed rule needs a nonempty evidence reference in `rules.evidence`. If the physical rules require a different algorithm or an unrepresented tie policy, update the engine and its tests before completing this gate; do not coerce the source into the existing choices.

## Acceptance

1. Two transcription passes agree on all 49 profiles and the payout grid.
2. Source-backed examples cover finish, pace, collision/lapping, insufficient funds, later starters and crowded-field ties.
3. Fill reviewer, review date and source references; mark `verified: true` only after actual review.
4. Validate the completed JSON; place it in `src/data/edition.json`.
5. Re-run engine tests, add the exact edition’s numerical/source examples, run browser playtests and deploy matching Worker/frontend builds.

The existing automated tests establish software behavior with synthetic profiles. They cannot establish fidelity to unprovided physical components.
