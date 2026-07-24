/**
 * @fileoverview
 * Data migration: 0024-restore-example-data-nonprod
 *
 * Undo counterpart to {@link file://./0023-soft-delete-example-data.ts} for
 * NON-production environments (Linear HOS-261).
 *
 * ## Why this exists
 *
 * `0023-soft-delete-example-data` was merged and applied to STAGING (PR #2473)
 * *before* its production-only gate was added (that gate lands separately in
 * PR #2477). Because 0023 was un-gated at apply time, it soft-deleted staging's
 * `example` demo dataset — but staging (like local) is a development
 * environment where that demo data MUST stay live for testing/demos. 0023 is
 * already recorded in staging's `seed_migrations` ledger, so it will not re-run
 * and cannot be un-applied by re-running it; this migration performs the
 * explicit inverse instead.
 *
 * ## What it does
 *
 * On non-production environments it clears `deletedAt`/`deletedById` back to
 * `null` for exactly the deterministic `example` accommodation/post/event ids
 * that 0023 targets (recomputed by {@link computeFakeExampleIds} — never a
 * name/slug pattern match), bringing every soft-deleted demo row back to the
 * live state it had before 0023 ran. It is the mechanical reverse of 0023's
 * `set({ deletedAt, deletedById })` on the same id set.
 *
 * ## Production-only INVERSION of 0023's gate
 *
 * 0023 runs in production and no-ops elsewhere; this migration is the mirror:
 * it no-ops in PRODUCTION and runs everywhere else. Production must KEEP the
 * Phase-1 soft-delete (it is the 410/desindex signal), so restoring the example
 * data there would defeat the entire cleanup. `hops db-seed-migrate` injects
 * `NODE_ENV=production` only for `--target=prod`, so the guard below skips prod
 * and runs on staging/local. The skip is still ledgered (a returned result
 * marks it applied), so a later `db:seed:migrate` on prod for an unrelated
 * migration never re-triggers this one. Ordering (0023 before 0024) means that
 * even on a hypothetical fresh production seed the net effect is "soft-deleted"
 * — 0023 deletes, 0024 skips.
 *
 * ## Idempotency
 *
 * Each `UPDATE` is guarded with `AND deletedAt IS NOT NULL`, so it only touches
 * rows that are still soft-deleted. A steady-state re-run (or a fresh local
 * where the demo data was never soft-deleted in the first place) matches 0 rows
 * and the `.returning()` count drops to 0 — a clean no-op. It also never clears
 * `deletedAt` on a row that is live, and never reaches outside the `example`
 * id set, so it cannot resurrect an unrelated legitimately-deleted row.
 *
 * ## Not destructive
 *
 * Unlike 0023 (`destructive: true` — it removes demo rows from public view in
 * prod), this migration only ever RESTORES rows and only ever runs in
 * non-production, so it carries no destructive opt-in requirement.
 */
import { accommodations, and, events, inArray, isNotNull, posts } from '@repo/db';
import { computeFakeExampleIds } from './example-fixture-ids.helpers.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0024-restore-example-data-nonprod',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // Production-only inversion of 0023's gate: prod must KEEP the Phase-1
    // soft-delete (the 410/desindex signal), so restoring the example data there
    // would undo the cleanup. Staging and local (NODE_ENV !== 'production') are
    // development environments where the demo data must stay live, so this is
    // where the restore actually runs. Still ledgered on prod (skip returns a
    // result) so unrelated later migrations never re-trigger it. See HOS-261.
    if (process.env.NODE_ENV === 'production') {
        return {
            summary:
                'Skipped: example-data restore runs outside production only ' +
                '(production keeps the Phase-1 soft-delete / 410 signal).',
            counts: { skipped: 1 }
        };
    }

    const { accommodationIds, postIds, eventIds } = computeFakeExampleIds();
    const now = new Date();

    let accommodationsRestored = 0;
    if (accommodationIds.length > 0) {
        const updated = await ctx.db
            .update(accommodations)
            .set({ deletedAt: null, deletedById: null, updatedAt: now })
            .where(
                and(
                    inArray(accommodations.id, [...accommodationIds]),
                    isNotNull(accommodations.deletedAt)
                )
            )
            .returning({ id: accommodations.id });
        accommodationsRestored = updated.length;
    }

    let postsRestored = 0;
    if (postIds.length > 0) {
        const updated = await ctx.db
            .update(posts)
            .set({ deletedAt: null, deletedById: null, updatedAt: now })
            .where(and(inArray(posts.id, [...postIds]), isNotNull(posts.deletedAt)))
            .returning({ id: posts.id });
        postsRestored = updated.length;
    }

    let eventsRestored = 0;
    if (eventIds.length > 0) {
        const updated = await ctx.db
            .update(events)
            .set({ deletedAt: null, deletedById: null, updatedAt: now })
            .where(and(inArray(events.id, [...eventIds]), isNotNull(events.deletedAt)))
            .returning({ id: events.id });
        eventsRestored = updated.length;
    }

    return {
        summary:
            `HOS-261 non-prod restore: ${accommodationsRestored} accommodation(s), ` +
            `${postsRestored} post(s), ${eventsRestored} event(s) restored ` +
            '(reverts the un-gated 0023 soft-delete on staging/local).',
        counts: {
            accommodationsRestored,
            postsRestored,
            eventsRestored
        }
    };
}
