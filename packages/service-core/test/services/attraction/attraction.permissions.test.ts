import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateAttraction,
    checkCanDeleteAttraction,
    checkCanListAttractions,
    checkCanUpdateAttraction,
    checkCanViewAttraction
} from '../../../src/services/attraction/attraction.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

describe('Attraction permissions', () => {
    const actorWithView = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
    const actorWithDraft = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_DRAFT] });
    const actorWithCreate = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
    const actorWithUpdate = createActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
    const actorWithDelete = createActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
    const actorNoPerms = createActor({ permissions: [] });

    it('checkCanViewAttraction allows with DESTINATION_VIEW_PRIVATE', () => {
        expect(() => checkCanViewAttraction(actorWithView)).not.toThrow();
    });
    it('checkCanViewAttraction allows with DESTINATION_VIEW_DRAFT', () => {
        expect(() => checkCanViewAttraction(actorWithDraft)).not.toThrow();
    });
    it('checkCanViewAttraction throws FORBIDDEN without permission', () => {
        expect(() => checkCanViewAttraction(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanViewAttraction(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });

    it('checkCanListAttractions always allows', () => {
        expect(() => checkCanListAttractions(actorNoPerms)).not.toThrow();
        expect(() => checkCanListAttractions(actorWithView)).not.toThrow();
    });

    it('checkCanCreateAttraction allows with DESTINATION_CREATE', () => {
        expect(() => checkCanCreateAttraction(actorWithCreate)).not.toThrow();
    });
    it('checkCanCreateAttraction throws FORBIDDEN without permission', () => {
        expect(() => checkCanCreateAttraction(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanCreateAttraction(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });

    it('checkCanUpdateAttraction allows with DESTINATION_UPDATE', () => {
        expect(() => checkCanUpdateAttraction(actorWithUpdate)).not.toThrow();
    });
    it('checkCanUpdateAttraction throws FORBIDDEN without permission', () => {
        expect(() => checkCanUpdateAttraction(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanUpdateAttraction(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });

    it('checkCanDeleteAttraction allows with DESTINATION_DELETE', () => {
        expect(() => checkCanDeleteAttraction(actorWithDelete)).not.toThrow();
    });
    it('checkCanDeleteAttraction throws FORBIDDEN without permission', () => {
        expect(() => checkCanDeleteAttraction(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanDeleteAttraction(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
});
