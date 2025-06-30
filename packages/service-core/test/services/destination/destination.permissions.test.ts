import { PermissionEnum, ServiceErrorCode, VisibilityEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateDestination,
    checkCanUpdateDestination,
    checkCanViewDestination
} from '../../../src/services/destination/destination.permission';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';

describe('Destination Permission Helpers', () => {
    describe('checkCanViewDestination', () => {
        it('allows viewing a public destination for any actor', () => {
            const actor = createActor();
            const destination = createDestination({ visibility: VisibilityEnum.PUBLIC });
            expect(() => checkCanViewDestination(actor, destination)).not.toThrow();
        });
        it('denies viewing a private destination without permission', () => {
            const actor = createActor({ permissions: [] });
            const destination = createDestination({ visibility: VisibilityEnum.PRIVATE });
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
        it('allows viewing a private destination with DESTINATION_VIEW_PRIVATE', () => {
            const actor = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
            const destination = createDestination({ visibility: VisibilityEnum.PRIVATE });
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
            const destination = createDestination();
            expect(() => checkCanUpdateDestination(actor, destination)).not.toThrow();
        });
        it('denies update if actor lacks DESTINATION_UPDATE', () => {
            const actor = createActor({ permissions: [] });
            const destination = createDestination();
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
