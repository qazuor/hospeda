/**
 * Ad-hoc local-dev helper: make a single user "ready" by writing the domain
 * state that onboarding gates read — profileCompleted, welcome-tour seen,
 * what's-new baselined, and mustChangePassword cleared.
 *
 * Idempotent and non-destructive: existing settings keys are preserved via
 * a read-modify-write merge. NOT for staging or production.
 *
 * Usage:
 *   pnpm --filter @repo/seed seed:ready-user <email>
 *   pnpm db:seed:ready-user <email>
 *
 * Example:
 *   pnpm db:seed:ready-user host-basico@local.test
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../apps/api/.env.local') });

const email = process.argv[2];

if (!email) {
    console.error('[mark-user-ready] Usage: pnpm db:seed:ready-user <email>');
    console.error('[mark-user-ready] Example: pnpm db:seed:ready-user host-basico@local.test');
    process.exit(1);
}

async function main(): Promise<void> {
    const { UserModel } = await import('@repo/db');
    const { initSeedDb, closeSeedDb } = await import('../src/utils/db.ts');
    const { markUserReady } = await import('../src/test-users/markUserReady.ts');

    initSeedDb();

    const userModel = new UserModel();

    const result = await markUserReady({ email, model: userModel });

    if (result.ok) {
        console.log(`[mark-user-ready] OK — user "${email}" (id: ${result.userId}) is now ready.`);
        console.log(
            '[mark-user-ready] Fields written: profileCompleted=true, mustChangePassword=false,'
        );
        console.log('[mark-user-ready]   settings.onboarding.adminTours["host.welcome"]=9999,');
        console.log('[mark-user-ready]   settings.onboarding.whatsNew.baselineAt=<now>.');
    } else {
        console.error(`[mark-user-ready] ERROR — user not found: ${email}`);
    }

    await closeSeedDb();

    if (!result.ok) {
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[mark-user-ready] FAILED:', err);
        process.exit(1);
    });
