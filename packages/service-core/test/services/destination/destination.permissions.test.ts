import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import type { Destination } from '@repo/schemas';
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
