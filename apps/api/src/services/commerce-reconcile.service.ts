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

import {
    commerceListingSubscriptions,
    eq,
    experienceModel,
    gastronomyModel,
    getDb
} from '@repo/db';
import { type CommerceEntityModel, reconcileCommerceListingVisibility } from '@repo/service-core';
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
                    model
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
