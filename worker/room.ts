import { upgradePayoutCounting } from '../src/shared/settlement';
import { DurableObject } from 'cloudflare:workers';
import {
  applyCommand,
  addHuman,
  GameError,
  newRoom,
  presentationBusy,
  viewForSeat,
} from '../src/shared/engine';
import { chooseBotAction } from '../src/shared/bot';
import { EDITION, EDITION_STATUS } from '../src/shared/edition';
import { upgradeKnownEdition } from '../src/shared/demo';
import { createSchema, envelopeSchema, joinSchema } from '../src/shared/protocol';
import {
  DEFAULT_BOARD_THEME,
  type CommandEnvelope,
  type FullEdition,
  type EditionStatus,
  type GameCommand,
  type GameState,
  type Seat,
} from '../src/shared/types';
import type { Env } from './index';

const TTL = 7 * 24 * 60 * 60 * 1000;
const response = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const token = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
function cryptoRandom(max: number): number {
  const ceiling = Math.floor(0x100000000 / max) * max;
  let n: number;
  do {
    n = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (n >= ceiling);
  return n % max;
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new GameError('INVALID_MESSAGE');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      throw new GameError('MESSAGE_TOO_LARGE');
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new GameError('INVALID_MESSAGE');
  }
}
export class GameRoom extends DurableObject<Env> {
  protected get edition(): FullEdition | null {
    return EDITION;
  }
  protected get status(): EditionStatus {
    return EDITION_STATUS;
  }
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql
      .exec(`CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id=1), state TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS credentials (token TEXT PRIMARY KEY, seat TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tickets (token TEXT PRIMARY KEY, seat TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, seat TEXT NOT NULL, ack TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (revision INTEGER PRIMARY KEY, event TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS replay (revision INTEGER PRIMARY KEY, frame TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (seat TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);`);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    // Even mistyped/unknown room codes get cleaned up rather than keeping empty databases forever.
    ctx.blockConcurrencyWhile(async () => {
      if ((await ctx.storage.getAlarm()) === null) await ctx.storage.setAlarm(Date.now() + TTL);
    });
  }
  private load(): GameState {
    const row = this.ctx.storage.sql
      .exec<{ state: string; expires: number }>('SELECT state, expires FROM room WHERE id=1')
      .toArray()[0];
    if (!row || row.expires <= Date.now()) throw new GameError('ROOM_NOT_FOUND');
    const state = JSON.parse(row.state) as GameState;
    if (state.schema !== 1) throw new GameError('ROOM_VERSION');
    state.boardTheme ??= DEFAULT_BOARD_THEME;
    state.boardThemeChanges ??= 0;
    state.paused ??= false;
    state.pausedAt ??= null;
    state.presentation ??= null;
    const editionUpdated = upgradeKnownEdition(state);
    if (upgradePayoutCounting(state) || editionUpdated) {
      state.revision++;
      this.save(state);
    }
    return state;
  }
  private save(state: GameState) {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO room VALUES (1, ?, ?)',
      JSON.stringify(state),
      Date.now() + TTL,
    );
  }
  private seatFromRequest(request: Request): string {
    const bearer = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
    const seat = this.ctx.storage.sql
      .exec<{ seat: string }>('SELECT seat FROM credentials WHERE token=?', bearer)
      .toArray()[0]?.seat;
    if (!seat) throw new GameError('UNAUTHORIZED');
    return seat;
  }
  private send(ws: WebSocket, body: unknown) {
    try {
      ws.send(JSON.stringify(body));
    } catch {
      /* Closed sockets are handled by webSocketClose. */
    }
  }
  private broadcast(state: GameState) {
    for (const ws of this.ctx.getWebSockets()) {
      const seat = ws.deserializeAttachment()?.seat as string | undefined;
      if (seat && state.seats.some((s) => s.id === seat))
        this.send(ws, { type: 'state', view: viewForSeat(state, seat, this.status) });
    }
  }
  private async schedule(state: GameState) {
    const now = Date.now();
    let next = now + TTL;
    const active = state.seats[state.turn];
    if (!state.paused && presentationBusy(state, now)) next = state.presentation!.endsAt;
    if (
      !state.paused &&
      ['betting', 'roll', 'move'].includes(state.phase) &&
      active?.bot &&
      state.seats.some((s) => !s.bot && s.connected)
    )
      next = Math.max(
        now + 450,
        presentationBusy(state, now) ? state.presentation!.endsAt + 100 : now,
      );
    for (const s of state.seats)
      if (
        !s.bot &&
        !s.connected &&
        s.disconnectedAt !== null &&
        Date.now() - s.disconnectedAt < 60000
      )
        next = Math.min(next, s.disconnectedAt + 60000);
    await this.ctx.storage.setAlarm(next);
  }
  private rateLimit(seat: string) {
    const now = Date.now();
    const row = this.ctx.storage.sql
      .exec<{ window: number; count: number }>(
        'SELECT window, count FROM limits WHERE seat=?',
        seat,
      )
      .toArray()[0];
    if (row && now - row.window < 10000 && row.count >= 30) throw new GameError('RATE_LIMIT');
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO limits VALUES (?, ?, ?)',
      seat,
      row && now - row.window < 10000 ? row.window : now,
      row && now - row.window < 10000 ? row.count + 1 : 1,
    );
  }
  private execute(seat: string, input: CommandEnvelope) {
    return this.ctx.storage.transactionSync(() => {
      const previous = this.load();
      const duplicate = this.ctx.storage.sql
        .exec<{ seat: string; ack: string }>(
          'SELECT seat, ack FROM commands WHERE id=?',
          input.commandId,
        )
        .toArray()[0];
      if (duplicate) {
        if (duplicate.seat !== seat) throw new GameError('COMMAND_CONFLICT');
        return { state: previous, ack: JSON.parse(duplicate.ack) };
      }
      this.rateLimit(seat);
      if (input.expectedRevision !== previous.revision) throw new GameError('STALE_REVISION');
      const draws: number[] = [];
      const at = Date.now();
      const state = applyCommand(
        previous,
        seat,
        input.command,
        (max) => {
          const n = cryptoRandom(max);
          draws.push(n);
          return n;
        },
        this.edition,
        at,
      );
      const ack = { type: 'ack', commandId: input.commandId, revision: state.revision };
      this.save(state);
      if (
        input.command.type === 'start' ||
        input.command.type === 'startDemo' ||
        input.command.type === 'startSeries' ||
        input.command.type === 'rematch'
      ) {
        this.ctx.storage.sql.exec('DELETE FROM replay');
        this.ctx.storage.sql.exec('DELETE FROM events');
      }
      this.ctx.storage.sql.exec(
        'INSERT INTO commands VALUES (?, ?, ?)',
        input.commandId,
        seat,
        JSON.stringify(ack),
      );
      this.ctx.storage.sql.exec(
        'INSERT INTO events VALUES (?, ?)',
        state.revision,
        JSON.stringify({
          revision: state.revision,
          at,
          actor: seat,
          command: input.command,
          random: draws,
        }),
      );
      if (state.edition) {
        const view = viewForSeat(state, seat, this.status);
        this.ctx.storage.sql.exec(
          'INSERT INTO replay VALUES (?, ?)',
          state.revision,
          JSON.stringify({
            revision: state.revision,
            actor: seat,
            action: input.command.type,
            race: state.race,
            phase: state.phase,
            horses: view.horses,
            rolled: state.rolled,
            pace: state.pace,
            lastMove: state.lastMove,
          }),
        );
      }
      return { state, ack };
    });
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/create' && request.method === 'POST') {
        const body = createSchema.parse(await readBody(request));
        const credentials = token(),
          id = crypto.randomUUID();
        let state = newRoom(url.searchParams.get('code')!, {
          id,
          name: body.name,
          bot: false,
          connected: false,
          disconnectedAt: Date.now(),
          money: 0,
        });
        state.settings = body.settings;
        state.boardTheme = body.boardTheme;
        for (let i = 0; i < body.bots; i++)
          state = applyCommand(state, id, { type: 'addBot' }, cryptoRandom, null);
        this.ctx.storage.transactionSync(() => {
          if (this.ctx.storage.sql.exec('SELECT id FROM room').toArray().length)
            throw new GameError('ROOM_EXISTS');
          this.save(state);
          this.ctx.storage.sql.exec('INSERT INTO credentials VALUES (?, ?)', credentials, id);
        });
        await this.schedule(state);
        return response(
          {
            code: state.code,
            seatId: id,
            token: credentials,
            view: viewForSeat(state, id, this.status),
          },
          201,
        );
      }
      if (url.pathname === '/join' && request.method === 'POST') {
        const body = joinSchema.parse(await readBody(request));
        const credentials = token(),
          id = crypto.randomUUID();
        const state = this.ctx.storage.transactionSync(() => {
          const state = addHuman(this.load(), {
            id,
            name: body.name,
            bot: false,
            connected: false,
            disconnectedAt: Date.now(),
            money: 0,
          });
          this.save(state);
          this.ctx.storage.sql.exec('INSERT INTO credentials VALUES (?, ?)', credentials, id);
          return state;
        });
        this.broadcast(state);
        await this.schedule(state);
        return response(
          {
            code: state.code,
            seatId: id,
            token: credentials,
            view: viewForSeat(state, id, this.status),
          },
          201,
        );
      }
      if (url.pathname === '/ws' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
        const ticket = url.searchParams.get('ticket') ?? '';
        const row = this.ctx.storage.sql
          .exec<{ seat: string; expires: number }>(
            'SELECT seat, expires FROM tickets WHERE token=?',
            ticket,
          )
          .toArray()[0];
        if (!row || row.expires < Date.now()) throw new GameError('UNAUTHORIZED');
        let state = this.load();
        if (this.ctx.getWebSockets(row.seat).length >= 3)
          throw new GameError('TOO_MANY_CONNECTIONS');
        this.ctx.storage.sql.exec('DELETE FROM tickets WHERE token=?', ticket);
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server, [row.seat]);
        server.serializeAttachment({ seat: row.seat });
        const seat = state.seats.find((s) => s.id === row.seat)!;
        // Human control resumes between actions, never during an asynchronous bot computation.
        seat.connected = true;
        seat.disconnectedAt = null;
        seat.bot = false;
        state.revision++;
        this.save(state);
        this.broadcast(state);
        await this.schedule(state);
        return new Response(null, { status: 101, webSocket: client });
      }
      const seat = this.seatFromRequest(request);
      if (url.pathname === '/state' && request.method === 'GET')
        return response({ view: viewForSeat(this.load(), seat, this.status) });
      if (url.pathname === '/ticket' && request.method === 'POST') {
        this.load();
        const ticket = token();
        this.rateLimit(seat);
        this.ctx.storage.sql.exec('DELETE FROM tickets WHERE expires<?', Date.now());
        this.ctx.storage.sql.exec(
          'INSERT INTO tickets VALUES (?, ?, ?)',
          ticket,
          seat,
          Date.now() + 30000,
        );
        return response({ ticket });
      }
      if (url.pathname === '/command' && request.method === 'POST') {
        const input = envelopeSchema.parse(await readBody(request));
        const result = this.execute(seat, input);
        this.broadcast(result.state);
        // A cosmetic change must not postpone an already scheduled bot turn.
        if (input.command.type !== 'boardTheme') await this.schedule(result.state);
        return response({ ...result.ack, view: viewForSeat(result.state, seat, this.status) });
      }
      if (url.pathname === '/export' && request.method === 'GET') {
        const state = this.load();
        if (state.phase !== 'gameResults') throw new GameError('GAME_NOT_FINISHED');
        // A final seat-projected replay contains revealed bets, no tokens or unplayed deck order.
        const replay = this.ctx.storage.sql
          .exec<{ frame: string }>('SELECT frame FROM replay ORDER BY revision')
          .toArray()
          .map((row) => JSON.parse(row.frame));
        return response({ version: 1, game: viewForSeat(state, seat, this.status), replay });
      }
      return response({ error: 'NOT_FOUND' }, 404);
    } catch (error) {
      return this.failure(error);
    }
  }
  private failure(error: unknown) {
    const code =
      error instanceof GameError
        ? error.code
        : error instanceof SyntaxError || (error instanceof Error && error.name === 'ZodError')
          ? 'INVALID_MESSAGE'
          : 'SERVER_ERROR';
    return response(
      { error: code },
      code === 'UNAUTHORIZED'
        ? 401
        : code === 'ROOM_NOT_FOUND'
          ? 404
          : code === 'SERVER_ERROR'
            ? 500
            : 400,
    );
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const seat = ws.deserializeAttachment()?.seat as string;
    try {
      if (typeof message !== 'string' || message.length > 8192)
        throw new GameError('INVALID_MESSAGE');
      const input = envelopeSchema.parse(JSON.parse(message));
      const result = this.execute(seat, input);
      this.send(ws, result.ack);
      this.broadcast(result.state);
      if (input.command.type !== 'boardTheme') await this.schedule(result.state);
    } catch (error) {
      let commandId: string | undefined;
      try {
        commandId = JSON.parse(String(message)).commandId;
      } catch {
        /* Invalid JSON has no command identifier. */
      }
      this.send(ws, {
        type: 'error',
        commandId,
        error: ((await this.failure(error).json()) as { error: string }).error,
      });
      try {
        this.send(ws, { type: 'state', view: viewForSeat(this.load(), seat, this.status) });
      } catch {
        /* Expired rooms have no state. */
      }
    }
  }
  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    await this.disconnect(ws);
    ws.close(code, reason);
  }
  async webSocketError(ws: WebSocket) {
    await this.disconnect(ws);
  }
  private async disconnect(ws: WebSocket) {
    const id = ws.deserializeAttachment()?.seat as string;
    if (
      this.ctx
        .getWebSockets(id)
        .some((other) => other !== ws && other.readyState === WebSocket.OPEN)
    )
      return;
    try {
      const state = this.load(),
        seat = state.seats.find((s) => s.id === id)!;
      seat.connected = false;
      seat.disconnectedAt = Date.now();
      if (state.hostId === id)
        state.hostId = state.seats.find((s) => s.id !== id && s.connected && !s.bot)?.id ?? id;
      state.revision++;
      this.save(state);
      this.broadcast(state);
      await this.schedule(state);
    } catch {
      /* Already-expired rooms do not need a presence update. */
    }
  }
  async alarm() {
    try {
      const state = this.load();
      const active = state.seats[state.turn];
      if (
        !state.paused &&
        !presentationBusy(state) &&
        ['betting', 'roll', 'move'].includes(state.phase) &&
        active?.bot &&
        state.seats.some((s) => !s.bot && s.connected)
      ) {
        let seed = state.revision - state.boardThemeChanges;
        for (const char of state.code + active.id) seed = Math.imul(seed, 31) + char.charCodeAt(0);
        const command: GameCommand | null = chooseBotAction(
          viewForSeat(state, active.id, this.status),
          seed,
        );
        if (command) {
          const result = this.execute(active.id, {
            commandId: crypto.randomUUID(),
            expectedRevision: state.revision,
            command,
          });
          this.broadcast(result.state);
          await this.schedule(result.state);
          return;
        }
      }
      this.broadcast(state);
      await this.schedule(state);
    } catch (error) {
      if (error instanceof GameError && error.code === 'ROOM_NOT_FOUND') {
        for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'Room expired');
        await this.ctx.storage.deleteAll();
      } else {
        console.error('Room alarm failed');
        await this.ctx.storage.setAlarm(Date.now() + 5000);
      }
    }
  }
}
