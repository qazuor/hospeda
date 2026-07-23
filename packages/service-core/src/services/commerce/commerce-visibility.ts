/**
 * commerce-visibility.ts
 *
 * Visibility reconciler for commerce listing entities (SPEC-239 T-032,
 * predicate widened HOS-166 §6.5).
 *
 * `reconcileCommerceListingVisibility` reads the `commerce_listing_subscriptions`
 * link table to find the associated entity, then flips its `visibility` and
 * `lifecycleState` based on the subscription status **and** (HOS-166 G-3) the
 * listing's publish-readiness ("complete") and moderation state:
 *
 * ```
 * shouldBePublic = subscriptionActive AND listingComplete AND NOT moderationRejected
 * ```
 *
 * This is the LAST line of defense against a paid-but-empty listing reaching
 * the public site (spec §6.5) — the completeness gate on the owner checkout
 * route (§6.3) makes that hard, but this reconciler also fires from the
 * dunning cron and finalize-cancelled-subs, independent of the checkout path.
 *
 * Intentionally INDEPENDENT of the billing entitlement engine — it only reads
 * the link table and writes the listing.  No QZPay / MercadoPago calls happen
 * here.  This function is generic over `entityType` so both gastronomy and
 * experience entities are reconciled with the same code.
 *
 * @module commerce-visibility
 */

