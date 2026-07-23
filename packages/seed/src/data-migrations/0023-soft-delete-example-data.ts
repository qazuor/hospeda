/**
 * @fileoverview
 * Data migration: 0023-soft-delete-example-data
 *
 * Phase 1 of a 2-phase production cleanup (Linear HOS-261) of the fake
 * `example` seed content that has been live on production since launch.
 * That content has real, indexed PUBLIC URLs (`/alojamientos/:slug`,
 * `/blog/:slug`, `/eventos/:slug`) that Google has crawled, so it cannot
 * simply be hard-deleted in one step — a suddenly-404ing URL that used to
 * 200 is exactly the signal that keeps a stale page lingering in search
 * results instead of being dropped.
 *
 * This migration only SOFT-deletes (`deletedAt` + `deletedById`), which
 * (per this codebase's soft-delete convention — see `packages/db/CLAUDE.md`)
 * makes every read path that filters on `deletedAt IS NULL` stop returning
 * the row, so the public detail routes for these entities start responding
 * HTTP 410 Gone instead of 200 — the correct signal for Google to actually
 * desindex a URL (a bare 404 is treated as possibly-transient; 410 is not).
 * Phase 2 (separate, later, once search-console confirms desindexing) will
 * hard-delete these same rows for good.
 *
 * Scope is deliberately narrow: ONLY the three entity types that have a
 * public, indexable URL — accommodations, `posts` (blog content, NOT
 * `social_posts`), and events. `users`, `reviews`, event organizers/
 * locations, and everything else the `example` seed also creates are left
 * untouched by Phase 1 (event organizers/locations have no public URL of
 * their own; they only ever render nested inside an event's page, which is
 * itself gone once the event is soft-deleted).
 *
 * Target ids are the exact deterministic UUIDv5 ids the `example` seed
 * assigned, recomputed by {@link computeFakeExampleIds} (colocated
 * `example-fixture-ids.helpers.ts`, copied from the Phase 2 migration's
 * helper in `hospeda-purge-seed-example-data`) — never a name/slug pattern
 * match, so this can never accidentally reach a real host's content.
 *
 * ## Idempotency
 *
 * Each `UPDATE` is guarded with `AND deletedAt IS NULL`, so re-running this
 * migration only touches rows that are still live — an already
 * soft-deleted row (this migration's own prior run, or an unrelated earlier
 * soft-delete) is simply not matched again, and the `.returning()` count
 * naturally drops to 0 on a steady-state re-run.
 *
 * ## Reversibility
 *
 * Fully reversible: clearing `deletedAt`/`deletedById` back to `null` (a
 * manual `UPDATE` or the model's `restore()`) brings every row back exactly
 * as it was — this migration performs a pure status change, no data is
 * dropped. That reversibility is also why `destructive: true` here still
 * only requires the production opt-in gate rather than something stronger:
 * it is a bulk, irreversible-by-DEFAULT (no automatic restore) state change
 * on production rows, the same bar `0007`/`0010`/`0018` use for their own
 * soft/hard deletes.
 */
import { accommodations, and, events, inArray, isNull, posts } from '@repo/db';
import { computeFakeExampleIds } from './example-fixture-ids.helpers.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0023-soft-delete-example-data',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // Production-only gate: this purge exists to clean the fake demo dataset from
    // PRODUCTION. Staging and local are development environments
    // (NODE_ENV !== 'production', per `hops db-seed-migrate` which injects
    // NODE_ENV=production only for --target=prod) where the example data must stay
    // for testing/demos, so this migration is a deliberate no-op there. It is still
    // recorded in the ledger (returning a result marks it applied), so a later
    // `db:seed:migrate` on staging/local for an UNRELATED migration never
    // re-triggers this one and the demo data survives. See HOS-261.
    if (process.env.NODE_ENV !== 'production') {
        return {
            summary:
                'Skipped: example-data soft-delete runs in production only ' +
                '(staging/local keep the demo data).',
            counts: { skipped: 1 }
        };
    }

    const { accommodationIds, postIds, eventIds } = computeFakeExampleIds();
    const now = new Date();
    const deletedById = ctx.actor.id;

    let accommodationsSoftDeleted = 0;
    if (accommodationIds.length > 0) {
        const updated = await ctx.db
            .update(accommodations)
            .set({ deletedAt: now, deletedById, updatedAt: now })
            .where(
                and(
                    inArray(accommodations.id, [...accommodationIds]),
                    isNull(accommodations.deletedAt)
                )
            )
            .returning({ id: accommodations.id });
        accommodationsSoftDeleted = updated.length;
    }

    let postsSoftDeleted = 0;
    if (postIds.length > 0) {
        const updated = await ctx.db
            .update(posts)
            .set({ deletedAt: now, deletedById, updatedAt: now })
            .where(and(inArray(posts.id, [...postIds]), isNull(posts.deletedAt)))
            .returning({ id: posts.id });
        postsSoftDeleted = updated.length;
    }

    let eventsSoftDeleted = 0;
    if (eventIds.length > 0) {
        const updated = await ctx.db
            .update(events)
            .set({ deletedAt: now, deletedById, updatedAt: now })
            .where(and(inArray(events.id, [...eventIds]), isNull(events.deletedAt)))
            .returning({ id: events.id });
        eventsSoftDeleted = updated.length;
    }

    return {
        summary:
            `HOS-261 Phase 1 soft-delete: ${accommodationsSoftDeleted} accommodation(s), ` +
            `${postsSoftDeleted} post(s), ${eventsSoftDeleted} event(s) soft-deleted ` +
            '(public URLs now 410).',
        counts: {
            accommodationsSoftDeleted,
            postsSoftDeleted,
            eventsSoftDeleted
        }
    };
}
