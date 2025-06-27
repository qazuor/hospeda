import { PermissionEnum, VisibilityEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateDestination,
    checkCanUpdateDestination,
    checkCanViewDestination
} from '../../../src/services/destination/destination.permission';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';

/**
 * Unit tests for Destination permission helpers.
 */
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
            expect(() => checkCanViewDestination(actor, destination)).toThrowError(
                /Permission denied/
            );
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
            expect(() => checkCanCreateDestination(actor, {})).toThrowError(/Permission denied/);
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
            expect(() => checkCanUpdateDestination(actor, destination)).toThrowError(
                /Permission denied/
            );
        });
    });
});
