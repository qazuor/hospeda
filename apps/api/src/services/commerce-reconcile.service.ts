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
    and,
    commerceListingSubscriptions,
    eq,
    experienceModel,
    gastronomyModel,
    getDb
} from '@repo/db';
import type { CommerceEntityType } from '@repo/schemas';
import { ProductDomainEnum, resolveListingCompleteness } from '@repo/schemas';
import {
    type CommerceEntityModel,
    type ResolveCommerceListingCompleteness,
    reconcileCommerceListingVisibility
} from '@repo/service-core';
import { apiLogger } from '../utils/logger.js';
import {
    isPublishingSubscriptionStatus,
    readSubscriptionDomainMetadata
} from './billing/subscription-domain-metadata.js';
import { loadCommerceListingMedia } from './commerce-listing-media.js';

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
 * the scalar fields `resolveListingCompleteness` needs (`name`, `summary`,
 * `description`, `contactInfo`, `openingHours`, `priceRange`, `priceFrom`,
 * `isPriceOnRequest`, …) — see {@link CommerceEntityModel}'s JSDoc for why
 * completeness stays a separate injected resolver rather than widening that
 * narrow structural contract.
 *
 * `media` is the exception and must be loaded separately via
 * {@link loadCommerceListingMedia}: HOS-372 dropped the `media` JSONB column,
 * so no raw-row read can supply it. This JSDoc used to claim the full model
 * read covered `media` too — true before that migration, false after, and the
 * stale claim is what let this path keep every paid listing PRIVATE (H-154 /
 * HOS-494).
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

    // HOS-372 dropped the `media` JSONB column — compose it from the relational
    // media tables, inside the reconciler's transaction (H-154 / HOS-494).
    const media = await loadCommerceListingMedia({
        entityType: entityType as CommerceEntityType,
        entityId,
        tx
    });

    return resolveListingCompleteness({
        entityType: entityType as CommerceEntityType,
        listing: { ...listing, media }
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
 * A commerce listing this subscription is responsible for.
 */
interface CommerceLink {
    readonly entityType: string;
    readonly entityId: string;
}

/**
 * Recover the listing of a subscription that no link row points at, using the
 * coordinates the checkout stamped on the subscription itself.
 *
 * Path C creates one subscription per checkout CLICK while
 * `commerce_listing_subscriptions` is UPSERTED per ENTITY, so a second click
 * re-points the row and orphans the first subscription — whose share link stays
 * valid on MercadoPago. Completing that first link used to end the reconcile in
 * an early return: an unpublished listing with a live charge.
 *
 * Two guards keep the recovery from being worse than the bug:
 *
 * 1. **Only a publishing status may claim a row.** The mirror case of the bug is
 *    the buyer completing the LAST checkout: the earlier subscriptions are then
 *    reaped as `cancelled`, and a status-blind recovery would steal the row back
 *    and unpublish a listing that is being paid for.
 * 2. **Never take the row from another already-paying subscription.** Two
 *    completed checkouts mean two live charges for one listing; the listing is
 *    already public under the incumbent, so the recovery leaves it alone and
 *    logs loudly instead of silently swapping which charge "owns" it.
 *
 * @param input.subscriptionId - Subscription whose link row is missing.
 * @param input.subscriptionStatus - Status being reconciled.
 * @param input.source - Caller label for log diagnostics.
 * @returns The recovered link (single element), or an empty array when there is
 *   nothing to recover.
 */
async function recoverCommerceLinkFromSubscriptionMetadata(input: {
    subscriptionId: string;
    subscriptionStatus: string;
    source: string;
}): Promise<readonly CommerceLink[]> {
    const { subscriptionId, subscriptionStatus, source } = input;

    if (!isPublishingSubscriptionStatus(subscriptionStatus)) {
        return [];
    }

    const coordinates = await readSubscriptionDomainMetadata({ subscriptionId });
    const entityType = coordinates?.commerceEntityType;
    const entityId = coordinates?.commerceEntityId;
    if (!entityType || !entityId) {
        return [];
    }

    const db = getDb();
    const [incumbent] = await db
        .select({
            subscriptionId: commerceListingSubscriptions.subscriptionId,
            status: commerceListingSubscriptions.status
        })
        .from(commerceListingSubscriptions)
        .where(
            and(
                eq(commerceListingSubscriptions.entityType, entityType),
                eq(commerceListingSubscriptions.entityId, entityId)
            )
        )
        .limit(1);

    if (incumbent && isPublishingSubscriptionStatus(incumbent.status)) {
        apiLogger.error(
            {
                subscriptionId,
                incumbentSubscriptionId: incumbent.subscriptionId,
                entityType,
                entityId,
                subscriptionStatus,
                source
            },
            'Two paying subscriptions for the same commerce listing — leaving the link row on the incumbent; one of the two charges must be refunded/cancelled by hand'
        );
        return [];
    }

    // HOS-692: the recovered link row's own `entityType` is the vertical —
    // stamp `productDomain` from it instead of the pre-HOS-685 hardcoded
    // 'commerce', matching the ternary `commerce-subscription-attach.service.ts`
    // already uses for the same two-value collision (CommerceEntityTypeEnum
    // and ProductDomainEnum share 'gastronomy'/'experience' on purpose).
    const productDomain =
        entityType === 'gastronomy' ? ProductDomainEnum.GASTRONOMY : ProductDomainEnum.EXPERIENCE;

    await db
        .insert(commerceListingSubscriptions)
        .values({
            subscriptionId,
            productDomain,
            entityType,
            entityId,
            status: subscriptionStatus
        })
        .onConflictDoUpdate({
            target: [
                commerceListingSubscriptions.entityType,
                commerceListingSubscriptions.entityId
            ],
            set: { subscriptionId, status: subscriptionStatus, updatedAt: new Date() }
        });

    apiLogger.warn(
        {
            subscriptionId,
            supersededSubscriptionId: incumbent?.subscriptionId ?? null,
            entityType,
            entityId,
            subscriptionStatus,
            source
        },
        'Recovered a paid commerce subscription no link row pointed at (superseded by a later checkout click) — link row re-pointed'
    );

    return [{ entityType, entityId }];
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
        const linkedRows = await db
            .select({
                entityType: commerceListingSubscriptions.entityType,
                entityId: commerceListingSubscriptions.entityId
            })
            .from(commerceListingSubscriptions)
            .where(eq(commerceListingSubscriptions.subscriptionId, subscriptionId));

        // No link row can mean two very different things: an accommodation
        // subscription (the overwhelmingly common path, nothing to do) or a
        // commerce subscription orphaned by a later checkout click, which the
        // recovery below resolves from the subscription's own metadata.
        const links: readonly CommerceLink[] =
            linkedRows.length > 0
                ? linkedRows
                : await recoverCommerceLinkFromSubscriptionMetadata({
                      subscriptionId,
                      subscriptionStatus,
                      source
                  });

        if (links.length === 0) {
            return;
        }

        if (linkedRows.length > 0) {
            // Keep the denormalized link-row status in sync so fast public reads
            // and the reconciler agree on the current status. Skipped on the
            // recovery path, whose upsert already wrote the same status.
            await db
                .update(commerceListingSubscriptions)
                .set({ status: subscriptionStatus, updatedAt: new Date() })
                .where(eq(commerceListingSubscriptions.subscriptionId, subscriptionId));
        }

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
