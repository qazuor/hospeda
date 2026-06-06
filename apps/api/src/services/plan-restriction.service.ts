/**
 * Plan Restriction Primitives (SPEC-167 T-007 / T-008).
 *
 * Write primitives for the downgrade remediation restriction flow. These
 * functions flip the `planRestricted` boolean on accommodations and owner
 * promotions reversibly without touching any other field (INV-5: no lifecycle,
 * no ownerSuspended, no deletedAt). They are the building blocks called by the
 * shared restriction coordinator (T-011).
 *
 * **Semantic choice — set-based idempotent:**
 * `affectedIds` returns ALL requested ids that now hold the target state after
 * the operation, regardless of whether they were already in that state before
 * the call. This makes the functions safe for idempotent re-runs (T-011
 * idempotency requirement): calling `restrictAccommodations({ ids: ['A','B'] })`
 * twice returns `{ affectedIds: ['A','B'] }` both times.
 *
 * **INV-5 guarantee:**
 * The update payload is EXACTLY `{ planRestricted: <bool>, updatedAt: new Date() }`.
 * No other column is written. Lifecycle, ownerSuspended, deletedAt, and all
 * other fields are untouched. Tests assert the payload shape.
 *
 * **Empty ids:**
 * An empty `ids` array is a documented no-op: no DB query is issued and the
 * return value is `{ affectedIds: [] }`.
 *
 * @module services/plan-restriction
 */

import { type DrizzleClient, accommodations, getDb, ownerPromotions } from '@repo/db';
import { and, inArray, isNull } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Accommodation primitives (T-007)
// ---------------------------------------------------------------------------

/**
 * Input for {@link restrictAccommodations}.
 */
export interface RestrictAccommodationsInput {
    /** IDs of accommodations to set `planRestricted = true`. */
    readonly ids: readonly string[];
    /** Optional Drizzle transaction client for transactional callers. */
    readonly db?: DrizzleClient;
}

/**
 * Output shared by all four primitives in this module.
 */
export interface PlanRestrictionResult {
    /**
     * IDs that now hold the target `planRestricted` state. Set-based
     * semantic: includes ids that were already in the target state before
     * the call (idempotent). Empty when the input `ids` array is empty.
     */
    readonly affectedIds: readonly string[];
}

/**
 * Sets `planRestricted = true` on the given accommodations.
 *
 * Only non-deleted accommodations are matched (`deletedAt IS NULL`). Soft-
 * deleted rows are silently excluded; they do not appear in `affectedIds`.
 *
 * INV-5: ONLY `planRestricted` and `updatedAt` are written. No lifecycle,
 * ownerSuspended, or other field is touched.
 *
 * @param input - The accommodation ids to restrict and an optional db client.
 * @returns The ids that now hold `planRestricted = true`.
 */
export async function restrictAccommodations(
    input: RestrictAccommodationsInput
): Promise<PlanRestrictionResult> {
    if (input.ids.length === 0) {
        return { affectedIds: [] };
    }

    const db = input.db ?? getDb();

    const updated = await db
        .update(accommodations)
        .set({ planRestricted: true, updatedAt: new Date() })
        .where(
            and(inArray(accommodations.id, input.ids as string[]), isNull(accommodations.deletedAt))
        )
        .returning({ id: accommodations.id });

    const affectedIds = updated.map((r) => r.id);

    apiLogger.info(
        { requestedCount: input.ids.length, affectedCount: affectedIds.length },
        'plan-restriction: restricted accommodations'
    );

    return { affectedIds };
}

/**
 * Input for {@link restoreAccommodations}.
 */
export interface RestoreAccommodationsInput {
    /** IDs of accommodations to set `planRestricted = false`. */
    readonly ids: readonly string[];
    /** Optional Drizzle transaction client for transactional callers. */
    readonly db?: DrizzleClient;
}

/**
 * Sets `planRestricted = false` on the given accommodations (restore).
 *
 * Only non-deleted accommodations are matched (`deletedAt IS NULL`). Soft-
 * deleted rows are silently excluded; they do not appear in `affectedIds`.
 *
 * INV-5: ONLY `planRestricted` and `updatedAt` are written. No lifecycle,
 * ownerSuspended, or other field is touched.
 *
 * @param input - The accommodation ids to restore and an optional db client.
 * @returns The ids that now hold `planRestricted = false`.
 */
