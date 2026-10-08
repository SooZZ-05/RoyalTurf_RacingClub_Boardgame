# Deploy Royal Turf on Cloudflare for $0 within the Free limits

The game runs entirely on Cloudflare after deployment. Players open an HTTPS link; your PC, Vite, Wrangler dev server, and the Codex preview can all be turned off. You only need a computer again when you want to publish an update.

This setup uses **one Pages project** for the website and **one Worker** with a **SQLite Durable Object per room** for game state and live connections. A paid domain, D1, R2, a VPS, and a paid Workers plan are not required. Cloudflare currently supports SQLite Durable Objects on Workers Free. Limits were checked on **7 October 2026**. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

```text
Players' browsers
  ├─ HTTPS → royal-turf-tabletop.pages.dev       website + board artwork
  └─ HTTPS/WSS → royal-turf-api.…workers.dev    API + authoritative rooms
                                                   └─ SQLite Durable Objects
```

## 1. Prepare the project and a Free account

Create a [Cloudflare account](https://dash.cloudflare.com/sign-up), then use its **Workers Free** plan. This guide does not require an upgrade or a domain purchase.

In a terminal, open this project's `horse` folder. Use Node.js **22.12 or newer** and npm, then run:

```sh
npm ci
npm test
npx wrangler login
npx wrangler whoami
```

The login opens a browser for you to authorize Wrangler. If you belong to several Cloudflare accounts, select the account where both projects should live. Keep Cloudflare API tokens out of frontend files and source control.

Choose a Pages project name. The following commands use `royal-turf-tabletop`. If it is unavailable, use another unique name and replace it in the commands, `deploy:web` in `package.json`, and the Pages URL below.

## 2. Create the Pages project

```sh
npx wrangler pages project create royal-turf-tabletop --production-branch main
```

If you already created that project, skip this command. Note its production origin, normally `https://royal-turf-tabletop.pages.dev`; use the exact address Cloudflare assigns. The website will be uploaded in step 5.

This is a **Direct Upload** project. It does not need a Git repository. Cloudflare does not let a Direct Upload project switch to native Git integration later; you can still upload future builds from a CI job, or create a new Git-integrated Pages project. [Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## 3. Configure and deploy the Worker

Open `wrangler.jsonc`. Set `vars.ALLOWED_ORIGINS` to your exact Pages origin, without a trailing slash. You can keep the local origins too:

```json
"vars": {
  "ALLOWED_ORIGINS": "https://royal-turf-tabletop.pages.dev,http://localhost:5173,http://127.0.0.1:5173"
}
```

Leave these existing settings intact:

```json
"durable_objects": {
  "bindings": [{ "name": "ROOMS", "class_name": "GameRoom" }]
},
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["GameRoom"] }]
```

`new_sqlite_classes` creates the storage backend supported by the Free plan. Do not change it to `new_classes`. The migration runs when the Worker is first deployed; retaining it on later deploys does not reset rooms. [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)

Run:

```sh
npm run deploy:api
```

On your first Worker deployment, Wrangler may ask you to choose a free `workers.dev` subdomain. Copy the resulting URL, such as:

```text
https://royal-turf-api.your-actual-subdomain.workers.dev
```

Open that URL with `/api/health` appended. It should return JSON with `"ok": true`. The Worker root `/` is an API endpoint, so a `NOT_FOUND` response there is normal.

The Worker does not need Pages Functions, a separate database setup command, or a Durable Object binding configured on Pages.

## 4. Point the website at the Worker

Copy `.env.example` to `.env.local`. Set the exact Worker origin you just received:

```dotenv
VITE_API_BASE=https://royal-turf-api.your-actual-subdomain.workers.dev
```

Replace the example subdomain with your real one. Do **not** add `/api`, a trailing slash, quotes with angle-bracket placeholders, or a Pages URL.

`VITE_API_BASE` is public configuration embedded into the frontend **when it is built**. `.env.local` is ignored by Git. Do not put credentials in any `VITE_` variable. With this Direct Upload workflow, changing an environment variable in the Pages dashboard does not change an already uploaded build; edit `.env.local`, rebuild, and upload again.

For local Vite development after deployment, temporarily set `VITE_API_BASE=` to an empty value so Vite uses its local `/api` proxy. Set it back to the Worker URL before publishing another production build.

## 5. Build and publish the website

```sh
npm run deploy:web
```

The command checks the API URL and allowed origins, builds the app, verifies the Pages file limits, and uploads `dist`. It explicitly deploys to production branch `main`, so running it from a feature branch still updates your main Pages address.

If you chose a different project name, update the `--project-name` value in `package.json` before running this command.

Only the production `dist` folder is uploaded. The source, screenshots, research material, tests, and old design previews do not need to be uploaded. Each Pages asset must be at most 25 MiB, with at most 20,000 files on the Free plan. [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)

## 6. Check multiplayer on the real site

Open your production **Pages** link, such as `https://royal-turf-tabletop.pages.dev`:

1. Create a room and copy its invitation link.
2. Open that link on a second device or a private browser window. A second tab in the same browser may reuse your existing seat.
3. Join with a different player name. Confirm both players appear and whose-turn indicators agree.
4. Place bets, roll, and choose a horse. Confirm the result and movement appear in both browsers.
5. Change theme and pause/resume as the host. Refresh the second browser and confirm it returns to its saved seat and current state.
6. Close the local development servers and verify the Pages site still works. This confirms no PC is hosting the game.

Share the Pages invitation link, **not** a `localhost` link or the Worker address. Use the stable production Pages origin; unique deployment/preview URLs are separate origins and are rejected unless you explicitly add them to `ALLOWED_ORIGINS` and redeploy the Worker.

## Free limits and how this project fits

| Resource               | Current Free allowance                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| Pages static requests  | Free and unlimited static asset requests                                      |
| Pages build service    | 500 builds per month; one concurrent build                                    |
| Pages files            | 20,000 per deployment; 25 MiB per asset                                       |
| Worker API             | 100,000 requests per day; 10 ms CPU per invocation                            |
| Durable Object compute | 100,000 requests per day; 13,000 GB-seconds per day                           |
| Durable Object SQLite  | 5 million rows read per day; 100,000 rows written per day; 5 GB total storage |

Sources: [Pages static pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Pages platform limits](https://developers.cloudflare.com/pages/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

The account's other projects consume the same account-level allowances where applicable. Daily quotas reset at midnight UTC, which is 08:00 in Malaysia. SQLite limits count rows read/written, including affected indexes and alarm writes; they are not simply a player count. Durable Object incoming WebSocket messages use Cloudflare's 20:1 request billing ratio; HTTP calls and alarms also consume the allowance. Free-tier exhaustion stops affected operations rather than providing unlimited capacity. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

The app uses the WebSocket Hibernation API and automatic ping/pong responses so idle connected rooms can sleep. Dice and horse animation frames run in browsers; the server commits game actions. Bot turns and cleanup use alarms. Idle room state expires after seven days. These choices reduce usage, but they cannot guarantee a specific number of simultaneous players without measuring real traffic. [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

To keep this setup at $0, stay on **Workers Free**, use the supplied `pages.dev`/`workers.dev` domains, and check Workers/Durable Objects usage in the dashboard. No R2 bucket or paid feature needs to be enabled. If the game becomes public and traffic grows beyond the free quotas, some requests will fail until limits reset; a paid upgrade is an optional future choice.

## Updating, recovery, and common problems

For a normal update, keep the same Worker name, Pages project, and Durable Object migration history. Run the checks and publish backend then frontend:

```sh
npm test
npm run deploy:api
npm run deploy:web
```

Plan updates between matches when changing protocol or rules. Saved rooms live in Cloudflare's Durable Objects and survive ordinary redeployment. Changing the Worker/class identity or deleting its namespace is not an update and can disconnect the existing room storage. Local `.wrangler/state` data is separate and never uploads automatically.

| Symptom                                           | What to check                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Website works, creating a room fails              | `VITE_API_BASE` was set before the build. Verify `/api/health` on that Worker.                                                              |
| `ORIGIN_DENIED` or browser CORS failure           | Add the exact origin you opened to `ALLOWED_ORIGINS`; redeploy the Worker. No trailing slash or wildcard.                                   |
| HTTPS website tries `localhost`, HTTP, or `ws://` | Set the HTTPS Worker origin and rebuild/redeploy the website. The client derives secure `wss://` automatically.                             |
| Latest upload appears only at a preview URL       | Use the production branch `main`; the provided `deploy:web` script already does this.                                                       |
| Free plan rejects the Durable Object migration    | Confirm the migration uses `new_sqlite_classes`, not the older key-value backend.                                                           |
| Connection remains “reconnecting”                 | Check the Worker health endpoint, allowed origin, account quotas, and browser network panel. Brief deployment disconnects should reconnect. |
| Seat is missing on a different device             | Seat credentials are browser-local. An invitation joins a new seat; it does not transfer someone's credential.                              |
| Old room cannot be found                          | Rooms expire after seven idle days; create a new one.                                                                                       |
| A Pages upload rejects an artwork file            | Run `npm run check:deploy -- --assets`; each uploaded file must be at most 25 MiB.                                                          |

Inspect Worker logs only when needed with `npx wrangler tail`; do not share player bearer tokens or WebSocket ticket URLs. `ALLOWED_ORIGINS` protects browser origins, but it is not an account login or a public API abuse limit. This game is intended for private invitation rooms.

You can roll the static website back to an earlier production deployment from the Pages dashboard. If an update changed both protocol and frontend, roll back compatible Worker code as well; a code rollback does not undo game actions already saved. Export completed game results from the game before you need a permanent record.

## Optional: builds without your own computer

The Direct Upload setup above already runs the game without your PC. If you also want Cloudflare to **build future frontend updates** for you, choose a Git-integrated Pages project at creation time instead. Set its root to this `horse` directory (only if the repository contains other projects), build command to `npm run build`, output to `dist`, production variable `VITE_API_BASE` to your Worker URL, and Node version to a supported 22.x or newer. Add that project's production origin to the Worker allowlist. [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)

The Worker remains a separate deployment. You may continue using `npm run deploy:api`, or later configure a CI job with Cloudflare credentials stored as CI secrets. Neither deployment method requires an always-on computer.
