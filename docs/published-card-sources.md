# Published49-card movement set

Reviewed8October2026. Both numerical decks are implemented in `src/data/edition.json`:21Royal Turf profiles (three per horse-head family) and28historical horses. `sourceBacked:true` means the complete numerical source set is playable. `verified:false` avoids claiming complete Traditional Chinese manual/name certification. No synthetic profiles are included.

## Physical source photographs

- [All21basic cards](https://boardgamegeek.com/image/144351/winners-circle), original public image `qa/rules-research/bgg-144351.jpg`. The older family names are Earl Grey(head1), Albino(2), Sahara Wind(3), Caramello(4), Red Fox(5), Nougat(6), Othello(7). The2017Japanese/Chinese colour/name mapping is assigned by invariant horse-head value. It matches every known Chinese sample and the additional Japanese photographs, including all three Blue Ocean profiles.
- [All28historical cards](https://boardgamegeek.com/image/130336/winners-circle), independently read again from [sheet1](https://boardgamegeek.com/image/130463/winners-circle), [sheet2](https://boardgamegeek.com/image/130464/winners-circle), [sheet3](https://boardgamegeek.com/image/130465/winners-circle), [sheet4](https://boardgamegeek.com/image/130466/winners-circle). All eight photographed Chinese historical profiles match.
- [Cross-edition card comparison](https://boardgamegeek.com/image/3690533/winners-circle) shows Challedon→Secretariat and Count Fleet→Seabiscuit with the same movement values. The implementation preserves these published renames.
- Publisher-provided2016images independently corroborate [basic card samples](https://boardgamegeek.com/image/3159403/winners-circle) and [historical samples](https://boardgamegeek.com/image/3159404/winners-circle).
- Additional Japanese evidence: [Snow White1/8/9/10](https://handmanboardgame.com/wp-content/uploads/2017/05/%E3%83%AD%E3%82%A4%E3%83%A4%E3%83%AB%E3%82%BF%E3%83%BC%E3%83%95-2.jpg), [Red Carpet3/1/5/15and Blue Ocean4/1/13/4](https://cdn-ak.f.st-hatena.com/images/fotolife/l/liberteabi/20170226/20170226123812.jpg), [Blue Ocean4/7/3/8and Yellow Tiger5/6/7/2](https://boardgamegeek.com/image/6351951/winners-circle).

The public image API returned original-resolution links even when the main gallery pages were unavailable. Metadata, originals and exact retrieval URLs are retained in `qa/rules-research/`. Game artwork remains the approved original concept artwork; physical scans are research evidence only and are not published in `dist`.

## Source cross-checks

The basic photograph was read column-by-column and checked against the photographed Chinese/Japanese profiles. The historical collection was read from the full-layout photograph and checked independently against the four larger sheet photographs. Tests preserve those source transcriptions, ensure49unique IDs, three basic profiles per family and28unique historical identities, and check source references. All cards also pass the30weighted-movement sanity check (3×head+cap+carrot+shoe); that arithmetic is supplementary evidence, not a substitute for reading the printed values.

The [Dan Blum Royal Turf translation](https://www.scribd.com/document/862989028/Royal-Turf-Rules-Translations-fits-in-box) has a publicly readable28-profile numeric appendix agreeing with the historical movement sets. Its original33-space track and older Turf Horse Racing40-space/no-penalty rules are **not** transferred into the current game. The selected Chinese reference and board establish the current36-space track, finish boundary and checkpoint18.

## Playable behavior and disclosed limits

Normal Start three races uses the complete selected deck. Seven fresh profiles are drawn per race and removed afterward: basic mode uses all21once; historical mode uses21of28without replacement. A one-race seven-profile practice mode remains available. Existing saved matches retain their card snapshots; rematch or a new table uses the complete decks.

Printed English historical names are shown where their Chinese card labels have not been sourced. Numeric completeness is separate from Chinese translation certification. The selected Chinese guide/user instruction gives checkpoint100per unit regardless of place, paid at settlement; a different English edition conditions this on podium placement. The game deliberately uses the selected Chinese behavior. The crowded-field paragraph does not resolve tied-last penalties in the retrieved material; all tied-rearmost horses are charged under the convention disclosed next to that option.

The last horse is placed on an explicit seventh-place spot after the final movement presentation, alongside its card and settlement loss labels. The production API reports both decks ready while keeping the separate Chinese-certification flag false.
