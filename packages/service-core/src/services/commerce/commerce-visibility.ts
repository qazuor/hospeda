/**
 * commerce-visibility.ts
 *
 * Visibility reconciler for commerce listing entities (SPEC-239 T-032).
 *
 * `reconcileCommerceListingVisibility` reads the `commerce_listing_subscriptions`
 * link table to find the associated entity, then flips its `visibility` and
 * `lifecycleState` based on the subscription status.
 *
 * Intentionally INDEPENDENT of the billing entitlement engine — it only reads
 * the link table and writes the listing.  No QZPay / MercadoPago calls happen
 * here.  This function is generic over `entityType` so both gastronomy and
 * future experience entities can be reconciled with the same code.
 *
 * @module commerce-visibility
 */

import type { DrizzleClient } from '@repo/db';
import { eq, getDb } from '@repo/db';
import { commerceListingSubscriptions } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { createLogger } from '@repo/logger';
import { LifecycleStatusEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import { ServiceError } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Subscription status values that indicate an active / valid subscription. */
const ACTIVE_STATUSES = new Set(['active', 'trialing'] as const);

/**
 * Inputs for {@link reconcileCommerceListingVisibility}.
 */
export interface ReconcileCommerceListingVisibilityInput {
    /**
     * Commerce entity discriminator.
     * Current values: `'gastronomy'`.  Extended without a schema change.
     */
    readonly entityType: string;
    /** UUID of the commerce entity row (gastronomies.id, etc.). */
    readonly entityId: string;
    /**
     * Current subscription status from `commerce_listing_subscriptions.status`
     * (mirroring `billing_subscriptions.status`).
     *
     * `active` / `trialing` → visible + ACTIVE lifecycle.
     * All other values → hidden + PRIVATE lifecycle.
     */
    readonly subscriptionStatus: string;
    /** Optional Drizzle transaction client to enlist this write. */
    readonly tx?: DrizzleClient;
}

/**
 * Result of a visibility reconciliation.
 */
export interface ReconcileCommerceListingVisibilityResult {
    /** Whether the listing was updated (false = already in the correct state). */
    readonly updated: boolean;
    /** The final visibility value written to the entity row. */
    readonly visibility: VisibilityEnum;
    /** The final lifecycle state written to the entity row. */
    readonly lifecycleState: LifecycleStatusEnum;
}

/**
 * Minimal update-capable model for a commerce entity.
 * The concrete service injects its own model which must satisfy this interface.
 *
 * Note: `update` takes a `where` record (matching BaseModel.update signature),
 * not a bare ID string.  Call with `{ id: entityId }` as the first argument.
 */
export interface CommerceEntityModel {
    findById: (
        id: string,
        tx?: DrizzleClient
    ) => Promise<{ id: string; visibility: string; lifecycleState: string } | null>;
    update: (
        where: Record<string, unknown>,
        data: Partial<{ visibility: string; lifecycleState: string }>,
        tx?: DrizzleClient
    ) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const logger: ILogger = createLogger('commerce-visibility');

/**
 * Reconciles a commerce listing's `visibility` and `lifecycleState` against the
 * current billing subscription status.
 *
 * **Transition table:**
 * | subscriptionStatus  | visibility | lifecycleState |
 * |---------------------|-----------|----------------|
 * | `active` / `trialing` | `PUBLIC`  | `ACTIVE`       |
 * | anything else         | `PRIVATE` | `INACTIVE`     |
 *
 * The function:
 * 1. Looks up the entity via the injected model (`findById`).
 * 2. Computes the desired `visibility` and `lifecycleState` from `subscriptionStatus`.
 * 3. Writes only when the current state differs (idempotent).
 * 4. Returns a typed result describing what happened.
 *
 * It is intentionally decoupled from the entitlement engine — callers should
 * invoke this from billing webhook handlers or cron jobs, never from inside a
 * user-facing request context.
 *
 * @param input - {@link ReconcileCommerceListingVisibilityInput}
 * @param model - Entity model that implements `findById` and `update`.
 * @returns {@link ReconcileCommerceListingVisibilityResult}
 * @throws {ServiceError} NOT_FOUND when the entity does not exist.
 *
 * @example
 * ```ts
 * // Called from a billing webhook handler after a subscription activates:
 * const result = await reconcileCommerceListingVisibility(
 *   { entityType: 'gastronomy', entityId, subscriptionStatus: 'active' },
 *   gastronomyModel,
 * );
 * if (result.updated) {
 *   logger.info('Gastronomy visibility reconciled', { entityId, ...result });
 * }
 * ```
 */
export async function reconcileCommerceListingVisibility(
    input: ReconcileCommerceListingVisibilityInput,
    model: CommerceEntityModel
): Promise<ReconcileCommerceListingVisibilityResult> {
    const { entityType, entityId, subscriptionStatus, tx } = input;

    // Determine the desired state based on subscription status.
    const isActive = ACTIVE_STATUSES.has(subscriptionStatus as 'active' | 'trialing');
    const desiredVisibility: VisibilityEnum = isActive
        ? VisibilityEnum.PUBLIC
        : VisibilityEnum.PRIVATE;
    const desiredLifecycleState: LifecycleStatusEnum = isActive
        ? LifecycleStatusEnum.ACTIVE
        : LifecycleStatusEnum.INACTIVE;

    // Fetch the entity.
    const entity = await model.findById(entityId, tx);
    if (!entity) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Commerce entity not found: entityType=${entityType} entityId=${entityId}`
        );
    }

    // If already in the correct state, skip the write (idempotent).
    if (
        entity.visibility === desiredVisibility &&
        entity.lifecycleState === desiredLifecycleState
    ) {
        return {
            updated: false,
            visibility: desiredVisibility,
            lifecycleState: desiredLifecycleState
        };
    }

    // Write the reconciled state.
    // Pass `{ id: entityId }` as the where clause to match BaseModel.update's
    // signature (Record<string, unknown>), not a bare string.
    await model.update(
        { id: entityId },
        { visibility: desiredVisibility, lifecycleState: desiredLifecycleState },
        tx
    );

    logger.info(
        {
            entityType,
            entityId,
            subscriptionStatus,
            visibility: desiredVisibility,
            lifecycleState: desiredLifecycleState
        },
        'Commerce listing visibility reconciled'
    );

    return { updated: true, visibility: desiredVisibility, lifecycleState: desiredLifecycleState };
}

// ---------------------------------------------------------------------------
// Lookup helper (reads the link table)
// ---------------------------------------------------------------------------

/**
 * Resolves a commerce entity's current subscription status from the
 * `commerce_listing_subscriptions` link table.
 *
 * Returns `null` when no link row exists for the given entity.  This is a
 * pure read with no side effects and is suitable for use in scheduled jobs
 * that need to reconcile all active entities.
 *
 * @param input - Entity discriminator.
 * @param tx - Optional transaction client.
 * @returns The subscription status string, or `null` when no link row exists.
 */
export async function getCommerceListingSubscriptionStatus(
    input: { entityType: string; entityId: string },
    tx?: DrizzleClient
): Promise<string | null> {
    const db = tx ?? getDb();
    const rows = await db
        .select({ status: commerceListingSubscriptions.status })
        .from(commerceListingSubscriptions)
        .where(eq(commerceListingSubscriptions.entityId, input.entityId))
        .limit(1);

    const row = rows[0];
    return row !== undefined ? row.status : null;
}
