import { GameRoom } from './room';
import { EDITION_STATUS } from '../src/shared/edition';
export { GameRoom };
export interface Env {
  ROOMS: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim());
    if (origin && !allowed.includes(origin) && origin !== url.origin)
      return json({ error: 'ORIGIN_DENIED' }, 403);
    const headers = {
      'Access-Control-Allow-Origin': origin ?? url.origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    let response: Response;
    if (url.pathname === '/api/health')
      response = json({ ok: true, editionReady: EDITION_STATUS.ready });
    else if (url.pathname === '/api/edition') response = json(EDITION_STATUS);
    else if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const code = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      response = await stub.fetch(
        new Request(`https://room/create?code=${code}`, {
          method: 'POST',
          body: request.body,
          headers: request.headers,
        }),
      );
    } else {
      const match = url.pathname.match(
        /^\/api\/rooms\/([A-Z2-9]{8})\/(join|state|ticket|ws|command|export)$/,
      );
      if (!match) response = json({ error: 'NOT_FOUND' }, 404);
      else {
        // Reject oversized payloads before routing to the room; the room also bounds chunked bodies.
        if (Number(request.headers.get('Content-Length') ?? 0) > 8192)
          return json({ error: 'MESSAGE_TOO_LARGE' }, 413);
        const internal = new URL(`https://room/${match[2]}`);
        internal.search = url.search;
        response = await env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(
          new Request(internal, request),
        );
      }
    }
    if (response.status === 101) return response;
    const out = new Response(response.body, response);
    for (const [key, value] of Object.entries(headers)) out.headers.set(key, value);
    return out;
  },
} satisfies ExportedHandler<Env>;
