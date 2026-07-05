/**
 * Featured-by-entitlement sync primitives (SPEC-292 T-004, renamed + hardened
 * SPEC-309 T-005).
 *
 * Flips `featuredByEntitlement` on accommodations. Two shapes:
 *
 * - {@link syncFeaturedByEntitlementForOwner} — bulk, ALL of an owner's
 *   non-deleted accommodations in one statement (plan-driven).
 * - {@link syncFeaturedByEntitlementForAccommodation} — single row (addon-
 *   purchase/expiry driven, G-2).
 *
 * The caller is responsible for resolving the entitlement (see
 * `featured-entitlement.resolver.ts`, T-004); these primitives are pure
 * writes with one exception each — the addon-aware guards below, which exist
 * specifically so a revoke on ONE source never clobbers a still-active grant
 * from the OTHER source (SPEC-309 H-1):
 *
 * - Owner-wide revoke (plan lapses) excludes accommodations that hold a live
 *   addon grant (H-1 consequence b — a downgrade must not clear featuring an
 *   addon still pays for).
 * - Single-accommodation revoke (addon expires) no-ops when the owner's plan
 *   still grants FEATURED_LISTING (H-1 consequence a's mirror — an addon
 *   lapsing must not clear featuring the plan still grants).
 *
 * **Layering decision — direct Drizzle update (mirrors `plan-restriction.service.ts`):**
 * The CLAUDE.md guidance ("all DB access through models extending BaseModel")
 * describes the BaseCrudService read path. For denormalized billing-flag
 * writes the established precedent (see `apps/api/src/services/plan-restriction.service.ts`,
 * SPEC-167 T-007/T-008) is a standalone function that calls `getDb()` and
 * issues a direct Drizzle `.update()` on the raw table — no model method, no
 * BaseCrudService.
 *
 * **Invariant:** ONLY `featuredByEntitlement` and `updatedAt` are written. No
 * other column (lifecycle, visibility, ownerSuspended, planRestricted,
 * deletedAt) is touched.
 *
 * **Idempotency:** calling with the same `active` value more than once is
 * safe — rows already in the target state are re-written to the same value
 * (no conditional guard needed; the `updated` count reflects the row count
 * actually matched by the WHERE clause, not a "changed" count).
 *
 * @module services/accommodation/sync-featured-by-entitlement
 */

import type { DrizzleClient } from '@repo/db';
import { accommodations, and, eq, getDb, isNull } from '@repo/db';
import { notInArray } from 'drizzle-orm';
import type { EntityChangeData } from '../../revalidation/entity-path-mapper.js';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';
import { serviceLogger } from '../../utils/service-logger';
import {
    getOwnerAccommodationIdsWithActiveFeaturedAddon,
    resolveOwnerPlanGrantsFeatured
} from './featured-entitlement.resolver.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * A row identifier returned by the sync primitives — includes `slug` so
 * revalidation callers (T-017/T-018) can address the public page without a
 * second query.
 */
export interface SyncFeaturedByEntitlementRow {
    readonly id: string;
    readonly slug: string;
}

/**
 * Result shared by both sync primitives.
 */
export interface SyncFeaturedByEntitlementResult {
    /**
     * Number of accommodation rows that were updated. Zero when no rows
     * matched the WHERE clause (including the no-op guard cases below).
     */
    readonly updated: number;
    /** The updated rows' id + slug, for revalidation callers. */
    readonly rows: readonly SyncFeaturedByEntitlementRow[];
}

// ---------------------------------------------------------------------------
// syncFeaturedByEntitlementForOwner
// ---------------------------------------------------------------------------

/**
 * Input for {@link syncFeaturedByEntitlementForOwner}.
 */
export interface SyncFeaturedByEntitlementForOwnerInput {
    /**
     * The owner whose accommodations will be updated.
     * Must be a valid UUID matching `accommodations.ownerId`.
     */
    readonly ownerId: string;
    /**
     * Target value for `featuredByEntitlement`.
     *
     * - `true` — the owner holds an active FEATURED_LISTING entitlement;
     *   all their non-deleted accommodations will appear in featured queries.
     * - `false` — the plan entitlement has lapsed or been revoked; non-deleted
     *   accommodations are cleared EXCEPT any with a live addon grant.
     */
    readonly active: boolean;
    /**
     * Optional Drizzle transaction client. When provided the update runs
     * inside the caller's existing transaction; otherwise a new statement is
     * issued on the shared singleton client returned by `getDb()`.
     */
    readonly db?: DrizzleClient;
}

/**
 * Sets `featuredByEntitlement` to `active` on non-deleted accommodations
 * owned by `ownerId` (plan-driven, owner-wide).
 *
 * When `active === false`, first resolves the owner's addon-protected
 * accommodation set ({@link getOwnerAccommodationIdsWithActiveFeaturedAddon})
 * and excludes those ids from the clear — a plan downgrade must not clear
 * featuring on an accommodation that still holds a live `visibility-boost`
 * addon grant (SPEC-309 H-1 consequence b). When `active === true`, the
 * update is unconditional — addon-protected rows are already `true`, so
 * setting them to `true` again is a no-op in effect.
 *
 * Soft-deleted rows (`deletedAt IS NOT NULL`) are silently excluded. The
 * operation is idempotent.
 *
 * @param input - Owner id, target flag value, and an optional db client.
 * @returns `{ updated, rows }` — the count and id+slug of rows written.
 */
