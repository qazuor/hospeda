/**
 * @fileoverview
 * Data migration: 0046-hos-294-partner-revalidation-config
 *
 * Gives the `partner` entity type a `revalidation_config` row, without which
 * every partner cache purge is a silent no-op.
 *
 * ## Why it is needed
 *
 * `RevalidationService.scheduleRevalidation` looks up a config row by exact
 * `entity_type` match and returns early when there is none:
 *
 * ```ts
 * const config = await this.getEntityConfig(event.entityType);
 * if (!config) return; // No config -- skip revalidation
 * ```
 *
 * The miss is SILENT — no warn, no `revalidation_log` entry — and the schedule
 * is fire-and-forget, so the write that triggered it looks entirely successful.
 * HOS-294 introduces a partner detail page and tags the home carousel, and both
 * would go stale until their TTL with nothing indicating why. This is the same
 * failure `0036` fixed for the four W2-4 entity types.
 *
 * ## The values
 *
 * Matched to `destination` (10 s debounce, 120 min cron) rather than to
 * `accommodation`: a partner listing is curated content edited rarely — an
 * admin approving reviewed logo/description changes, or a subscription state
 * flipping — not something its owner tweaks repeatedly while watching the page.
 *
 * `autoRevalidateOnChange` is `true`: the fan-out is bounded and precisely
 * addressed (the partner's own entity tag plus `home`), unlike `tag`/`amenity`,
 * which are `false` because a catalog term appears on nearly every page.
 *
 * ## Dual-write
 *
 * The same entry was added to
 * `src/data/revalidationConfig/001-revalidation-config-defaults.json`, so a
 * fresh `db:fresh` reaches this end state directly. This migration exists for
 * the already-seeded environments (staging, production), which the baseline edit
 * alone would never reach.
 *
 * ## Idempotency
 *
 * `ON CONFLICT (entity_type) DO NOTHING`. `entity_type` is UNIQUE, so a re-run
 * inserts nothing, and an operator who has since tuned the row by hand keeps
 * their values — this fills an absence, it never overwrites.
 *
 * ## `destructive` flag decision
 *
 * `false` — inserts one row, deletes and rewrites nothing.
 */
import { revalidationConfig } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0046-hos-294-partner-revalidation-config',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The partner config row. Mirrors the matching entry in
 * `src/data/revalidationConfig/001-revalidation-config-defaults.json` (dual-write
 * rule) — keep both sides in sync.
 *
 * `entityType` must match what the service passes to `scheduleRevalidation`
 * EXACTLY: the lookup is a literal equality check, so `partner` written as
 * `partners` would miss and reproduce the very bug this fixes.
 */
const PARTNER_REVALIDATION_CONFIG = {
    entityType: 'partner',
    autoRevalidateOnChange: true,
    cronIntervalMinutes: 120,
    debounceSeconds: 10,
    enabled: true
} as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(revalidationConfig)
        .values([{ ...PARTNER_REVALIDATION_CONFIG }])
        .onConflictDoNothing({ target: revalidationConfig.entityType })
        .returning({ entityType: revalidationConfig.entityType });

    return {
        summary:
            inserted.length > 0
                ? 'Added revalidation config for the partner entity type.'
                : 'No revalidation config needed adding (partner already had a row).',
        counts: {
            configsInserted: inserted.length,
            configsTargeted: 1
        }
    };
}
