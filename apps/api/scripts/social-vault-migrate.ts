/**
 * One-time social credential vault data migration — HOS-64 T-025.
 *
 * Reads the CURRENT plaintext sources for the 4 social credentials and
 * creates each one in the social credential vault (skipping any key that
 * already has an active vault credential):
 *
 *   - make_webhook_url  <- social_settings row (key = 'make_webhook_url')
 *   - make_api_key      <- HOSPEDA_MAKE_API_KEY
 *   - ai_social_key     <- HOSPEDA_AI_SOCIAL_KEY
 *   - operator_pin      <- HOSPEDA_OPERATOR_PIN
 *
 * Idempotent — safe to run again against an already-migrated (fully or
 * partially) environment. All resolution + skip logic lives in
 * `migrateSocialCredentialsToVault` (src/services/social-vault-migration.service.ts);
 * this script only wires up real env vars + the DB connection.
 *
 * Run (from monorepo root):
 *   pnpm --filter hospeda-api exec tsx scripts/social-vault-migrate.ts
 *
 * Required env (apps/api/.env.local, or the real target env when run
 * against staging/prod per T-033/T-034):
 *   - HOSPEDA_DATABASE_URL
 *   - HOSPEDA_SOCIAL_VAULT_MASTER_KEY
 *
 * The 3 legacy source vars (HOSPEDA_MAKE_API_KEY, HOSPEDA_AI_SOCIAL_KEY,
 * HOSPEDA_OPERATOR_PIN) are read directly off `process.env`, NOT the
 * Zod-validated `env` object — HOS-64 T-042 removed them from the schema
 * once every runtime read-site was vault-only, ahead of this script
 * actually running against staging/prod (T-033/T-034). They still exist as
 * real Coolify env vars at that point (T-043 unsets them only afterward),
 * this script is simply no longer able to reach them through the typed
 * `env` object.
 */
import { resolve } from 'node:path';
import { eq, getDb, initializeDb, socialSettings, UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { migrateSocialCredentialsToVault } from '../src/services/social-vault-migration.service.js';
import { env, validateApiEnv } from '../src/utils/env.js';

loadEnv({ path: resolve(import.meta.dirname, '..', '.env.local'), quiet: true });

async function main() {
    validateApiEnv();

    if (!env.HOSPEDA_SOCIAL_VAULT_MASTER_KEY) {
        console.error(
            '[social-vault-migrate] Missing HOSPEDA_SOCIAL_VAULT_MASTER_KEY — cannot encrypt credentials.'
        );
        process.exit(1);
    }

    const pool = new Pool({ connectionString: env.HOSPEDA_DATABASE_URL });
    initializeDb(pool);
    const db = getDb();

    // Resolve an actor to attribute the social_credential_audit rows to.
    const userModel = new UserModel();
    const { items: admins } = await userModel.findAll(
        { role: RoleEnum.SUPER_ADMIN, deletedAt: null },
        { page: 1, pageSize: 1, sortBy: 'createdAt', sortOrder: 'asc' }
    );
    const actor = admins[0];
    if (!actor) {
        console.error(
            '[social-vault-migrate] No SUPER_ADMIN user found — cannot attribute audit rows. Run the required seed first.'
        );
        await pool.end();
        process.exit(1);
    }

    // make_webhook_url's legacy source: the social_settings row (no longer
    // seeded by default since HOS-64, but may still exist with an
    // admin-configured value on environments seeded before this change).
    const [webhookRow] = await db
        .select({ value: socialSettings.value })
        .from(socialSettings)
        .where(eq(socialSettings.key, 'make_webhook_url'))
        .limit(1);

    const result = await migrateSocialCredentialsToVault({
        actorId: actor.id,
        source: {
            makeWebhookUrl: webhookRow?.value ?? null,
            // Read directly off process.env — HOS-64 T-042 removed these 3
            // from the Zod-validated `env` object (see module doc comment).
            makeApiKey: process.env.HOSPEDA_MAKE_API_KEY,
            aiSocialKey: process.env.HOSPEDA_AI_SOCIAL_KEY,
            operatorPin: process.env.HOSPEDA_OPERATOR_PIN
        }
    });

    console.info('[social-vault-migrate] Done.');
    console.info(`  actor:            ${actor.id} (${actor.email})`);
    console.info(`  created:          ${result.created.join(', ') || '(none)'}`);
    console.info(`  skippedExisting:  ${result.skippedExisting.join(', ') || '(none)'}`);
    console.info(`  skippedNoSource:  ${result.skippedNoSource.join(', ') || '(none)'}`);

    await pool.end();

    if (result.errors.length > 0) {
        console.error('[social-vault-migrate] Errors:', JSON.stringify(result.errors, null, 2));
        process.exit(1);
    }

    process.exit(0);
}

main().catch((error) => {
    console.error('[social-vault-migrate] Unexpected error:', error);
    process.exit(1);
});
