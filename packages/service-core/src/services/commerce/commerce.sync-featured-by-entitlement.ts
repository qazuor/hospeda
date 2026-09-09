/**
 * Featured-by-entitlement sync primitive for the commerce verticals (HOS-1286).
 *
 * The commerce counterpart of
 * `accommodation.sync-featured-by-entitlement.ts`. It flips
 * `featuredByEntitlement` on ONE gastronomy or experience listing.
 *
 * ---
 * ## Why there is one primitive here and two on the accommodation side
 *
 * Accommodation featuring has TWO independent sources — the owner's plan, which
 * grants it owner-wide, and an add-on, which grants it per listing — so it needs
 * a bulk owner-wide write AND a single-row write, each guarding against
 * clobbering the other source (SPEC-309 H-1).
 *
 * Commerce has ONE source. No commerce plan grants `FEATURED_LISTING`:
 * `COMMERCE_ENTITLEMENTS` (`commerce-entitlements.config.ts`) grants
 * EDIT/PUBLISH/VIEW_BASIC_STATS per vertical and nothing else, and every
 * `FEATURED_LISTING` in `plans.config.ts` sits on an accommodation plan. So
 * there is no owner-wide grant to bulk-write and no second source to guard
 * against on revoke — the add-on's grant is the whole truth, and a revoke is
 * unconditional.
 *
 * **That asymmetry is a fact about today's catalogue, not a design choice**, and
 * it is the one thing to re-check before adding a commerce plan that grants
 * featuring: such a plan would need a plan-driven half here plus the
 * still-granted guard on revoke, exactly as accommodation has. Nothing is
 * stubbed for it, because a stub that no code path can reach reads as coverage
 * and is not.
 *
 * ## Layering
 *
 * Direct Drizzle `.update()` via `getDb()`, mirroring the accommodation twin and
 * `plan-restriction.service.ts` — the established precedent for denormalized
 * billing-flag writes. **Invariant:** only `featuredByEntitlement` and
 * `updatedAt` are written; no lifecycle, visibility, moderation or delete column
 * is touched.
 *
 * @module services/commerce/commerce.sync-featured-by-entitlement
 */

import type { DrizzleClient } from '@repo/db';
import { and, eq, experiences, gastronomies, getDb, isNull } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { serviceLogger } from '../../utils/service-logger';
import {
    resolveCommerceDestinationSlug,
    scheduleCommerceListingRevalidation,
    standaloneCommerceRevalidationLogger
} from './commerce-revalidation.js';

/** The two commerce verticals this primitive writes. */
export type CommerceFeaturedEntityType =
    | typeof ProductDomainEnum.GASTRONOMY
    | typeof ProductDomainEnum.EXPERIENCE;

/**
 * The listing table each commerce vertical writes to.
 *
 * A lookup rather than an `if`/`switch` so a third commerce vertical is a
 * one-line addition that the type system forces the caller to handle, instead
 * of an `else` branch that silently writes the wrong table.
 */
const COMMERCE_FEATURED_TABLES = {
    [ProductDomainEnum.GASTRONOMY]: gastronomies,
    [ProductDomainEnum.EXPERIENCE]: experiences
} as const;

/** A row written by {@link syncFeaturedByEntitlementForCommerceListing}. */
export interface SyncCommerceFeaturedRow {
    readonly id: string;
    readonly slug: string;
    readonly destinationId: string | null;
    readonly lifecycleState: string | null;
    readonly visibility: string | null;
}

/** Result of {@link syncFeaturedByEntitlementForCommerceListing}. */
export interface SyncCommerceFeaturedResult {
    /** Rows updated — 0 when the listing is missing or soft-deleted. */
    readonly updated: number;
    /** The updated row, for revalidation callers. */
    readonly rows: readonly SyncCommerceFeaturedRow[];
}

/** Input for {@link syncFeaturedByEntitlementForCommerceListing}. */
export interface SyncFeaturedByEntitlementForCommerceListingInput {
    /** Which commerce vertical {@link entityId} belongs to. */
    readonly entityType: CommerceFeaturedEntityType;
    /** The listing to update. */
    readonly entityId: string;
    /**
     * Target value.
     *
     * - `true` — an add-on purchase grants featuring for this listing.
     * - `false` — the grant expired or was cancelled. Unconditional: unlike the
     *   accommodation twin there is no plan-still-grants guard, because no
     *   commerce plan grants FEATURED_LISTING. See the module docblock.
     */
    readonly active: boolean;
    /** Optional Drizzle transaction client; defaults to the shared singleton. */
    readonly db?: DrizzleClient;
}

/**
 * Sets `featuredByEntitlement` on ONE commerce listing.
 *
 * Soft-deleted rows are silently excluded. Idempotent: writing the same value
 * twice is safe, and `updated` reflects rows MATCHED, not rows changed — the
 * same contract the accommodation primitives document.
 *
 * @param input - Vertical, listing id, target value, optional db client.
 * @returns `{ updated, rows }`; `updated` is 0 when the listing does not exist
 *   or is soft-deleted.
 */
export async function syncFeaturedByEntitlementForCommerceListing(
    input: SyncFeaturedByEntitlementForCommerceListingInput
): Promise<SyncCommerceFeaturedResult> {
    const { entityType, entityId, active, db: injectedDb } = input;
    const db = injectedDb ?? getDb();
    const table = COMMERCE_FEATURED_TABLES[entityType];

    const rows = await db
        .update(table)
        .set({ featuredByEntitlement: active, updatedAt: new Date() })
        .where(and(eq(table.id, entityId), isNull(table.deletedAt)))
        .returning({
            id: table.id,
            slug: table.slug,
            destinationId: table.destinationId,
            lifecycleState: table.lifecycleState,
            visibility: table.visibility
        });

    const updated = rows.length;

    serviceLogger.info(
        { entityType, entityId, active, updated },
        'sync-featured-by-entitlement: updated commerce listing'
    );

    // Purge the public detail page so a paid boost shows up without waiting for
    // the edge TTL — the same G-3 obligation the accommodation primitives carry.
    // Fire-and-forget: never awaited into the return value, never able to fail
    // the write. `scheduleCommerceListingRevalidation` already no-ops on a
    // listing that is not publicly visible.
    const [row] = rows;
    if (updated > 0 && row) {
        void scheduleCommerceListingRevalidation({
            entityType,
            entity: row,
            resolveDestinationSlug: resolveCommerceDestinationSlug,
            logger: standaloneCommerceRevalidationLogger
        });
    }

    return { updated, rows };
}
