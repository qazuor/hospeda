/**
 * One-off local-dev helper: reset the SUPER_ADMIN Better Auth credential
 * password to a known value so the admin panel can be exercised locally.
 *
 * Reuses the exact same bcrypt mechanism as superAdminLoader.ts (rounds 10).
 * Touches only the single credential `account` row for the super admin.
 * Idempotent and non-destructive. NOT for staging/production.
 *
 * Run: pnpm --filter @repo/seed exec tsx ./scripts/reset-superadmin-password.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../apps/api/.env.local') });

const NEW_PASSWORD = process.env.HOSPEDA_SEED_SUPER_ADMIN_PASSWORD ?? 'Password123!';

async function main(): Promise<void> {
    const { UserModel, accounts, getDb } = await import('@repo/db');
    const { RoleEnum } = await import('@repo/schemas');
    const { hash } = await import('bcryptjs');
    const { and, eq } = await import('drizzle-orm');
    const { initSeedDb, closeSeedDb } = await import('../src/utils/db.ts');

    initSeedDb();

    const userModel = new UserModel();
    const superAdmin = await userModel.findOne({ role: RoleEnum.SUPER_ADMIN });

    if (!superAdmin) {
        throw new Error('No SUPER_ADMIN user found in this database.');
    }

    const email = (superAdmin as Record<string, unknown>).email as string | undefined;
    const db = getDb();
    const hashedPassword = await hash(NEW_PASSWORD, 10);

    const result = await db
        .update(accounts)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(and(eq(accounts.userId, superAdmin.id), eq(accounts.providerId, 'credential')))
        .returning({ id: accounts.id });

    if (result.length === 0) {
        throw new Error(
            `SUPER_ADMIN ${email ?? superAdmin.id} has no 'credential' account row to update.`
        );
    }

    console.log(`[reset-superadmin-password] Updated credential for: ${email ?? superAdmin.id}`);
    console.log(`[reset-superadmin-password] Login password set to: ${NEW_PASSWORD}`);

    await closeSeedDb();
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[reset-superadmin-password] FAILED:', err);
        process.exit(1);
    });
