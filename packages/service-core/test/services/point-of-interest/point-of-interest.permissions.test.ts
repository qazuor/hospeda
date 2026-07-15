import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
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
import { PointOfInterestFactoryBuilder } from '../../factories/pointOfInterestFactory';

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

    const activePoi = PointOfInterestFactoryBuilder.create({
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: undefined
    });
    const deletedPoi = PointOfInterestFactoryBuilder.create({ deletedAt: new Date() });
    const archivedPoi = PointOfInterestFactoryBuilder.create({
        lifecycleState: LifecycleStatusEnum.ARCHIVED
    });

    it('checkCanViewPointOfInterest allows any actor to view an ACTIVE, non-deleted POI', () => {
        expect(() => checkCanViewPointOfInterest(actorNoPerms, activePoi)).not.toThrow();
        expect(() => checkCanViewPointOfInterest(actorWithView, activePoi)).not.toThrow();
    });

    it('checkCanViewPointOfInterest throws NOT_FOUND for a soft-deleted POI without POINT_OF_INTEREST_VIEW (HOS-132)', () => {
        expect(() => checkCanViewPointOfInterest(actorNoPerms, deletedPoi)).toThrowError(
            ServiceError
        );
        try {
            checkCanViewPointOfInterest(actorNoPerms, deletedPoi);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
        }
    });

    it('checkCanViewPointOfInterest throws NOT_FOUND for a non-ACTIVE POI without POINT_OF_INTEREST_VIEW (HOS-132)', () => {
        expect(() => checkCanViewPointOfInterest(actorNoPerms, archivedPoi)).toThrowError(
            ServiceError
        );
        try {
            checkCanViewPointOfInterest(actorNoPerms, archivedPoi);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.NOT_FOUND);
        }
    });

    it('checkCanViewPointOfInterest allows an actor with POINT_OF_INTEREST_VIEW to view a soft-deleted or non-ACTIVE POI (admin path, HOS-132)', () => {
        expect(() => checkCanViewPointOfInterest(actorWithView, deletedPoi)).not.toThrow();
        expect(() => checkCanViewPointOfInterest(actorWithView, archivedPoi)).not.toThrow();
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
