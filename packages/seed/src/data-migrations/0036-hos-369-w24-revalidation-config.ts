/**
 * @fileoverview
 * Data migration: 0036-hos-369-w24-revalidation-config
 *
 * Gives the four HOS-369 W2-4 entity types a `revalidation_config` row, without
 * which their cache purges never happen.
 *
 * ## Why this is a bug fix and not a config tweak
 *
 * `RevalidationService.scheduleRevalidation` reads a per-entity-type config row
 * before doing anything:
 *
 * ```ts
 * const config = await this.getEntityConfig(event.entityType);
 * if (!config) return; // No config -- skip revalidation
 * ```
 *
 * The lookup is an exact match on `entity_type` and the miss is SILENT — no
 * warn, no `revalidation_log` entry, and `scheduleRevalidation` is
 * fire-and-forget, so the caller sees a successful write either way.
 *
 * W2-4 wired the purge chain for `pointOfInterest`, `attraction`, `gastronomy`,
 * and `experience`, but the config table only ever carried the eight types that
 * predate it. Every purge for those four has been a no-op on staging and
 * production since the wave shipped: the tags are computed correctly, the
 * Cloudflare adapter works (verified by purging `preview:dest-colon` by hand and
 * watching exactly that page fall), and then the schedule returns at the config
 * lookup before any of it runs.
 *
 * ## The values, and where they come from
 *
 * Paired with the existing rows by how the entity behaves, not by guesswork:
 *
 * - `pointOfInterest` / `attraction` — curated catalog, edited rarely and in
 *   bursts by an operator. Matches `destination` (10 s debounce, 120 min cron).
 * - `gastronomy` / `experience` — commerce listings edited by their own owner,
 *   who expects to see the change published. Matches `accommodation` (5 s
 *   debounce, 60 min cron).
 *
 * All four get `autoRevalidateOnChange = true`: unlike `tag` and `amenity`
 * (which are false because a catalog term appears on nearly every page, making
 * per-edit purges a blunt instrument), these four have targeted tags and a
 * bounded fan-out.
 *
 * ## Dual-write
 *
 * The same four entries were added to
 * `src/data/revalidationConfig/001-revalidation-config-defaults.json`, so a
 * fresh `db:fresh` produces this end state directly. This migration exists for
 * the already-seeded environments (staging, production), which the baseline
 * edit alone would never reach.
 *
 * ## Idempotency
 *
 * `ON CONFLICT (entity_type) DO NOTHING`. `entity_type` is UNIQUE, so a re-run
 * inserts nothing, and an operator who has since tuned one of these rows by hand
 * keeps their values — this migration only fills absences, it never overwrites.
 *
 * ## `destructive` flag decision
 *
 * `false` — inserts four rows, deletes and rewrites nothing.
 */
import { revalidationConfig } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0036-hos-369-w24-revalidation-config',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The four entity types W2-4 added to the purge chain, with the config each one
 * needs to actually purge. Mirrors the matching entries in
 * `src/data/revalidationConfig/001-revalidation-config-defaults.json` (dual-write
 * rule) — keep both sides in sync.
 *
 * The `entityType` strings must match the `EntityChangeData` union in
 * `@repo/service-core`'s `revalidation/entity-change.types.ts` EXACTLY: the
 * lookup is a literal equality check, so `pointOfInterest` written as
 * `point_of_interest` would miss and reproduce the very bug this fixes.
 */
const W24_REVALIDATION_CONFIGS = [
    {
        entityType: 'pointOfInterest',
        autoRevalidateOnChange: true,
        cronIntervalMinutes: 120,
        debounceSeconds: 10,
        enabled: true
    },
    {
        entityType: 'attraction',
        autoRevalidateOnChange: true,
        cronIntervalMinutes: 120,
        debounceSeconds: 10,
        enabled: true
    },
    {
        entityType: 'gastronomy',
        autoRevalidateOnChange: true,
        cronIntervalMinutes: 60,
        debounceSeconds: 5,
        enabled: true
    },
    {
        entityType: 'experience',
        autoRevalidateOnChange: true,
        cronIntervalMinutes: 60,
        debounceSeconds: 5,
        enabled: true
    }
] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(revalidationConfig)
        .values([...W24_REVALIDATION_CONFIGS])
        .onConflictDoNothing({ target: revalidationConfig.entityType })
        .returning({ entityType: revalidationConfig.entityType });

    const insertedTypes = inserted.map((row) => row.entityType).sort();

    return {
        summary:
            insertedTypes.length > 0
                ? `Added revalidation config for ${insertedTypes.length} entity type(s): ${insertedTypes.join(', ')}.`
                : 'No revalidation config needed adding (all four W2-4 entity types already had a row).',
        counts: {
            configsInserted: insertedTypes.length,
            configsTargeted: W24_REVALIDATION_CONFIGS.length
        }
    };
}
