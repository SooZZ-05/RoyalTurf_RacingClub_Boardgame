// Browser test server only; synthetic card data never enters the production deployment.
import { runtime } from '../tests/runtime';
const mf = await runtime(undefined, 8788);
console.log('Synthetic test API listening on http://127.0.0.1:8788');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await mf.dispose();
    process.exit(0);
  });
await new Promise(() => {});
