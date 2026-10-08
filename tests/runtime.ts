import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
export async function runtime(persist?: string, port?: number, production = false) {
  const bundle = await build({
    entryPoints: [production ? 'worker/index.ts' : 'tests/test-worker.ts'],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    write: false,
    external: ['cloudflare:workers'],
  });
  const mf = new Miniflare({
    script: bundle.outputFiles[0].text,
    modules: true,
    compatibilityDate: '2025-09-01',
    name: 'royal-turf-test',
    ...(port ? { port } : {}),
    durableObjects: { ROOMS: { className: production ? 'GameRoom' : 'TestRoom', useSQLite: true } },
    bindings: {
      ALLOWED_ORIGINS:
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174',
    },
    ...(persist ? { durableObjectsPersist: persist } : {}),
  });
  await mf.ready;
  return mf;
}
