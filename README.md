# 皇家賽馬場 · Royal Turf Racing Club

A private, bilingual browser tabletop with three luxury board themes, live multiplayer and server-authoritative rules. It runs on **Cloudflare Pages + a Worker with SQLite Durable Objects** within their Free allowances. No computer needs to remain running after deployment.

## Current status

Both complete published decks—**21basic profiles and28historical horses**—run all three races with friends or bots, betting, random dice, legal horse movement, pace bonuses, settlement, accumulated rankings and reconnects. Hidden betting and crowded-field play can be combined. Payout columns follow the requested rule: count players with a positive chip, excluding 0; multiply the table prize by your chip value. A shorter one-race demo is also available. Create a room with 2–6 seats, including at least one human; solo players can add bots.

The first horse reaching or passing18locks a$100per-unit checkpoint bonus at settlement, regardless of final place. Bets on the horse furthest behind when third place finishes lose$100per unit, capped at available money. Race three doubles both amounts. Players freely choose their remaining chips; the UI does not preselect a forced order. Known1.0saves have their checkpoint payments and accumulated balances corrected once on load. See the [rules audit](docs/gameplay-rules.md).

**Content scope:** all49movement profiles are transcribed from public physical-card photographs. Every race draws7fresh cards and discards them afterward; basic mode uses21once, historical mode uses21of28without replacement. Unknown Chinese historical labels use the printed English name. Numerical completeness is distinct from complete Chinese-manual certification; the crowded-field tie convention is disclosed. No invented profiles are shipped. Existing seven-profile saves retain their snapshots; start a new table or rematch for the complete decks. [Card sources and review](docs/published-card-sources.md).

See [implemented rules and source decisions](docs/gameplay-rules.md) for clockwise movement, finish-line handling, checkpoint18, blocking, card reset, betting privacy, doubled third-race payments and the declared crowded-field tie convention. The rules research and the missing component-data problem are documented separately.

## Board themes

Choose **Royal Club** (walnut, emerald and brass), **Imperial Porcelain** (ivory, ink blue and champagne), or **Nocturne** (obsidian, platinum and oxblood) before creating a table. The host can change the shared theme in the lobby or during any game phase; every player receives the same choice. It survives reconnection and rematches, and existing rooms default to Royal Club.

The gameplay dashboard uses the approved rendered board artwork, card presentation and independently moving horse figures. Seven horse cards and individual players' bet chips sit in the board's recesses. The player/ranking strip stays above the board; theme selection, table-wide pause and exit are in the menu.

The track is numbered clockwise, including the overlapping−6…0/30…36 start cells and checkpoint18. Every player sees the same resolved die, its enlarged reveal, the selected horse's movement, and the used card flipping after arrival. Theme changes preserve gameplay and animation state; reduced-motion preferences are respected. These are interactive 3D-style visuals, not downloadable 3D model files.

## Run locally

Use Node 22.12+ and npm 10.5+. Install dependencies with `npm ci`, then run in two terminals:

```sh
npm run dev:api
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api` and WebSockets to Wrangler on port 8789. Local Durable Object data is saved under `.wrangler/state`. Guest seat credentials are stored in the browser; clearing browser storage loses that device’s seat.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The browser tests start an isolated **synthetic test server** on port 8788. They do not replace production edition data. `npm run check:edition` validates all49published profiles and their rule-evidence references. It distinguishes source-backed playable data from full Chinese-manual certification.

## Free Cloudflare deployment

Follow the [complete Cloudflare deployment guide](docs/cloudflare-deployment.md). It covers account setup, both projects, exact commands, cross-origin configuration, multiplayer checks, updates and troubleshooting.

1. Use a Workers **Free** account and sign in with `npx wrangler login`.
2. Create the Pages project with `npx wrangler pages project create royal-turf-tabletop --production-branch main`.
3. Add the exact production Pages origin to `ALLOWED_ORIGINS` in `wrangler.jsonc`.
4. Run `npm run deploy:api` and copy its HTTPS Worker URL.
5. Set `VITE_API_BASE` to that URL in `.env.local`, without a trailing slash.
6. Run `npm run deploy:web`, then share the production Pages link.

Deployment scripts check configuration and asset limits before uploading. Use the guide if the Pages project name is already taken. No D1, R2, paid domain or external server is needed. WebSocket hibernation keeps idle rooms asleep; animation frames run in players' browsers.

Free hosting has quotas: Workers allow100,000requests/day; SQLite Durable Objects have separate compute, row and storage allowances. Keep the account on Free and monitor usage; exceeding an allowance can interrupt play. Current official limits and references are listed in the guide. Neither project has been deployed by this repository setup.

## Rooms, privacy and recovery

- Seats freeze at start; use 2–6 seats with at least one human. Solo play adds at least one bot.
- An invite shares only the room code. The server returns a private bearer token for each seat; WebSockets use a short-lived, one-use connection ticket.
- The host gets the same hidden-information projection as other players. Bot input is also a redacted player view. Opponent chip values and chip IDs are never broadcast before settlement.
- Commands carry a UUID and expected revision. State, command acknowledgement, private random trace and public replay frame commit in one SQL transaction before any acknowledgement is sent.
- A rolled symbol and shared presentation timestamps are saved in the `move` phase. Actions stay locked during the roll/reveal and movement; host pause shifts the remaining timeline on resume. A reconnect gets the latest projected snapshot and can safely retry its original command ID.
- No human turn clock. After a 60-second absence, the host may delegate a seat to a bot. Returning players reclaim their seats between committed actions. Host controls transfer to a connected human when the host leaves.
- Idle/abandoned rooms expire seven days after their latest saved change. Bots pause when no human is connected. There is no perpetual polling or bot loop.
- Completed meetings expose a public frame replay and downloadable results. Unfinished games cannot export internal state or hidden bets. Credentials and private random traces are never exported.

## Exact-edition completion

See [docs/edition-verification.md](docs/edition-verification.md). Use the partial 49-card template to transcribe the actual components and cite every profile and rule. Run `npm run check:edition -- path/to/completed.json`, then replace `src/data/edition.json` with the reviewed data and rebuild/redeploy both projects. Schema completeness alone does **not** certify source accuracy.

The luxury artwork is generated concept art with live numbered-track, card, bet and horse overlays. The game's rules and source photographs are credited in the research documents and interface. The photographed-card series is a clearly scoped adaptation, not a claim of complete Chinese-edition component verification.
