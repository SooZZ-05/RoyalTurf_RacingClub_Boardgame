import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Miniflare } from 'miniflare';
import { runtime } from './runtime';
import type { GameState } from '../src/shared/types';
import { EDITION_STATUS } from '../src/shared/edition';

const settings = { deck: 'base', hidden: false, crowded: false, alternative: false };
describe('Cloudflare room persistence and transport', () => {
  let mf: Miniflare, persist: string;
  beforeAll(async () => {
    persist = await mkdtemp(join(tmpdir(), 'royal-turf-'));
    mf = await runtime(persist);
  });
  afterAll(async () => {
    await mf?.dispose();
    if (persist) await rm(persist, { recursive: true, force: true });
  });
  async function post(path: string, body: unknown, token?: string) {
    const result = await mf.dispatchFetch('http://club' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: result.status, body: (await result.json()) as any };
  }
  async function create() {
    return (await post('/api/rooms', { name: 'Alice', bots: 0, settings })).body;
  }
  async function inspect(code: string) {
    return (await (
      await mf.dispatchFetch(`http://club/_test/rooms/${code}/inspect`)
    ).json()) as GameState;
  }
  async function state(session: any) {
    return (
      (await (
        await mf.dispatchFetch(`http://club/api/rooms/${session.code}/state`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
      ).json()) as any
    ).view;
  }
  it('requires valid guest input, session credentials, allowed origins and bounded messages', async () => {
    expect((await post('/api/rooms', { name: '', bots: 0, settings })).body.error).toBe(
      'INVALID_MESSAGE',
    );
    const alice = await create();
    expect((await mf.dispatchFetch(`http://club/api/rooms/${alice.code}/state`)).status).toBe(401);
    expect(
      (
        await mf.dispatchFetch('http://club/api/health', {
          headers: { Origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403);
    expect(
      (await post(`/api/rooms/${alice.code}/command`, { payload: 'x'.repeat(9000) }, alice.token))
        .body.error,
    ).toBe('MESSAGE_TOO_LARGE');
  });
  it('persists the host theme across late joins, live broadcasts and worker restart', async () => {
    const alice = (
      await post('/api/rooms', {
        name: 'Alice',
        bots: 0,
        settings,
        boardTheme: 'imperial-porcelain',
      })
    ).body;
    expect(alice.view.boardTheme).toBe('imperial-porcelain');
    const bob = (await post(`/api/rooms/${alice.code}/join`, { name: 'Bob' })).body;
    expect(bob.view.boardTheme).toBe('imperial-porcelain');
    const input = {
      commandId: crypto.randomUUID(),
      expectedRevision: bob.view.revision,
      command: { type: 'boardTheme', boardTheme: 'nocturne' },
    };
    expect((await post(`/api/rooms/${alice.code}/command`, input, bob.token)).body.error).toBe(
      'HOST_ONLY',
    );
    expect(
      (
        await post(
          `/api/rooms/${alice.code}/command`,
          { ...input, command: { type: 'boardTheme', boardTheme: 'invalid' } },
          alice.token,
        )
      ).body.error,
    ).toBe('INVALID_MESSAGE');
    expect((await state(alice)).boardTheme).toBe('imperial-porcelain');
    const ticket = (await post(`/api/rooms/${alice.code}/ticket`, {}, bob.token)).body.ticket;
    const socketResponse = await mf.dispatchFetch(
      `http://club/api/rooms/${alice.code}/ws?ticket=${ticket}`,
      { headers: { Upgrade: 'websocket' } },
    );
    const ws = socketResponse.webSocket!;
    ws.accept();
    const broadcast = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Theme state was not broadcast')), 3000);
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data as string);
        if (message.type === 'state' && message.view.boardTheme === 'nocturne') {
          clearTimeout(timeout);
          resolve(message.view);
        }
      });
    });
    const before = await state(alice);
    const changed = await post(
      `/api/rooms/${alice.code}/command`,
      { ...input, expectedRevision: before.revision },
      alice.token,
    );
    expect(changed.status).toBe(200);
    expect((await broadcast).boardTheme).toBe('nocturne');
    expect((await inspect(alice.code)).boardTheme).toBe('nocturne');
    ws.close();
    await mf.dispose();
    mf = await runtime(persist);
    expect((await state(alice)).boardTheme).toBe('nocturne');
    expect((await state(bob)).boardTheme).toBe('nocturne');
  });
  it('loads persisted legacy rooms with the Royal Club default', async () => {
    const alice = await create();
    expect(alice.view.boardTheme).toBe('royal-club');
    const legacy = (await inspect(alice.code)) as Partial<GameState>;
    delete legacy.boardTheme;
    delete legacy.boardThemeChanges;
    await post(`/_test/rooms/${alice.code}/seed`, legacy);
    expect((await state(alice)).boardTheme).toBe('royal-club');
    const changed = await post(
      `/api/rooms/${alice.code}/command`,
      {
        commandId: crypto.randomUUID(),
        expectedRevision: legacy.revision,
        command: { type: 'boardTheme', boardTheme: 'nocturne' },
      },
      alice.token,
    );
    expect(changed.status).toBe(200);
    expect(changed.body.view.boardTheme).toBe('nocturne');
    expect((await inspect(alice.code)).boardThemeChanges).toBe(1);
  });
  it('retries a command exactly once and survives restart after a roll', async () => {
    const alice = await create();
    const bob = (await post(`/api/rooms/${alice.code}/join`, { name: 'Bob' })).body;
    const start = {
      commandId: crypto.randomUUID(),
      expectedRevision: (await state(alice)).revision,
      command: { type: 'start' },
    };
    const first = await post(`/api/rooms/${alice.code}/command`, start, alice.token);
    const retry = await post(`/api/rooms/${alice.code}/command`, start, alice.token);
    expect(retry.body.revision).toBe(first.body.revision);
    expect((await inspect(alice.code)).race).toBe(1);
    let view = first.body.view;
    while (view.phase === 'betting') {
      const actor = view.activeId === alice.seatId ? alice : bob;
      const actorView = await state(actor);
      const result = await post(
        `/api/rooms/${alice.code}/command`,
        {
          commandId: crypto.randomUUID(),
          expectedRevision: actorView.revision,
          command: actorView.legal.find((c: any) => c.type === 'bet'),
        },
        actor.token,
      );
      view = result.body.view;
    }
    const actor = view.activeId === alice.seatId ? alice : bob;
    const roll = {
      commandId: crypto.randomUUID(),
      expectedRevision: view.revision,
      command: { type: 'roll' },
    };
    const rolled = (await post(`/api/rooms/${alice.code}/command`, roll, actor.token)).body;
    expect(rolled.view.phase).toBe('move');
    await mf.dispose();
    mf = await runtime(persist);
    const restored = await state(actor);
    expect(restored.revision).toBe(rolled.revision);
    expect(restored.rolled).toBe(rolled.view.rolled);
    expect((await post(`/api/rooms/${alice.code}/command`, roll, actor.token)).body.revision).toBe(
      rolled.revision,
    );
    const wrong = await post(
      `/api/rooms/${alice.code}/command`,
      {
        commandId: crypto.randomUUID(),
        expectedRevision: restored.revision,
        command: { type: 'roll' },
      },
      actor.token,
    );
    expect(wrong.body.error).toBe('PRESENTATION_ACTIVE');
    expect(restored.legal.some((c: any) => c.type === 'move')).toBe(false);
    expect(restored.presentation).toEqual(rolled.view.presentation);
    // Advance only the test clock window; production has no seed endpoint.
    const internal = await inspect(alice.code);
    internal.presentation!.endsAt = Date.now() - 1;
    await post(`/_test/rooms/${alice.code}/seed`, internal);
    const afterReveal = await state(actor);
    const moved = (
      await post(
        `/api/rooms/${alice.code}/command`,
        {
          commandId: crypto.randomUUID(),
          expectedRevision: restored.revision,
          command: afterReveal.legal.find((c: any) => c.type === 'move'),
        },
        actor.token,
      )
    ).body;
    expect(moved.view.phase).toBe('roll');
  });
  it('rejects stale and reused commands across seats', async () => {
    const alice = await create();
    const bob = (await post(`/api/rooms/${alice.code}/join`, { name: 'Bob' })).body;
    const input = {
      commandId: crypto.randomUUID(),
      expectedRevision: (await state(alice)).revision,
      command: { type: 'addBot' },
    };
    expect((await post(`/api/rooms/${alice.code}/command`, input, alice.token)).status).toBe(200);
    expect((await post(`/api/rooms/${alice.code}/command`, input, bob.token)).body.error).toBe(
      'COMMAND_CONFLICT',
    );
    expect(
      (
        await post(
          `/api/rooms/${alice.code}/command`,
          { ...input, commandId: crypto.randomUUID() },
          alice.token,
        )
      ).body.error,
    ).toBe('STALE_REVISION');
  });
  it('persists table pause and the shared dice timeline across Worker restart', async () => {
    const alice = await create();
    const bob = (await post(`/api/rooms/${alice.code}/join`, { name: 'Bob' })).body;
    const submit = async (session: any, command: unknown) =>
      post(
        `/api/rooms/${session.code}/command`,
        {
          commandId: crypto.randomUUID(),
          expectedRevision: (await state(session)).revision,
          command,
        },
        session.token,
      );
    expect((await submit(alice, { type: 'startSeries' })).body.view.edition.raceCount).toBe(3);
    const internal = await inspect(alice.code);
    internal.phase = 'roll';
    internal.turn = 0;
    await post(`/_test/rooms/${alice.code}/seed`, internal);
    const rolled = (await submit(alice, { type: 'roll' })).body.view;
    expect((await state(bob)).presentation).toEqual(rolled.presentation);
    expect((await submit(bob, { type: 'pause', paused: true })).body.error).toBe('HOST_ONLY');
    const paused = (await submit(alice, { type: 'pause', paused: true })).body.view;
    expect(paused.paused).toBe(true);
    expect((await submit(alice, { type: 'move', horseId: 0 })).body.error).toBe('GAME_PAUSED');
    await mf.dispose();
    mf = await runtime(persist);
    const restored = await state(bob);
    expect(restored.pausedAt).toBe(paused.pausedAt);
    expect(restored.presentation).toEqual(paused.presentation);
    const resumed = (await submit(alice, { type: 'pause', paused: false })).body.view;
    expect(resumed.paused).toBe(false);
    expect(resumed.presentation.endsAt).toBeGreaterThan(paused.presentation.endsAt);
    expect(resumed.legal.some((c: any) => c.type === 'move')).toBe(false);
  });
  it('repairs the old checkpoint rule and persists corrected ledgers through restart', async () => {
    const alice = await create();
    const bob = (await post(`/api/rooms/${alice.code}/join`, { name: 'Bob' })).body;
    await post(
      `/api/rooms/${alice.code}/command`,
      {
        commandId: crypto.randomUUID(),
        expectedRevision: bob.view.revision,
        command: { type: 'startSeries' },
      },
      alice.token,
    );
    const legacy = await inspect(alice.code);
    legacy.phase = 'raceResults';
    legacy.presentation = null;
    legacy.edition!.version = '1.0.0-seven-profile-series';
    legacy.edition!.rules.paceRequiresPodium = true;
    const ranks = legacy.horses.slice(0, 3).map((h) => h.id);
    const pace = legacy.horses[3].id,
      last = legacy.horses[6].id;
    legacy.pace = pace;
    legacy.bets = [
      { seatId: alice.seatId, horseId: pace, chip: { id: 'A-pace', value: 2 } },
      { seatId: alice.seatId, horseId: last, chip: { id: 'A-last', value: 1 } },
      { seatId: bob.seatId, horseId: pace, chip: { id: 'B-pace', value: 1 } },
      { seatId: bob.seatId, horseId: last, chip: { id: 'B-last', value: 2 } },
    ];
    legacy.results = [
      {
        race: 1,
        ranks,
        last: [last],
        pace,
        bets: structuredClone(legacy.bets),
        ledger: legacy.seats.map((seat) => ({
          seatId: seat.id,
          winnings: 0,
          bonus: 0,
          penalty: seat.id === alice.seatId ? 100 : 200,
          paidPenalty: 0,
          balance: 0,
        })),
      },
    ];
    await post(`/_test/rooms/${alice.code}/seed`, legacy);
    const corrected = await state(alice);
    expect(corrected.rules.paceRequiresPodium).toBe(false);
    expect(corrected.revision).toBeGreaterThan(legacy.revision);
    expect(corrected.results[0].ledger[0]).toMatchObject({
      bonus: 200,
      penalty: 100,
      paidPenalty: 100,
      balance: 100,
    });
    expect(corrected.results[0].ledger[1]).toMatchObject({
      bonus: 100,
      penalty: 200,
      paidPenalty: 100,
      balance: 0,
    });
    expect((await state(bob)).results).toEqual(corrected.results);
    await mf.dispose();
    mf = await runtime(persist);
    const restored = await state(alice);
    expect(restored.results).toEqual(corrected.results);
    expect(restored.seats.map((seat: any) => seat.money)).toEqual([100, 0]);
    expect(restored.revision).toBe(corrected.revision);
  });
  it('uses one-use WebSocket tickets and sends only the authenticated seat view', async () => {
    const alice = await create();
    const ticket = (await post(`/api/rooms/${alice.code}/ticket`, {}, alice.token)).body.ticket;
    const response = await mf.dispatchFetch(
      `http://club/api/rooms/${alice.code}/ws?ticket=${ticket}`,
      { headers: { Upgrade: 'websocket' } },
    );
    expect(response.status).toBe(101);
    const ws = response.webSocket!;
    ws.accept();
    expect(
      (
        await mf.dispatchFetch(`http://club/api/rooms/${alice.code}/ws?ticket=${ticket}`, {
          headers: { Upgrade: 'websocket' },
        })
      ).status,
    ).toBe(401);
    expect((await state(alice)).seats[0].connected).toBe(true);
    const message = new Promise<any>((resolve) =>
      ws.addEventListener('message', (event) => {
        if (event.data === 'pong') resolve(event.data);
      }),
    );
    ws.send('ping');
    expect(await message).toBe('pong');
    ws.close();
  });
  it('rejects an unknown room without creating a playable game', async () => {
    expect((await post('/api/rooms/ZZZZZZZZ/join', { name: 'Bob' })).body.error).toBe(
      'ROOM_NOT_FOUND',
    );
  });
  it('runs bots through persisted alarms, and pauses them when no human is connected', async () => {
    const alice = await create();
    let current = await state(alice);
    await post(
      `/api/rooms/${alice.code}/command`,
      {
        commandId: crypto.randomUUID(),
        expectedRevision: current.revision,
        command: { type: 'addBot' },
      },
      alice.token,
    );
    current = await state(alice);
    await post(
      `/api/rooms/${alice.code}/command`,
      {
        commandId: crypto.randomUUID(),
        expectedRevision: current.revision,
        command: { type: 'start' },
      },
      alice.token,
    );
    let internal = await inspect(alice.code);
    internal.turn = internal.seats.findIndex((s) => s.bot);
    internal.seats[0].connected = true;
    const revision = internal.revision;
    await post(`/_test/rooms/${alice.code}/seed`, internal);
    await expect.poll(async () => (await inspect(alice.code)).revision).toBeGreaterThan(revision);
    internal = await inspect(alice.code);
    expect(internal.bets.some((b) => b.seatId.startsWith('bot-'))).toBe(true);
    internal.turn = internal.seats.findIndex((s) => s.bot);
    internal.seats[0].connected = false;
    const paused = internal.revision;
    await post(`/_test/rooms/${alice.code}/seed`, internal);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((await inspect(alice.code)).revision).toBe(paused);
  });
});
describe('production data gate in the real Workers runtime', () => {
  it('starts both complete published decks through the actual production Worker', async () => {
    const mf = await runtime(undefined, undefined, true);
    try {
      for (const deck of ['base', 'historical']) {
        const response = await mf.dispatchFetch('http://club/api/rooms', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Real deck',
            bots: 1,
            settings: { ...settings, deck, hidden: true },
          }),
        });
        const session = (await response.json()) as any;
        const started = await mf.dispatchFetch(`http://club/api/rooms/${session.code}/command`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({
            commandId: crypto.randomUUID(),
            expectedRevision: session.view.revision,
            command: { type: 'start' },
          }),
        });
        const game = ((await started.json()) as any).view;
        expect(game.phase).toBe('betting');
        expect(game.horses).toHaveLength(7);
        expect(game.horses.every((h: any) => h.cardId.startsWith(`published-${deck}-`))).toBe(true);
        expect(game.edition).toMatchObject({
          ready: true,
          verified: false,
          limitedProfiles: false,
          supportedDecks: ['base', 'historical'],
          raceCount: 3,
        });
        expect(game.rules).toMatchObject({
          trackLength: 36,
          finishDistance: 37,
          paceDistance: 18,
          paceBonus: 100,
          lastPenalty: 100,
          paceRequiresPodium: false,
        });
        expect(game.hand.map((c: any) => c.value)).toEqual([0, 1, 1, 2]);
      }
    } finally {
      await mf.dispose();
    }
  });
  it('keeps full-edition validation separate from the playable demo and excludes test endpoints', async () => {
    const mf = await runtime(undefined, undefined, true);
    try {
      const response = await mf.dispatchFetch('http://club/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: 'Alice', bots: 1, settings }),
      });
      const session = (await response.json()) as any;
      const start = await mf.dispatchFetch(`http://club/api/rooms/${session.code}/command`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          commandId: crypto.randomUUID(),
          expectedRevision: session.view.revision,
          command: { type: 'start' },
        }),
      });
      const body = (await start.json()) as any;
      if (EDITION_STATUS.ready) expect(body.view.phase).toBe('betting');
      else expect(body.error).toBe('EDITION_UNVERIFIED');
      expect(
        (await mf.dispatchFetch(`http://club/_test/rooms/${session.code}/inspect`)).status,
      ).toBe(404);
      const demoSession = (await (
        await mf.dispatchFetch('http://club/api/rooms', {
          method: 'POST',
          body: JSON.stringify({ name: 'Demo player', bots: 1, settings }),
        })
      ).json()) as any;
      const demo = await mf.dispatchFetch(`http://club/api/rooms/${demoSession.code}/command`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${demoSession.token}` },
        body: JSON.stringify({
          commandId: crypto.randomUUID(),
          expectedRevision: demoSession.view.revision,
          command: { type: 'startDemo' },
        }),
      });
      const demoBody = (await demo.json()) as any;
      expect(demoBody.view.phase).toBe('betting');
      expect(demoBody.view.edition).toMatchObject({ demo: true, ready: false, raceCount: 1 });
      expect(demoBody.view.horses).toHaveLength(7);
      const seriesSession = (await (
        await mf.dispatchFetch('http://club/api/rooms', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Series player',
            bots: 1,
            settings: { ...settings, hidden: true },
          }),
        })
      ).json()) as any;
      const series = (await (
        await mf.dispatchFetch(`http://club/api/rooms/${seriesSession.code}/command`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${seriesSession.token}` },
          body: JSON.stringify({
            commandId: crypto.randomUUID(),
            expectedRevision: seriesSession.view.revision,
            command: { type: 'startSeries' },
          }),
        })
      ).json()) as any;
      expect(series.view.edition).toMatchObject({
        demo: false,
        limitedProfiles: true,
        ready: false,
        raceCount: 3,
      });
      expect(series.view.hand.map((chip: any) => chip.value)).toEqual([0, 1, 1, 2]);
    } finally {
      await mf.dispose();
    }
  });
});
