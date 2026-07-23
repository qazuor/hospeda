/**
 * commerce-visibility.test.ts
 *
 * Unit tests for the commerce listing visibility reconciler (SPEC-239 T-032,
 * predicate widened HOS-166 §6.5). No real DB is touched — model methods are
 * mocked.
 */

import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    type CommerceEntityModel,
    type ResolveCommerceListingCompleteness,
    reconcileCommerceListingVisibility
} from '../../../src/services/commerce/commerce-visibility';
import { ServiceError } from '../../../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const ENTITY_TYPE = 'gastronomy';

function makeModel(
    existingEntity: {
        id: string;
        visibility: string;
        lifecycleState: string;
        moderationState?: string | null;
    } | null
): CommerceEntityModel {
    return {
        findById: vi.fn().mockResolvedValue(existingEntity),
        update: vi.fn().mockResolvedValue(existingEntity)
    };
}

/** Resolver stub that always reports the listing as complete (no missing fields). */
function makeAlwaysCompleteResolver(): ResolveCommerceListingCompleteness {
    return vi.fn().mockResolvedValue({ complete: true, missing: [] });
}

/** Resolver stub that reports the listing as incomplete with the given missing fields. */
function makeIncompleteResolver(missing: readonly string[]): ResolveCommerceListingCompleteness {
    return vi.fn().mockResolvedValue({ complete: false, missing });
}

// ---------------------------------------------------------------------------
// reconcileCommerceListingVisibility
// ---------------------------------------------------------------------------

describe('reconcileCommerceListingVisibility', () => {
    describe('active/trialing + complete → PUBLIC + ACTIVE', () => {
        it('should set visibility=PUBLIC and lifecycleState=ACTIVE for active status', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });
            const resolveCompleteness = makeAlwaysCompleteResolver();

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model,
                resolveCompleteness
            );

            expect(result.updated).toBe(true);
            expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
            expect(model.update).toHaveBeenCalledWith(
                { id: ENTITY_ID },
                { visibility: VisibilityEnum.PUBLIC, lifecycleState: LifecycleStatusEnum.ACTIVE },
                undefined
            );
        });

        it('should set visibility=PUBLIC and lifecycleState=ACTIVE for trialing status', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'trialing' },
                model,
                makeAlwaysCompleteResolver()
            );

            expect(result.updated).toBe(true);
            expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });

    describe('other statuses → PRIVATE + INACTIVE', () => {
        it.each([
            'past_due',
            'cancelled',
            'expired',
            'suspended'
        ])('should set visibility=PRIVATE and lifecycleState=INACTIVE for status=%s', async (status) => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: status },
                model,
                makeAlwaysCompleteResolver()
            );

            expect(result.updated).toBe(true);
            expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
        });

        it('should NOT call resolveCompleteness when the subscription is not active (short-circuit)', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            const resolveCompleteness = makeAlwaysCompleteResolver();

            await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'cancelled' },
                model,
                resolveCompleteness
            );

            expect(resolveCompleteness).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // HOS-166 AC-6: incomplete + active subscription → stays PRIVATE, logs loudly
    // -------------------------------------------------------------------------

    describe('active subscription + incomplete listing → stays PRIVATE (HOS-166 AC-6)', () => {
        it('should keep visibility=PRIVATE and lifecycleState=INACTIVE despite an active subscription', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });
            const resolveCompleteness = makeIncompleteResolver([
                'media.featuredImage',
                'contactInfo'
            ]);

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model,
                resolveCompleteness
            );

            expect(result.updated).toBe(false);
            expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
            expect(model.update).not.toHaveBeenCalled();
            expect(resolveCompleteness).toHaveBeenCalledWith(ENTITY_ID, undefined);
        });

        it('should flip an already-PUBLIC listing back to PRIVATE if it becomes incomplete', async () => {
            // Simulates the race in R-2: a listing was complete+paid (PUBLIC), then
            // the owner edited it and un-completed a required field.
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            const resolveCompleteness = makeIncompleteResolver(['destinationId']);

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model,
                resolveCompleteness
            );

            expect(result.updated).toBe(true);
            expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
            expect(model.update).toHaveBeenCalledWith(
                { id: ENTITY_ID },
                {
                    visibility: VisibilityEnum.PRIVATE,
                    lifecycleState: LifecycleStatusEnum.INACTIVE
                },
                undefined
            );
        });
    });

    // -------------------------------------------------------------------------
    // HOS-166 AC-9: moderationState=REJECTED + active subscription → stays PRIVATE
    // -------------------------------------------------------------------------

    describe('moderationState=REJECTED + active subscription → stays PRIVATE (HOS-166 AC-9)', () => {
        it('should keep visibility=PRIVATE even when the listing is otherwise complete', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE,
                moderationState: ModerationStatusEnum.REJECTED
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model,
                makeAlwaysCompleteResolver()
            );

            expect(result.updated).toBe(false);
            expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should flip PUBLIC → PRIVATE for a previously-published listing whose moderation flips to REJECTED', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.REJECTED
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model,
                makeAlwaysCompleteResolver()
            );

            expect(result.updated).toBe(true);
            expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
        });

        it('should treat PENDING moderationState as publishable (default per §6.5)', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE,
                moderationState: ModerationStatusEnum.PENDING
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model,
                makeAlwaysCompleteResolver()
            );

            expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
        });

        it('should treat an absent moderationState as publishable (defensive default)', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model,
                makeAlwaysCompleteResolver()
            );

            expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
        });
    });

    describe('idempotency', () => {
        it('should not write when entity is already in the correct active state', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model,
                makeAlwaysCompleteResolver()
            );

            expect(result.updated).toBe(false);
            expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
            expect(model.update).not.toHaveBeenCalled();
        });

        it('should not write when entity is already in the correct inactive state', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'past_due' },
                model,
                makeAlwaysCompleteResolver()
            );

            expect(result.updated).toBe(false);
            expect(model.update).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should throw NOT_FOUND when entity does not exist', async () => {
            const model = makeModel(null);

            await expect(
                reconcileCommerceListingVisibility(
                    { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                    model,
                    makeAlwaysCompleteResolver()
                )
            ).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.NOT_FOUND
            );

            expect(model.update).not.toHaveBeenCalled();
        });
    });

    describe('transaction forwarding', () => {
        it('should pass the tx parameter to model.findById, resolveCompleteness, and model.update', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });
            const resolveCompleteness = makeAlwaysCompleteResolver();
            const fakeTx = {} as Parameters<typeof reconcileCommerceListingVisibility>[0]['tx'];

            await reconcileCommerceListingVisibility(
                {
                    entityType: ENTITY_TYPE,
                    entityId: ENTITY_ID,
                    subscriptionStatus: 'active',
                    tx: fakeTx
                },
                model,
                resolveCompleteness
            );

            expect(model.findById).toHaveBeenCalledWith(ENTITY_ID, fakeTx);
            expect(resolveCompleteness).toHaveBeenCalledWith(ENTITY_ID, fakeTx);
            expect(model.update).toHaveBeenCalledWith(
                { id: ENTITY_ID },
                expect.objectContaining({ visibility: VisibilityEnum.PUBLIC }),
                fakeTx
            );
        });
    });
});
