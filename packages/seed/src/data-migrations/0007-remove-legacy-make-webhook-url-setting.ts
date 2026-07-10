/**
 * @fileoverview
 * Data migration: 0007-remove-legacy-make-webhook-url-setting
 *
 * Removes the orphaned `make_webhook_url` row from `social_settings` on
 * environments seeded BEFORE the HOS-64 credential-vault migration.
 *
 * Background: pre-HOS-64, `make_webhook_url` was a plaintext `social_settings`
 * row. HOS-64 moved it (and `make_api_key`, `ai_social_key`, `operator_pin`)
 * into the encrypted `social_credentials` vault, and dropped it from the seed's
 * `SETTINGS` array — but no companion data-migration ever removed the already
 * seeded row from live environments. The stale (now value-drained) row keeps
 * showing up in the admin `/social/settings` list alongside the real
 * vault-backed entry on `/social/credentials`, which is confusing. Nothing in
 * the runtime request/cron path reads the settings-store value anymore — every
 * dispatch reads `make_webhook_url` exclusively from the vault via
 * `getDecryptedSocialCredential({ key: 'make_webhook_url' })` — so removing the
 * settings row is behavior-neutral.
 *
 * ## Safety guard
 *
 * Only deletes the legacy row when an ACTIVE `make_webhook_url` vault
 * credential already exists. On an environment that has not yet run
 * `apps/api/scripts/social-vault-migrate.ts`, the `social_settings` row may
 * still hold the ONLY copy of the operator-configured webhook URL — deleting it
 * there would lose it. In that case the migration skips (idempotent no-op) and
 * reports why; re-run it after the vault is populated.
 *
 * ## `destructive` flag decision
 *
 * `true` — this issues a hard `DELETE` (via the FK-guarded `ctx.helpers.safeDelete`).
 * The runner's production gate therefore requires an explicit opt-in
 * (`HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION` / `--allow-destructive`) before it runs
 * in production, which is the desired behavior for a row deletion — even a
 * safe, guarded one.
 */
import { and, eq, isNull, socialCredentials, socialSettings } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0007-remove-legacy-make-webhook-url-setting',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

const LEGACY_SETTING_KEY = 'make_webhook_url';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // Guard: require an active vault credential before deleting the legacy row,
    // so an environment that has not migrated its value into the vault yet does
    // not lose the only copy of a configured webhook URL.
    const activeVaultCredential = await ctx.db
        .select({ id: socialCredentials.id })
        .from(socialCredentials)
        .where(
            and(eq(socialCredentials.key, LEGACY_SETTING_KEY), isNull(socialCredentials.deletedAt))
        )
        .limit(1);

    if (activeVaultCredential.length === 0) {
        return {
            summary:
                'Skipped: no active make_webhook_url vault credential found — keeping the legacy social_settings row to avoid losing a possibly-unmigrated value. Run social-vault-migrate.ts first, then re-run.',
            counts: { deleted: 0, skipped: 1 }
        };
    }

    const result = await ctx.helpers.safeDelete({
        table: socialSettings,
        where: eq(socialSettings.key, LEGACY_SETTING_KEY),
        reason: 'Legacy make_webhook_url social_settings row: superseded by the HOS-64 credential vault; no runtime code reads it from settings anymore.'
    });

    return result.deleted
        ? {
              summary: 'Removed legacy make_webhook_url social_settings row.',
              counts: { deleted: 1 }
          }
        : {
              summary: `Skipped make_webhook_url settings deletion: ${result.reason}`,
              counts: { deleted: 0, skipped: 1 }
          };
}
