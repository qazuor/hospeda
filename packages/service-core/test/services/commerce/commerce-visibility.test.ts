/**
 * commerce-visibility.test.ts
 *
 * Unit tests for the commerce listing visibility reconciler (SPEC-239 T-032).
 * No real DB is touched — model methods are mocked.
 */

import { LifecycleStatusEnum, ServiceErrorCode, VisibilityEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    type CommerceEntityModel,
    reconcileCommerceListingVisibility
} from '../../../src/services/commerce/commerce-visibility';
import { ServiceError } from '../../../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const ENTITY_TYPE = 'gastronomy';

function makeModel(
    existingEntity: { id: string; visibility: string; lifecycleState: string } | null
): CommerceEntityModel {
    return {
        findById: vi.fn().mockResolvedValue(existingEntity),
        update: vi.fn().mockResolvedValue(existingEntity)
    };
}

// ---------------------------------------------------------------------------
// reconcileCommerceListingVisibility
// ---------------------------------------------------------------------------

describe('reconcileCommerceListingVisibility', () => {
    describe('active/trialing → PUBLIC + ACTIVE', () => {
        it('should set visibility=PUBLIC and lifecycleState=ACTIVE for active status', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });

            const result = await reconcileCommerceListingVisibility(
                { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: 'active' },
                model
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
                model
            );

            expect(result.updated).toBe(true);
            expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
            expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });

    describe('other statuses → PRIVATE + INACTIVE', () => {
        it.each(['past_due', 'cancelled', 'expired', 'suspended'])(
            'should set visibility=PRIVATE and lifecycleState=INACTIVE for status=%s',
            async (status) => {
                const model = makeModel({
                    id: ENTITY_ID,
                    visibility: VisibilityEnum.PUBLIC,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                });

                const result = await reconcileCommerceListingVisibility(
                    { entityType: ENTITY_TYPE, entityId: ENTITY_ID, subscriptionStatus: status },
                    model
                );

                expect(result.updated).toBe(true);
                expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
                expect(result.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
            }
        );
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
                model
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
                model
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
                    model
                )
            ).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.NOT_FOUND
            );

            expect(model.update).not.toHaveBeenCalled();
        });
    });

    describe('transaction forwarding', () => {
        it('should pass the tx parameter to model.findById and model.update', async () => {
            const model = makeModel({
                id: ENTITY_ID,
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.INACTIVE
            });
            const fakeTx = {} as Parameters<typeof reconcileCommerceListingVisibility>[0]['tx'];

            await reconcileCommerceListingVisibility(
                {
                    entityType: ENTITY_TYPE,
                    entityId: ENTITY_ID,
                    subscriptionStatus: 'active',
                    tx: fakeTx
                },
                model
            );

            expect(model.findById).toHaveBeenCalledWith(ENTITY_ID, fakeTx);
            expect(model.update).toHaveBeenCalledWith(
                { id: ENTITY_ID },
                expect.objectContaining({ visibility: VisibilityEnum.PUBLIC }),
                fakeTx
            );
        });
    });
});
