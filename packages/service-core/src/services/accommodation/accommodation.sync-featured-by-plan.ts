/**
 * Featured-by-plan bulk sync primitive (SPEC-292 T-004).
 *
 * Flips `featuredByPlan` in bulk on ALL of an owner's non-deleted
 * accommodations in one DB statement. Consumed by the billing event wiring
 * (T-005) and the reconciliation cron (T-006). The caller is responsible for
 * resolving the entitlement; this primitive is a pure write with no
 * entitlement logic of its own.
 *
 * **Layering decision — direct Drizzle update (mirrors `plan-restriction.service.ts`):**
 * The CLAUDE.md guidance ("all DB access through models extending BaseModel")
 * describes the BaseCrudService read path. For denormalized billing-flag bulk
 * writes the established precedent (see `apps/api/src/services/plan-restriction.service.ts`,
 * SPEC-167 T-007/T-008) is a standalone function that calls `getDb()` and
 * issues a direct Drizzle `.update()` on the raw table — no model method, no
 * BaseCrudService. That service writes `planRestricted` across a set of IDs;
 * this module applies the same pattern owner-wide for `featuredByPlan`.
 *
 * **Invariant:** ONLY `featuredByPlan` and `updatedAt` are written. No other
 * column (lifecycle, visibility, ownerSuspended, planRestricted, deletedAt)
 * is touched.
 *
 * **Idempotency:** calling with the same `active` value more than once is safe
 * — rows already in the target state are re-written to the same value (no
 * conditional guard needed; the `updated` count reflects the row count, not a
 * "changed" count).
 *
 * @module services/accommodation/sync-featured-by-plan
 */

import { accommodations, and, eq, getDb, isNull } from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { serviceLogger } from '../../utils/service-logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input for {@link syncFeaturedByPlan}.
 */
export interface SyncFeaturedByPlanInput {
    /**
     * The owner whose accommodations will be updated.
     * Must be a valid UUID matching `accommodations.ownerId`.
     */
    readonly ownerId: string;
    /**
     * Target value for `featuredByPlan`.
     *
     * - `true` — the owner holds an active FEATURED_LISTING entitlement;
     *   all their non-deleted accommodations will appear in featured queries.
     * - `false` — the entitlement has lapsed or been revoked; all non-deleted
     *   accommodations will be excluded from featured queries.
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
 * Result returned by {@link syncFeaturedByPlan}.
 */
export interface SyncFeaturedByPlanResult {
    /**
     * Number of accommodation rows that were updated.
     * Zero when the owner has no non-deleted accommodations. Can be used by
     * the caller for observability / logging enrichment.
     */
    readonly updated: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Sets `featuredByPlan` to `active` on ALL non-deleted accommodations owned
 * by `ownerId`.
 *
 * Soft-deleted rows (`deletedAt IS NOT NULL`) are silently excluded — they
 * are never matched by the `WHERE` clause and will not appear in `updated`.
 *
 * Only `featuredByPlan` and `updatedAt` are written. All other columns are
 * left untouched. The operation is idempotent; multiple calls with the same
 * `active` value produce the same final state.
 *
 * @param input - Owner id, target flag value, and an optional db client.
 * @returns `{ updated }` — the number of rows written (zero for owners with
 *   no non-deleted accommodations).
 *
 * @example
 * ```ts
 * // Grant featured status on billing entitlement activation:
 * const { updated } = await syncFeaturedByPlan({ ownerId: 'uuid-...', active: true });
 *
 * // Revoke featured status on entitlement lapse:
 * const { updated } = await syncFeaturedByPlan({ ownerId: 'uuid-...', active: false });
 *
 * // Run inside a caller-managed transaction:
 * await withTransaction(async (tx) => {
 *   await syncFeaturedByPlan({ ownerId, active, db: tx });
 * });
 * ```
 */
export async function syncFeaturedByPlan(
    input: SyncFeaturedByPlanInput
): Promise<SyncFeaturedByPlanResult> {
    const { ownerId, active, db: injectedDb } = input;
    const db = injectedDb ?? getDb();

    const rows = await db
        .update(accommodations)
        .set({ featuredByPlan: active, updatedAt: new Date() })
        .where(and(eq(accommodations.ownerId, ownerId), isNull(accommodations.deletedAt)))
        .returning({ id: accommodations.id });

    const updated = rows.length;

    serviceLogger.info(
        { ownerId, active, updated },
        'sync-featured-by-plan: updated accommodations'
    );

    return { updated };
}
