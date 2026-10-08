import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { loadEnv } from 'vite';

// Local preflight only: never authenticates, contacts Cloudflare, or changes resources.
const args = new Set(process.argv.slice(2));
const checkApi = args.size === 0 || args.has('--api') || args.has('--web');
const checkWeb = args.size === 0 || args.has('--web');
const checkAssets = args.size === 0 || args.has('--assets');
const issues: string[] = [];
const root = process.cwd();
for (const arg of args)
  if (!['--api', '--web', '--assets'].includes(arg))
    issues.push(`Unknown option ${arg}; use --api, --web, or --assets.`);

function productionOrigin(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.origin === value &&
      !url.username &&
      !url.password &&
      !url.hostname.includes('*') &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      !/(^|\.)(example\.(com|org|net)|your-account|your-project|your-actual-subdomain)(\.|$)/i.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}

if (checkApi) {
  const parsed = ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    readFileSync(join(root, 'wrangler.jsonc'), 'utf8'),
  );
  if (parsed.error) {
    issues.push('wrangler.jsonc is not valid JSONC.');
  } else {
    const config = parsed.config;
    if (
      !config.durable_objects?.bindings?.some(
        (b: { name: string; class_name: string }) =>
          b.name === 'ROOMS' && b.class_name === 'GameRoom',
      )
    )
      issues.push('The ROOMS binding must reference GameRoom.');
    if (
      !config.migrations?.some((m: { new_sqlite_classes?: string[] }) =>
        m.new_sqlite_classes?.includes('GameRoom'),
      )
    )
      issues.push('Free deployment requires the GameRoom new_sqlite_classes migration.');
    const origins = String(config.vars?.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim());
    if (!origins.some(productionOrigin))
      issues.push('Add your exact HTTPS Pages origin to vars.ALLOWED_ORIGINS in wrangler.jsonc.');
    for (const origin of origins) {
      try {
        if (new URL(origin).origin !== origin || origin.includes('*')) throw new Error();
      } catch {
        issues.push(
          'Each ALLOWED_ORIGINS entry must be an origin only (no path, slash, or wildcard).',
        );
        break;
      }
    }
  }
}

if (checkWeb) {
  const env = loadEnv('production', root, 'VITE_');
  if (!productionOrigin(env.VITE_API_BASE))
    issues.push(
      'Set VITE_API_BASE in .env.local to your HTTPS Worker origin, without a trailing slash.',
    );
}

if (checkAssets) {
  const dist = join(root, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    issues.push('Build the site first: npm run build.');
  } else {
    const files: { path: string; bytes: number }[] = [];
    function walk(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.isFile()) files.push({ path, bytes: statSync(path).size });
      }
    }
    walk(dist);
    if (files.length > 20_000)
      issues.push(`Pages Free supports 20,000 files; dist has ${files.length}.`);
    for (const file of files)
      if (file.bytes > 25 * 1024 * 1024)
        issues.push(`Pages' 25 MiB asset limit is exceeded: ${relative(dist, file.path)}.`);
    const largest = files.reduce((a, b) => (a.bytes >= b.bytes ? a : b));
    console.log(
      `Pages assets: ${files.length} files; largest ${(largest.bytes / 1024 / 1024).toFixed(2)} MiB (${relative(dist, largest.path)}).`,
    );
  }
}

if (issues.length) {
  console.error(
    'Deployment preflight needs configuration:\n' + issues.map((issue) => `- ${issue}`).join('\n'),
  );
  console.error('Follow docs/cloudflare-deployment.md. No remote changes were made.');
  process.exitCode = 1;
} else {
  console.log(
    'Local deployment preflight passed. Account quotas and live connectivity still need checking after deployment.',
  );
}
