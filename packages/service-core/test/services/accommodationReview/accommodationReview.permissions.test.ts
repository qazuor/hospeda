import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateAccommodationReview,
    checkCanDeleteAccommodationReview,
    checkCanUpdateAccommodationReview,
    checkCanViewAccommodationReview
} from '../../../src/services/accommodationReview/accommodationReview.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

const baseActor = { id: 'actor-1', role: RoleEnum.USER, permissions: [] };

describe('accommodationReview.permissions', () => {
    describe('checkCanCreateAccommodationReview', () => {
        it('throws if actor is null', () => {
            try {
                checkCanCreateAccommodationReview(
                    null as unknown as import('../../../src/types').Actor
                );
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('throws if actor lacks permission', () => {
            try {
                checkCanCreateAccommodationReview(baseActor);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('does not throw if actor has permission', () => {
            const actor = {
                ...baseActor,
                permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
            };
            expect(() => checkCanCreateAccommodationReview(actor)).not.toThrow();
        });
    });

    describe('checkCanUpdateAccommodationReview', () => {
        it('throws if actor is null', () => {
            try {
                checkCanUpdateAccommodationReview(
                    null as unknown as import('../../../src/types').Actor
                );
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('throws if actor lacks permission', () => {
            try {
                checkCanUpdateAccommodationReview(baseActor);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('does not throw if actor has permission', () => {
            const actor = {
                ...baseActor,
                permissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
            };
            expect(() => checkCanUpdateAccommodationReview(actor)).not.toThrow();
        });
    });

    describe('checkCanDeleteAccommodationReview', () => {
        it('throws if actor is null', () => {
            try {
                checkCanDeleteAccommodationReview(
                    null as unknown as import('../../../src/types').Actor
                );
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('throws if actor lacks permission', () => {
            try {
                checkCanDeleteAccommodationReview(baseActor);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('does not throw if actor has permission', () => {
            const actor = {
                ...baseActor,
                permissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
            };
            expect(() => checkCanDeleteAccommodationReview(actor)).not.toThrow();
        });
    });

    describe('checkCanViewAccommodationReview', () => {
        it('throws if actor is null', () => {
            expect(() =>
                checkCanViewAccommodationReview(
                    null as unknown as import('../../../src/types').Actor
                )
            ).toThrow();
        });
        it('does not throw if actor has no specific permissions (public access)', () => {
            const actor = createActor({ permissions: [] });
            expect(() => checkCanViewAccommodationReview(actor)).not.toThrow();
        });
        it('does not throw if actor has permission', () => {
            const actor = createActor({
                permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
            });
            expect(() => checkCanViewAccommodationReview(actor)).not.toThrow();
        });
    });
});
