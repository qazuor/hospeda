#!/usr/bin/env tsx
/**
 * Deprecation stub for `pnpm env:check`.
 *
 * Was the Vercel-aware audit (compare .env.example against what is
 * configured in the Vercel project). After Phase 16.4 (Vercel / Neon
 * / Upstash teardown), production runs entirely on the VPS. The
 * remote audit is now done via hops on the VPS; the local
 * registry/schema cross-validation is unchanged and lives in
 * `pnpm env:check:registry`.
 *
 * Kept as an entry point so that copy-pasted commands and shell
 * history hit a clear message instead of a silent failure.
 *
 * @module scripts/env/check
 */

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.error(`${RED}pnpm env:check is deprecated.${RESET}`);
console.error('');
console.error('It compared local declarations against Vercel. Production no longer');
console.error('runs on Vercel (Phase 16.4 teardown). Two replacement checks:');
console.error('');
console.error(`  ${YELLOW}pnpm env:check:registry${RESET}`);
console.error('    Local: confirms every var in apps/<app>/src/utils/env.ts has a');
console.error('    matching entry in @repo/config registry. Pure unit-test, no');
console.error('    remote calls. Run this in CI.');
console.error('');
console.error(`  ${YELLOW}ssh -p 2222 qazuor@216.238.103.219${RESET}`);
console.error(`  ${YELLOW}hops env-list api${RESET}`);
console.error('    Remote: shows which env vars are actually configured on the');
console.error('    Coolify-managed prod app. Use for the audit-against-remote that');
console.error('    this script used to do.');
console.error('');
console.error('Full workflow: docs/guides/env-management.md');

process.exit(1);