export async function syncFeaturedByEntitlementForOwner(
    input: SyncFeaturedByEntitlementForOwnerInput
): Promise<SyncFeaturedByEntitlementResult> {
    const { ownerId, active, db: injectedDb } = input;
    const db = injectedDb ?? getDb();

    const baseConditions = [eq(accommodations.ownerId, ownerId), isNull(accommodations.deletedAt)];

    if (!active) {
        const protectedIds = await getOwnerAccommodationIdsWithActiveFeaturedAddon({ ownerId });
        if (protectedIds.length > 0) {
            baseConditions.push(notInArray(accommodations.id, protectedIds));
        }
    }

    const rows = await db
        .update(accommodations)
        .set({ featuredByEntitlement: active, updatedAt: new Date() })
        .where(and(...baseConditions))
        .returning({ id: accommodations.id, slug: accommodations.slug });

    const updated = rows.length;

    serviceLogger.info(
        { ownerId, active, updated },
        'sync-featured-by-entitlement: updated accommodations for owner'
    );

    // SPEC-309 T-017 (G-3): schedule ISR revalidation for the affected public
    // pages so the featured flag change is visible without waiting for the
    // 24h Cloudflare edge cache TTL to expire. Fire-and-forget — never
    // awaited, never blocks or fails the sync's return value.
    if (updated > 0) {
        const revalidationService = getRevalidationService();
        if (revalidationService) {
            const events: EntityChangeData[] = rows.map((row) => ({
                entityType: 'accommodation' as const,
                slug: row.slug
            }));
            revalidationService.scheduleRevalidationBatch({
                events,
                reason: `featured-by-entitlement-owner: active=${active} ownerId=${ownerId}`
            });
        }
    }

    return { updated, rows };
}

// ---------------------------------------------------------------------------
// syncFeaturedByEntitlementForAccommodation
// ---------------------------------------------------------------------------

/**
 * Input for {@link syncFeaturedByEntitlementForAccommodation}.
 */
export interface SyncFeaturedByEntitlementForAccommodationInput {
    /** The single accommodation to update. */
    readonly accommodationId: string;
    /**
     * Target value for `featuredByEntitlement`.
     *
     * - `true` — an addon purchase grants featuring for this accommodation.
     * - `false` — the addon grant expired; the write is skipped (no-op) if
     *   the owner's plan still grants FEATURED_LISTING.
     */
    readonly active: boolean;
    /** The accommodation's owner, needed for the plan-still-grants guard on revoke. */
    readonly ownerId: string;
    /** Optional Drizzle transaction client, see {@link syncFeaturedByEntitlementForOwner}. */
    readonly db?: DrizzleClient;
}

/**
 * Sets `featuredByEntitlement` to `active` on a single accommodation
 * (addon-purchase/expiry driven, G-2).
 *
 * When `active === false` (an addon grant expiring), first resolves the
 * owner's PLAN entitlement ({@link resolveOwnerPlanGrantsFeatured}); if the
 * plan still grants FEATURED_LISTING, this is a no-op (`{ updated: 0 }`)
 * instead of clearing — the addon's expiry must not clear featuring the plan
 * independently grants (SPEC-309 H-1 consequence a's mirror image).
 *
 * @param input - Accommodation id, target flag value, owner id, and an
 *   optional db client.
 * @returns `{ updated, rows }` — zero/empty when the row is soft-deleted,
 *   not found, or the plan-still-grants guard short-circuits the revoke.
 */
export async function syncFeaturedByEntitlementForAccommodation(
    input: SyncFeaturedByEntitlementForAccommodationInput
): Promise<SyncFeaturedByEntitlementResult> {
    const { accommodationId, active, ownerId, db: injectedDb } = input;
    const db = injectedDb ?? getDb();

    if (!active) {
        const planStillGrants = await resolveOwnerPlanGrantsFeatured({ ownerId });
        if (planStillGrants) {
            serviceLogger.info(
                { accommodationId, ownerId },
                'sync-featured-by-entitlement: addon-expiry clear skipped, plan still grants FEATURED_LISTING'
            );
            return { updated: 0, rows: [] };
        }
    }

    const rows = await db
        .update(accommodations)
        .set({ featuredByEntitlement: active, updatedAt: new Date() })
        .where(and(eq(accommodations.id, accommodationId), isNull(accommodations.deletedAt)))
        .returning({ id: accommodations.id, slug: accommodations.slug });

    const updated = rows.length;

    serviceLogger.info(
        { accommodationId, active, updated },
        'sync-featured-by-entitlement: updated single accommodation'
    );

    // SPEC-309 T-018 (G-3): schedule ISR revalidation so addon-driven featuring
    // changes (G-2, T-015/T-016) are reflected without waiting for TTL expiry.
    // Fire-and-forget, same pattern as T-017. A no-op write (updated === 0,
    // e.g. the plan-still-grants guard above) never schedules revalidation.
    const [row] = rows;
    if (updated > 0 && row) {
        const revalidationService = getRevalidationService();
        if (revalidationService) {
            const event: EntityChangeData = {
                entityType: 'accommodation' as const,
                slug: row.slug
            };
            revalidationService.scheduleRevalidationBatch({
                events: [event],
                reason: `featured-by-entitlement-accommodation: active=${active} accommodationId=${accommodationId}`
            });
        }
    }

    return { updated, rows };
}
