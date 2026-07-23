/**
 * Commerce listing visibility reconcile wiring (SPEC-239 T-050).
 *
 * Bridges the billing lifecycle (MP webhook + dunning / finalize crons) to the
 * commerce visibility reconciler. When a subscription's status changes, any
 * commerce listing linked to it must flip visibility (active/trialing → PUBLIC,
 * everything else → PRIVATE).
 *
 * The reconciler (`reconcileCommerceListingVisibility` in `@repo/service-core`)
 * is generic over `entityType` and needs a {@link CommerceEntityModel}. This
 * module supplies the concrete model via {@link resolveCommerceEntityModel}
 * (D5: switch on entityType → the matching `@repo/db` model) and a convenience
 * driver, {@link reconcileCommerceListingForSubscription}, that:
 *   1. looks up the link rows for a given billing subscription id,
 *   2. resolves the model per entityType,
 *   3. reconciles each listing,
 *   4. never throws (callers are webhook/cron paths that must not break).
 *
 * @module services/commerce-reconcile.service
 */

import type { DrizzleClient } from '@repo/db';
import {
    commerceListingSubscriptions,
    eq,
    experienceModel,
    gastronomyModel,
    getDb
} from '@repo/db';
import type { CommerceEntityType } from '@repo/schemas';
import { resolveListingCompleteness } from '@repo/schemas';
import {
    type CommerceEntityModel,
    type ResolveCommerceListingCompleteness,
    reconcileCommerceListingVisibility
} from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';

/**
 * Resolve the concrete {@link CommerceEntityModel} for a commerce entity type
 * (D5). Throws a clear error for an unknown entityType so a misconfiguration
 * surfaces loudly rather than silently skipping a reconcile.
 *
 * @param entityType - Commerce entity discriminator (e.g. `'gastronomy'`).
 * @returns A model satisfying the `CommerceEntityModel` contract.
 * @throws {Error} When `entityType` has no registered model.
 */
export function resolveCommerceEntityModel(entityType: string): CommerceEntityModel {
    switch (entityType) {
        case 'gastronomy':
            // TYPE-WORKAROUND: BaseModelImpl.findById/update are structurally
            // compatible with the CommerceEntityModel contract (the gastronomy
            // entity is a superset of { id, visibility, lifecycleState }), but the
            // generic Gastronomy model type is wider than the narrow reconciler shape.
            return gastronomyModel as unknown as CommerceEntityModel;
        case 'experience':
            // TYPE-WORKAROUND: same structural compatibility as gastronomy above.
            return experienceModel as unknown as CommerceEntityModel;
        default:
            throw new Error(
                `resolveCommerceEntityModel: no commerce entity model for entityType '${entityType}'`
            );
    }
}

/**
 * Resolves a commerce listing's publish-readiness for the reconciler's
 * predicate (HOS-166 §6.5). Deliberately does its OWN `findById` read via the
 * FULL `gastronomyModel`/`experienceModel` (not the narrow
 * `CommerceEntityModel` from `resolveCommerceEntityModel`) so it can read
 * every field `resolveListingCompleteness` needs (`name`, `summary`,
 * `description`, `media`, `contactInfo`, `openingHours`, `priceRange`,
 * `priceFrom`, `isPriceOnRequest`, …) — see {@link CommerceEntityModel}'s
 * JSDoc for why completeness stays a separate injected resolver rather than
 * widening that narrow structural contract.
 *
 * @param entityType - Commerce entity discriminator (`'gastronomy'` | `'experience'`).
 * @param entityId - UUID of the commerce entity to evaluate.
 * @param tx - Optional Drizzle transaction client, forwarded from the reconciler.
 * @returns `{ complete, missing }` — `complete: false` with a synthetic
 *   `missing: ['listing_not_found']` when the row cannot be found (defensive;
 *   the reconciler's own `model.findById` call already 404s first in the
 *   normal path, so this branch is a belt-and-suspenders guard against a
 *   race between the two independent reads).
 * @throws {Error} When `entityType` has no registered model (mirrors
 *   {@link resolveCommerceEntityModel}).
 */