import type { DrizzleClient } from '@repo/db';
import { and, commerceListingSubscriptions, eq, getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { createLogger } from '@repo/logger';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
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
 *
 * `moderationState` is included (HOS-166 §6.5) because the reconciler's
 * predicate reads it directly off the same row it already fetches for
 * `visibility`/`lifecycleState` — it is plain data already present on every
 * commerce entity (`...BaseModerationFields`), not a computed value, so
 * widening this narrow read-only field costs every implementer nothing.
 * Contrast with completeness (see {@link ResolveCommerceListingCompleteness}),
 * which is business logic and stays a SEPARATE injected resolver on purpose.
 */
export interface CommerceEntityModel {
    findById: (
        id: string,
        tx?: DrizzleClient
    ) => Promise<{
        id: string;
        visibility: string;
        lifecycleState: string;
        moderationState?: string | null;
    } | null>;
    update: (
        where: Record<string, unknown>,
        data: Partial<{ visibility: string; lifecycleState: string }>,
        tx?: DrizzleClient
    ) => Promise<unknown>;
}

/**
 * Resolves a commerce listing's publish-readiness ("complete") for the
 * reconciler's predicate (HOS-166 §6.5). Injected alongside the model rather
 * than folded into `CommerceEntityModel.findById`'s return shape — completeness
 * is business logic derived from `resolveListingCompleteness`, and forcing
 * every `CommerceEntityModel` implementer to compute it inline would widen a
 * structural contract that today is (deliberately) just data access.
 *
 * @param entityId - UUID of the commerce entity to evaluate.
 * @param tx - Optional Drizzle transaction client, forwarded from the caller.
 * @returns `{ complete, missing }` — see `resolveListingCompleteness`.
 */
export type ResolveCommerceListingCompleteness = (
    entityId: string,
    tx?: DrizzleClient
) => Promise<{ complete: boolean; missing: readonly string[] }>;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const logger: ILogger = createLogger('commerce-visibility');

/**
 * Reconciles a commerce listing's `visibility` and `lifecycleState` against the
 * current billing subscription status, publish-readiness, and moderation state.
 *
 * **Predicate (HOS-166 G-3, §6.5):**
 * ```
 * shouldBePublic = subscriptionActive AND listingComplete AND NOT moderationRejected
 * ```
 *
 * **Transition table:**
 * | shouldBePublic | visibility | lifecycleState |
 * |----------------|-----------|----------------|
 * | `true`         | `PUBLIC`  | `ACTIVE`       |
 * | `false`        | `PRIVATE` | `INACTIVE`     |
 *
 * The function:
 * 1. Looks up the entity via the injected model (`findById`) — this also
 *    reads `moderationState` off the same row (see {@link CommerceEntityModel}).
 * 2. When the subscription is active, resolves completeness via the injected
 *    `resolveCompleteness` (skipped when the subscription is already inactive
 *    — the desired state is PRIVATE regardless, so there is nothing to gain
 *    from the extra query).
 * 3. Computes the desired `visibility` and `lifecycleState` from the predicate.
 * 4. Writes only when the current state differs (idempotent).
 * 5. Returns a typed result describing what happened.
 *
 * **Incomplete + paid stays PRIVATE and logs loudly** (AC-6): a paid
 * subscription on an incomplete listing is a money-taken-nothing-delivered
 * state and must be visible in logs, not silent.
 *
 * It is intentionally decoupled from the entitlement engine — callers should
 * invoke this from billing webhook handlers or cron jobs, never from inside a
 * user-facing request context.
 *
 * @param input - {@link ReconcileCommerceListingVisibilityInput}
 * @param model - Entity model that implements `findById` and `update`.
 * @param resolveCompleteness - Resolves publish-readiness for the entity;
 *   see {@link ResolveCommerceListingCompleteness}.
 * @returns {@link ReconcileCommerceListingVisibilityResult}
 * @throws {ServiceError} NOT_FOUND when the entity does not exist.
 *
 * @example
 * ```ts
 * // Called from a billing webhook handler after a subscription activates:
 * const result = await reconcileCommerceListingVisibility(
 *   { entityType: 'gastronomy', entityId, subscriptionStatus: 'active' },
 *   gastronomyModel,
 *   resolveCommerceListingCompleteness,
 * );
 * if (result.updated) {
 *   logger.info('Gastronomy visibility reconciled', { entityId, ...result });
 * }
 * ```
 */
export async function reconcileCommerceListingVisibility(
    input: ReconcileCommerceListingVisibilityInput,
    model: CommerceEntityModel,
    resolveCompleteness: ResolveCommerceListingCompleteness
): Promise<ReconcileCommerceListingVisibilityResult> {
    const { entityType, entityId, subscriptionStatus, tx } = input;

    const subscriptionActive = ACTIVE_STATUSES.has(subscriptionStatus as 'active' | 'trialing');

    // Fetch the entity.
    const entity = await model.findById(entityId, tx);
    if (!entity) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Commerce entity not found: entityType=${entityType} entityId=${entityId}`
        );
    }

    const moderationRejected = entity.moderationState === ModerationStatusEnum.REJECTED;

    // Only resolve completeness when the subscription is active — when it is
    // not, the desired state is PRIVATE regardless of completeness, so the
    // extra query buys nothing.
    let complete = false;
    let missing: readonly string[] = [];
    if (subscriptionActive) {
        const completeness = await resolveCompleteness(entityId, tx);
        complete = completeness.complete;
        missing = completeness.missing;
    }

    const shouldBePublic = subscriptionActive && complete && !moderationRejected;
    const desiredVisibility: VisibilityEnum = shouldBePublic
        ? VisibilityEnum.PUBLIC
        : VisibilityEnum.PRIVATE;
    const desiredLifecycleState: LifecycleStatusEnum = shouldBePublic
        ? LifecycleStatusEnum.ACTIVE
        : LifecycleStatusEnum.INACTIVE;

    // HOS-166 AC-6: a paid-but-incomplete listing is money-taken-nothing-
    // delivered — log loudly (not silently) every time the reconciler observes
    // this state, whether or not a write happens.
    if (subscriptionActive && !complete) {
        logger.warn(
            { entityType, entityId, subscriptionStatus, missing },
            'Commerce listing has an active subscription but is not complete — staying PRIVATE'
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
        // The link table's unique index is (entity_type, entity_id) — filtering
        // on entityId alone would match a different entityType's row that
        // happens to reuse the same UUID (a real risk since gastronomy and
        // experience ids are drawn from independent primary key spaces).
        .where(
            and(
                eq(commerceListingSubscriptions.entityType, input.entityType),
                eq(commerceListingSubscriptions.entityId, input.entityId)
            )
        )
        .limit(1);

    const row = rows[0];
    return row === undefined ? null : row.status;
}
