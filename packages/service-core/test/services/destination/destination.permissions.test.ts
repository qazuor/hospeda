import type { Destination } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateDestination,
    checkCanUpdateDestination,
    checkCanViewDestination
} from '../../../src/services/destination/destination.permission';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

// Helper function to create a destination that matches the Destination schema
function createTestDestination(overrides: Partial<Destination> = {}): Destination {
    return {
        id: 'test-destination-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        name: 'Test Destination',
        slug: 'test-destination',
        summary: 'A test destination',
        isFeatured: false,
        accommodationsCount: 0,
        reviewsCount: 0,
        averageRating: 0,
        visibility: VisibilityEnum.PUBLIC,
        moderationState: ModerationStatusEnum.APPROVED,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdById: 'user-id',
        updatedById: 'user-id',
        attractions: [],
        ...overrides
    } as Destination;
}

describe('Destination Permission Helpers', () => {
    describe('checkCanViewDestination', () => {
        it('allows viewing a public destination for any actor', () => {
            const actor = createActor();
            const destination = createTestDestination({ visibility: VisibilityEnum.PUBLIC });
            expect(() => checkCanViewDestination(actor, destination)).not.toThrow();
        });
        it('denies viewing a private destination without permission', () => {
            const actor = createActor({ permissions: [] });
            const destination = createTestDestination({ visibility: VisibilityEnum.PRIVATE });
            try {
                checkCanViewDestination(actor, destination);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Permission denied to view destination');
                }
            }
        });
        it('allows viewing a private destination with permission', () => {
            const actor = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
            const destination = createTestDestination({ visibility: VisibilityEnum.PRIVATE });
            expect(() => checkCanViewDestination(actor, destination)).not.toThrow();
        });

        // HOS-117 T-022: soft-deleted destinations previously leaked a full 200
        // (checkCanViewDestination had no deletedAt guard at all). Now any actor
        // without DESTINATION_VIEW_ALL gets GONE (410, deindex) when the
        // destination was PUBLIC before deletion; a deleted PRIVATE/RESTRICTED
        // destination stays NOT_FOUND (404, uniform) to preserve the
        // anti-enumeration contract (SPEC-092 T-087). Staff with
        // DESTINATION_VIEW_ALL are exempt so the admin panel can still manage it.
        it('throws GONE for a soft-deleted PUBLIC destination when actor lacks DESTINATION_VIEW_ALL', () => {
            const actor = createActor({ permissions: [] });
            const destination = createTestDestination({
                visibility: VisibilityEnum.PUBLIC,
                deletedAt: new Date()
            });
            try {
                checkCanViewDestination(actor, destination);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.GONE);
                }
            }
        });

        it('throws NOT_FOUND (not GONE) for a soft-deleted PRIVATE destination — anti-enumeration (SPEC-092 T-087)', () => {
            const actor = createActor({ permissions: [] });
            const destination = createTestDestination({
                visibility: VisibilityEnum.PRIVATE,
                deletedAt: new Date()
            });
            try {
                checkCanViewDestination(actor, destination);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.NOT_FOUND);
                }
            }
        });

        it('allows staff with DESTINATION_VIEW_ALL to view a soft-deleted destination', () => {
            const actor = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_ALL] });
            const destination = createTestDestination({
                visibility: VisibilityEnum.PUBLIC,
                deletedAt: new Date()
            });
            expect(() => checkCanViewDestination(actor, destination)).not.toThrow();
        });

        it('allows viewing a live (non-deleted) PUBLIC destination', () => {
            const actor = createActor();
            const destination = createTestDestination({
                visibility: VisibilityEnum.PUBLIC,
                deletedAt: undefined
            });
            expect(() => checkCanViewDestination(actor, destination)).not.toThrow();
        });
    });

    describe('checkCanCreateDestination', () => {
        it('allows creation if actor has DESTINATION_CREATE', () => {
            const actor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
            expect(() => checkCanCreateDestination(actor, {})).not.toThrow();
        });
        it('denies creation if actor lacks DESTINATION_CREATE', () => {
            const actor = createActor({ permissions: [] });
            try {
                checkCanCreateDestination(actor, {});
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Permission denied to create destination');
                }
            }
        });
    });

    describe('checkCanUpdateDestination', () => {
        it('allows update if actor has DESTINATION_UPDATE', () => {
            const actor = createActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
            const destination = createTestDestination();
            expect(() => checkCanUpdateDestination(actor, destination)).not.toThrow();
        });
        it('denies update if actor lacks DESTINATION_UPDATE', () => {
            const actor = createActor({ permissions: [] });
            const destination = createTestDestination();
            try {
                checkCanUpdateDestination(actor, destination);
                throw new Error('Should have thrown');
            } catch (err: unknown) {
                expect(err).toBeInstanceOf(ServiceError);
                if (err instanceof ServiceError) {
                    expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                    expect(err.message).toBe('FORBIDDEN: Permission denied to update destination');
                }
            }
        });
    });
});
