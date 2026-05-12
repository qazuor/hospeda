#!/usr/bin/env tsx
/**
 * Deprecation stub for `pnpm env:sync`.
 *
 * Was the bulk-push variant of env:push, walking the registry and
 * prompting per missing var per app/env. After Phase 16.4 (Vercel /
 * Neon / Upstash teardown), production runs entirely on the VPS and
 * Vercel is no longer involved. The replacement is per-var via hops
 * on the VPS — see `docs/guides/env-management.md`.
 *
 * Kept as an entry point so that copy-pasted commands and shell
 * history hit a clear message instead of a silent failure or a stale
 * Vercel API call.
 *
 * @module scripts/env/sync
 */

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.error(`${RED}pnpm env:sync is deprecated.${RESET}`);
console.error('');
console.error('It targeted the Vercel API. Production no longer runs on Vercel');
console.error('(Phase 16.4 teardown). Manage env vars per-key via hops on the VPS:');
console.error('');
console.error(`  ${YELLOW}ssh -p 2222 qazuor@216.238.103.219${RESET}`);
console.error(`  ${YELLOW}hops env-set api KEY VALUE${RESET}`);
console.error(`  ${YELLOW}hops env-list api${RESET}`);
console.error(`  ${YELLOW}hops redeploy api${RESET}`);
console.error('');
console.error('For audit/drift detection use:');
console.error(`  ${YELLOW}pnpm env:check:registry${RESET}    # local: registry vs schemas`);
console.error(`  ${YELLOW}hops env-list api${RESET}            # remote: what is in prod`);
console.error('');
console.error('Full workflow: docs/guides/env-management.md');

process.exit(1);
