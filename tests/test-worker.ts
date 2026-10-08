// Test entry point only. wrangler.jsonc never references this module.
import router from '../worker/index';
import { GameRoom } from '../worker/room';
import { fixture, ready } from './fixture';
import type { Env } from '../worker/index';
export class TestRoom extends GameRoom {
  protected get edition() {
    return fixture;
  }
  protected get status() {
    return ready;
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/inspect') {
      const row = this.ctx.storage.sql
        .exec<{ state: string }>('SELECT state FROM room WHERE id=1')
        .toArray()[0];
      return Response.json(row ? JSON.parse(row.state) : null);
    }
    if (url.pathname === '/seed' && request.method === 'POST') {
      const state = await request.json();
      this.ctx.storage.sql.exec('UPDATE room SET state=? WHERE id=1', JSON.stringify(state));
      await this.ctx.storage.setAlarm(Date.now() + 25);
      return Response.json({ ok: true });
    }
    return super.fetch(request);
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/edition') return Response.json(ready);
    const match = url.pathname.match(/^\/_test\/rooms\/([A-Z2-9]{8})\/(inspect|seed)$/);
    if (match)
      return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(
        new Request(`https://room/${match[2]}`, request),
      );
    return router.fetch(request, env);
  },
};
