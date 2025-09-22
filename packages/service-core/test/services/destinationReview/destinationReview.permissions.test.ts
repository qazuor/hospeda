import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateDestinationReview,
    checkCanDeleteDestinationReview,
    checkCanUpdateDestinationReview,
    checkCanViewDestinationReview
} from '../../../src/services/destinationReview/destinationReview.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

const baseActor = { id: 'actor-1', role: RoleEnum.USER, permissions: [] };

describe('destinationReview.permissions', () => {
    describe('checkCanCreateDestinationReview', () => {
        it('throws if actor is null', () => {
            try {
                checkCanCreateDestinationReview(
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
                checkCanCreateDestinationReview(baseActor);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('does not throw if actor has permission', () => {
            const actor = {
                ...baseActor,
                permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
            };
            expect(() => checkCanCreateDestinationReview(actor)).not.toThrow();
        });
    });

    describe('checkCanUpdateDestinationReview', () => {
        it('throws if actor is null', () => {
            try {
                checkCanUpdateDestinationReview(
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
                checkCanUpdateDestinationReview(baseActor);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('does not throw if actor has permission', () => {
            const actor = {
                ...baseActor,
                permissions: [PermissionEnum.DESTINATION_REVIEW_UPDATE]
            };
            expect(() => checkCanUpdateDestinationReview(actor)).not.toThrow();
        });
    });

    describe('checkCanDeleteDestinationReview', () => {
        it('throws if actor is null', () => {
            try {
                checkCanDeleteDestinationReview(
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
                checkCanDeleteDestinationReview(baseActor);
                throw new Error('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
        it('does not throw if actor has permission', () => {
            const actor = {
                ...baseActor,
                permissions: [PermissionEnum.DESTINATION_REVIEW_MODERATE]
            };
            expect(() => checkCanDeleteDestinationReview(actor)).not.toThrow();
        });
    });

    describe('checkCanViewDestinationReview', () => {
        it('throws if actor is null', () => {
            expect(() =>
                checkCanViewDestinationReview(null as unknown as import('../../../src/types').Actor)
            ).toThrow();
        });
        it('does not throw if actor has no specific permissions (public access)', () => {
            const actor = createActor({ permissions: [] });
            expect(() => checkCanViewDestinationReview(actor)).not.toThrow();
        });
        it('does not throw if actor has permission', () => {
            const actor = createActor({
                permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
            });
            expect(() => checkCanViewDestinationReview(actor)).not.toThrow();
        });
    });
});
