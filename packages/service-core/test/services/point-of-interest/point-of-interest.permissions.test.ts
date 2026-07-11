import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanAdminList,
    checkCanCreatePointOfInterest,
    checkCanDeletePointOfInterest,
    checkCanListPointsOfInterest,
    checkCanRestorePointOfInterest,
    checkCanUpdatePointOfInterest,
    checkCanViewPointOfInterest
} from '../../../src/services/point-of-interest/point-of-interest.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

describe('PointOfInterest permissions', () => {
    const actorNoPerms = createActor({ permissions: [] });
    const actorWithCreate = createActor({
        permissions: [PermissionEnum.POINT_OF_INTEREST_CREATE]
    });
    const actorWithUpdate = createActor({
        permissions: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
    });
    const actorWithDelete = createActor({
        permissions: [PermissionEnum.POINT_OF_INTEREST_DELETE]
    });
    const actorWithRestore = createActor({
        permissions: [PermissionEnum.POINT_OF_INTEREST_RESTORE]
    });
    const actorWithView = createActor({ permissions: [PermissionEnum.POINT_OF_INTEREST_VIEW] });

    it('checkCanViewPointOfInterest always allows (public catalog)', () => {
        expect(() => checkCanViewPointOfInterest(actorNoPerms)).not.toThrow();
        expect(() => checkCanViewPointOfInterest(actorWithView)).not.toThrow();
    });

    it('checkCanListPointsOfInterest always allows (public catalog)', () => {
        expect(() => checkCanListPointsOfInterest(actorNoPerms)).not.toThrow();
        expect(() => checkCanListPointsOfInterest(actorWithView)).not.toThrow();
    });

    it('checkCanCreatePointOfInterest allows with POINT_OF_INTEREST_CREATE', () => {
        expect(() => checkCanCreatePointOfInterest(actorWithCreate)).not.toThrow();
    });
    it('checkCanCreatePointOfInterest throws FORBIDDEN without permission', () => {
        expect(() => checkCanCreatePointOfInterest(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanCreatePointOfInterest(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });

    it('checkCanUpdatePointOfInterest allows with POINT_OF_INTEREST_UPDATE', () => {
        expect(() => checkCanUpdatePointOfInterest(actorWithUpdate)).not.toThrow();
    });
    it('checkCanUpdatePointOfInterest throws FORBIDDEN without permission', () => {
        expect(() => checkCanUpdatePointOfInterest(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanUpdatePointOfInterest(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });

    it('checkCanDeletePointOfInterest allows with POINT_OF_INTEREST_DELETE', () => {
        expect(() => checkCanDeletePointOfInterest(actorWithDelete)).not.toThrow();
    });
    it('checkCanDeletePointOfInterest throws FORBIDDEN without permission', () => {
        expect(() => checkCanDeletePointOfInterest(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanDeletePointOfInterest(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });

    it('checkCanRestorePointOfInterest allows with POINT_OF_INTEREST_RESTORE', () => {
        expect(() => checkCanRestorePointOfInterest(actorWithRestore)).not.toThrow();
    });
    it('checkCanRestorePointOfInterest throws FORBIDDEN without permission', () => {
        expect(() => checkCanRestorePointOfInterest(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanRestorePointOfInterest(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });

    it('checkCanAdminList allows with POINT_OF_INTEREST_VIEW', () => {
        expect(() => checkCanAdminList(actorWithView)).not.toThrow();
    });
    it('checkCanAdminList throws FORBIDDEN without POINT_OF_INTEREST_VIEW', () => {
        expect(() => checkCanAdminList(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanAdminList(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
});