export async function restoreAccommodations(
    input: RestoreAccommodationsInput
): Promise<PlanRestrictionResult> {
    if (input.ids.length === 0) {
        return { affectedIds: [] };
    }

    const db = input.db ?? getDb();

    const updated = await db
        .update(accommodations)
        .set({ planRestricted: false, updatedAt: new Date() })
        .where(
            and(inArray(accommodations.id, input.ids as string[]), isNull(accommodations.deletedAt))
        )
        .returning({ id: accommodations.id });

    const affectedIds = updated.map((r) => r.id);

    apiLogger.info(
        { requestedCount: input.ids.length, affectedCount: affectedIds.length },
        'plan-restriction: restored accommodations'
    );

    return { affectedIds };
}

// ---------------------------------------------------------------------------
// Owner promotion primitives (T-008)
// ---------------------------------------------------------------------------

/**
 * Input for {@link restrictPromotions}.
 */
export interface RestrictPromotionsInput {
    /** IDs of owner promotions to set `planRestricted = true`. */
    readonly ids: readonly string[];
    /** Optional Drizzle transaction client for transactional callers. */
    readonly db?: DrizzleClient;
}

/**
 * Sets `planRestricted = true` on the given owner promotions.
 *
 * **Lifecycle is NOT touched.** The `planRestricted` flag alone excludes the
 * promotion from active counts and public reads (T-004). Keeping `lifecycleState`
 * intact preserves the 'restricted-by-plan' context needed for selective restore
 * on re-upgrade: a lifecycle flip loses that context and would not be reversibly
 * distinguishable from a host-initiated deactivation.
 *
 * Only non-deleted promotions are matched (`deletedAt IS NULL`). Soft-deleted
 * rows are silently excluded.
 *
 * INV-5: ONLY `planRestricted` and `updatedAt` are written. No lifecycleState
 * or other field is touched.
 *
 * @param input - The promotion ids to restrict and an optional db client.
 * @returns The ids that now hold `planRestricted = true`.
 */
export async function restrictPromotions(
    input: RestrictPromotionsInput
): Promise<PlanRestrictionResult> {
    if (input.ids.length === 0) {
        return { affectedIds: [] };
    }

    const db = input.db ?? getDb();

    const updated = await db
        .update(ownerPromotions)
        .set({ planRestricted: true, updatedAt: new Date() })
        .where(
            and(
                inArray(ownerPromotions.id, input.ids as string[]),
                isNull(ownerPromotions.deletedAt)
            )
        )
        .returning({ id: ownerPromotions.id });

    const affectedIds = updated.map((r) => r.id);

    apiLogger.info(
        { requestedCount: input.ids.length, affectedCount: affectedIds.length },
        'plan-restriction: restricted promotions'
    );

    return { affectedIds };
}

/**
 * Input for {@link restorePromotions}.
 */
export interface RestorePromotionsInput {
    /** IDs of owner promotions to set `planRestricted = false`. */
    readonly ids: readonly string[];
    /** Optional Drizzle transaction client for transactional callers. */
    readonly db?: DrizzleClient;
}

/**
 * Sets `planRestricted = false` on the given owner promotions (restore).
 *
 * Lifecycle stays untouched. The promotion returns to being counted as active
 * and visible in public reads simply by clearing the flag (T-004).
 *
 * Only non-deleted promotions are matched (`deletedAt IS NULL`). Soft-deleted
 * rows are silently excluded.
 *
 * INV-5: ONLY `planRestricted` and `updatedAt` are written. No lifecycleState
 * or other field is touched.
 *
 * @param input - The promotion ids to restore and an optional db client.
 * @returns The ids that now hold `planRestricted = false`.
 */
export async function restorePromotions(
    input: RestorePromotionsInput
): Promise<PlanRestrictionResult> {
    if (input.ids.length === 0) {
        return { affectedIds: [] };
    }

    const db = input.db ?? getDb();

    const updated = await db
        .update(ownerPromotions)
        .set({ planRestricted: false, updatedAt: new Date() })
        .where(
            and(
                inArray(ownerPromotions.id, input.ids as string[]),
                isNull(ownerPromotions.deletedAt)
            )
        )
        .returning({ id: ownerPromotions.id });

    const affectedIds = updated.map((r) => r.id);

    apiLogger.info(
        { requestedCount: input.ids.length, affectedCount: affectedIds.length },
        'plan-restriction: restored promotions'
    );

    return { affectedIds };
}
