# Edition evidence research history

Updated8October2026: the subsequent public-gallery research resolved the missing numerical profiles. Both complete published decks are now playable; see [published-card-sources.md](published-card-sources.md). The earlier observations below are retained as research history.

The checkpoint and last-place changes are already implemented and tested. This record tracks the remaining evidence needed to certify the complete physical edition rather than substitute other editions' card data.

## New observations

The retailer identifies the Chinese release as a localization of the2017Group SNE edition: [product description](https://www.punchboardgame.com/products/皇家賽馬場-winners-circle-繁體中文版-rk知名作品新版). Japanese component photographs supplied three additional readable profiles:

| Horse family | Head | Cap | Carrot | Shoe | Photograph                                                                                                                                   |
| ------------ | ---- | --- | ------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Snow White   | 1    | 8   | 9      | 10   | [Single card](https://handmanboardgame.com/wp-content/uploads/2017/05/%E3%83%AD%E3%82%A4%E3%83%A4%E3%83%AB%E3%82%BF%E3%83%BC%E3%83%95-2.jpg) |
| Red Carpet   | 3    | 1   | 5      | 15   | [Four-card detail](https://cdn-ak.f.st-hatena.com/images/fotolife/l/liberteabi/20170226/20170226123812.jpg)                                  |
| Blue Ocean   | 4    | 1   | 13     | 4    | [Four-card detail](https://cdn-ak.f.st-hatena.com/images/fotolife/l/liberteabi/20170226/20170226123812.jpg)                                  |

The same four-card photograph also shows Snow White1/15/8/4and Black Story2/5/11/8, matching the Chinese photographs already used in the game. The additional profiles are recorded as **Japanese-edition reference evidence** in `observed-components.json` and the incomplete transcription template; they are not silently inserted into the existing seven-profile game or labeled complete Chinese verification.

The award organizer's [original Royal Turf description](https://www.spiel-des-jahres.de/en/games/royal-turf/) separately describes a100sprint prize for bettors, consistent with the selected Chinese introduction. It does not supply the later Japanese/Chinese full deck or resolve crowded-field ties. Original Alea horse names/colours differ, so their cards cannot be transplanted merely because the title matches.

## Retrieval results

- [Japanese2017unboxing](https://liberteabi.hatenablog.jp/entry/2017/02/26/143000): directly downloaded and inspected readable card detail; remaining components photo shows closed manual and card backs, not the full deck.
- [Japanese component walkthrough](https://handmanboardgame.com/ボードゲーム紹介/ロイヤルターフ/): single-card Snow White detail is readable. Whole-board photographs are640×480and their small card values are insufficient for reliable transcription; no guessed values were accepted.
- [Three-race Japanese play report](https://ameblo.jp/syuku-32/entry-12290098482.html): HTML is accessible, but the11embedded card/board images returnHTTP403at both exact published URLs and original URLs. These unseen images were not used as numerical evidence.
- BoardGameGeek file directory was inaccessible to the web tool. Its unseen files were not treated as evidence.
- RulesPal and UltraBoardGames reproduce the crowded-field paragraph (shared spaces and a common start) but provide no tied-last clarification. English2016rules impose a podium condition on the checkpoint bonus; the selected Chinese introduction does not. The game retains the user-requested Chinese-reference behavior.

Downloaded files, exact URLs and HTTP outcomes are recorded under `qa/rules-research/`. No publisher or author was contacted and no purchase was made.

## Remaining certification distinction

All49movement profiles are now sourced and implemented. What remains separate is complete Chinese-manual/label certification and the crowded-field tied-last exception, which the retrieved rules leave unspecified. The game displays original English historical names where needed and explicitly discloses its all-tied-last penalty convention. No additional uploads are required to play either complete published deck.