export async function resolveCommerceListingCompleteness(
    entityType: string,
    entityId: string,
    tx?: DrizzleClient
): Promise<{ complete: boolean; missing: readonly string[] }> {
    let listing: Record<string, unknown> | null;
    switch (entityType) {
        case 'gastronomy':
            listing = await gastronomyModel.findById(entityId, tx);
            break;
        case 'experience':
            listing = await experienceModel.findById(entityId, tx);
            break;
        default:
            throw new Error(
                `resolveCommerceListingCompleteness: no commerce entity model for entityType '${entityType}'`
            );
    }

    if (!listing) {
        return { complete: false, missing: ['listing_not_found'] };
    }

    return resolveListingCompleteness({
        entityType: entityType as CommerceEntityType,
        listing
    });
}

/**
 * Builds a {@link ResolveCommerceListingCompleteness} resolver bound to a
 * fixed `entityType`, matching the shape `reconcileCommerceListingVisibility`
 * expects (`(entityId, tx?) => Promise<{complete, missing}>`).
 *
 * @param entityType - Commerce entity discriminator for this reconcile call.
 * @returns A resolver closed over `entityType`.
 */
function bindCompletenessResolver(entityType: string): ResolveCommerceListingCompleteness {
    return (entityId, tx) => resolveCommerceListingCompleteness(entityType, entityId, tx);
}

/**
 * Reconcile the visibility of every commerce listing linked to a billing
 * subscription, mapping the new subscription status onto the reconciler.
 *
 * Non-throwing by contract: this runs from the MP webhook handler and the
 * dunning / finalize crons, all of which must never break because of a
 * commerce-side reconcile. Any error is logged and swallowed.
 *
 * @param input.subscriptionId - The billing subscription id whose status changed.
 * @param input.subscriptionStatus - The new status to apply (e.g. `'active'`,
 *   `'cancelled'`, `'past_due'`).
 * @param input.source - Caller label for log diagnostics (e.g. `'mp-webhook'`).
 */
export async function reconcileCommerceListingForSubscription(input: {
    subscriptionId: string;
    subscriptionStatus: string;
    source: string;
}): Promise<void> {
    const { subscriptionId, subscriptionStatus, source } = input;

    try {
        const db = getDb();
        const links = await db
            .select({
                entityType: commerceListingSubscriptions.entityType,
                entityId: commerceListingSubscriptions.entityId
            })
            .from(commerceListingSubscriptions)
            .where(eq(commerceListingSubscriptions.subscriptionId, subscriptionId));

        if (links.length === 0) {
            // Not a commerce subscription — the overwhelmingly common path.
            return;
        }

        // Keep the denormalized link-row status in sync so fast public reads and
        // the reconciler agree on the current status.
        await db
            .update(commerceListingSubscriptions)
            .set({ status: subscriptionStatus, updatedAt: new Date() })
            .where(eq(commerceListingSubscriptions.subscriptionId, subscriptionId));

        for (const link of links) {
            try {
                const model = resolveCommerceEntityModel(link.entityType);
                const result = await reconcileCommerceListingVisibility(
                    {
                        entityType: link.entityType,
                        entityId: link.entityId,
                        subscriptionStatus
                    },
                    model,
                    bindCompletenessResolver(link.entityType)
                );
                apiLogger.info(
                    {
                        subscriptionId,
                        entityType: link.entityType,
                        entityId: link.entityId,
                        subscriptionStatus,
                        updated: result.updated,
                        visibility: result.visibility,
                        lifecycleState: result.lifecycleState,
                        source
                    },
                    'Commerce listing visibility reconciled from billing lifecycle'
                );
            } catch (entityError) {
                apiLogger.error(
                    {
                        subscriptionId,
                        entityType: link.entityType,
                        entityId: link.entityId,
                        subscriptionStatus,
                        source,
                        error:
                            entityError instanceof Error ? entityError.message : String(entityError)
                    },
                    'Failed to reconcile a commerce listing — continuing with the rest'
                );
            }
        }
    } catch (error) {
        apiLogger.error(
            {
                subscriptionId,
                subscriptionStatus,
                source,
                error: error instanceof Error ? error.message : String(error)
            },
            'Commerce reconcile lookup failed — skipping (non-blocking)'
        );
    }
}
