/**
 * One-off local-dev helper: re-run the idempotent role-permission seed so newly
 * added permissions (e.g. DESTINATION_LIFECYCLE_CHANGE / MODERATION_CHANGE) land
 * in the local DB without a full `db:fresh-dev`. Existing mappings are skipped.
 *
 * Run: pnpm --filter @repo/seed exec tsx ./scripts/reseed-role-permissions.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../apps/api/.env.local') });

async function main(): Promise<void> {
    const { initSeedDb, closeSeedDb } = await import('../src/utils/db.ts');
    const { seedRolePermissions } = await import('../src/required/rolePermissions.seed.ts');

    initSeedDb();
    await seedRolePermissions();
    await closeSeedDb();
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[reseed-role-permissions] FAILED:', err);
        process.exit(1);
    });
