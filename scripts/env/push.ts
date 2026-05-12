#!/usr/bin/env tsx
/**
 * Deprecation stub for `pnpm env:push`.
 *
 * This script targeted the Vercel API. After Phase 16.4 (Vercel /
 * Neon / Upstash teardown), production runs entirely on the VPS via
 * Coolify and Vercel is no longer involved. The replacement workflow
 * is documented in `docs/guides/env-management.md` — TL;DR: use
 * `hops env-set <kind> KEY VALUE` from the VPS.
 *
 * Kept as an entry point so that copy-pasted commands and shell
 * history hit a clear message instead of a silent failure or a stale
 * Vercel API call.
 *
 * @module scripts/env/push
 */

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.error(`${RED}pnpm env:push is deprecated.${RESET}`);
console.error('');
console.error('It targeted the Vercel API. Production no longer runs on Vercel');
console.error('(Phase 16.4 teardown). Use hops on the VPS instead:');
console.error('');
console.error(`  ${YELLOW}ssh -p 2222 qazuor@216.238.103.219${RESET}`);
console.error(`  ${YELLOW}hops env-set api FOO bar${RESET}`);
console.error(`  ${YELLOW}hops env-set api MERCADO_PAGO_TOKEN --secret${RESET}`);
console.error(`  ${YELLOW}hops redeploy api${RESET}`);
console.error('');
console.error('Or use the Coolify UI at https://coolify.hospeda.com.ar');
console.error('');
console.error('Full workflow: docs/guides/env-management.md');

process.exit(1);
