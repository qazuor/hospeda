import { LifecycleStatusEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanAdminList,
    checkCanCreateAttraction,
    checkCanDeleteAttraction,
    checkCanListAttractions,
    checkCanUpdateAttraction,
    checkCanViewAttraction
} from '../../../src/services/attraction/attraction.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';

describe('Attraction permissions', () => {
    const actorWithView = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE] });
    const actorWithDraft = createActor({ permissions: [PermissionEnum.DESTINATION_VIEW_DRAFT] });
    const actorWithCreate = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
    const actorWithUpdate = createActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
    const actorWithDelete = createActor({ permissions: [PermissionEnum.DESTINATION_DELETE] });
    const actorNoPerms = createActor({ permissions: [] });

    describe('checkCanViewAttraction', () => {
        // Regression: this used to take the actor ALONE and return without
        // throwing only for DESTINATION_VIEW_PRIVATE/DRAFT holders, so every
        // anonymous visitor got a 403 and all 920 attraction detail pages were
        // unreachable. The previous test asserted exactly that broken behaviour,
        // which is why the bug survived.
        const activeAttraction = AttractionFactoryBuilder.create({
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        const draftAttraction = AttractionFactoryBuilder.create({
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        const archivedAttraction = AttractionFactoryBuilder.create({
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        });

        function codeOf(fn: () => void): ServiceErrorCode | undefined {
            try {
                fn();
            } catch (err) {
                return (err as ServiceError).code as ServiceErrorCode;
            }
            return undefined;
        }

        it('allows an actor with no permissions to view an ACTIVE attraction', () => {
            expect(() => checkCanViewAttraction(actorNoPerms, activeAttraction)).not.toThrow();
        });

        it('allows a privileged actor to view an ACTIVE attraction', () => {
            expect(() => checkCanViewAttraction(actorWithView, activeAttraction)).not.toThrow();
            expect(() => checkCanViewAttraction(actorWithDraft, activeAttraction)).not.toThrow();
        });

        it('forbids an unprivileged actor on a DRAFT attraction', () => {
            expect(codeOf(() => checkCanViewAttraction(actorNoPerms, draftAttraction))).toBe(
                ServiceErrorCode.FORBIDDEN
            );
        });

        it('forbids an unprivileged actor on an ARCHIVED attraction', () => {
            expect(codeOf(() => checkCanViewAttraction(actorNoPerms, archivedAttraction))).toBe(
                ServiceErrorCode.FORBIDDEN
            );
        });

        it('allows a privileged actor on non-published attractions', () => {
            expect(() => checkCanViewAttraction(actorWithDraft, draftAttraction)).not.toThrow();
            expect(() => checkCanViewAttraction(actorWithView, archivedAttraction)).not.toThrow();
        });

        it('reports a soft-deleted ACTIVE attraction as GONE, not as a 200', () => {
            const deleted = AttractionFactoryBuilder.create({
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                deletedAt: new Date()
            });
            expect(codeOf(() => checkCanViewAttraction(actorNoPerms, deleted))).toBe(
                ServiceErrorCode.GONE
            );
        });

        it('reports a soft-deleted never-published attraction as NOT_FOUND', () => {
            // Anti-enumeration: a URL that was never public must not reveal that
            // the row ever existed.
            const deletedDraft = AttractionFactoryBuilder.create({
                lifecycleState: LifecycleStatusEnum.DRAFT,
                deletedAt: new Date()
            });
            expect(codeOf(() => checkCanViewAttraction(actorNoPerms, deletedDraft))).toBe(
                ServiceErrorCode.NOT_FOUND
            );
        });

        it('still lets a privileged actor read a soft-deleted attraction for management', () => {
            const deleted = AttractionFactoryBuilder.create({
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                deletedAt: new Date()
            });
            expect(() => checkCanViewAttraction(actorWithView, deleted)).not.toThrow();
        });
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

    it('checkCanAdminList allows with ATTRACTION_VIEW', () => {
        const actorWithAttractionView = createActor({
            permissions: [PermissionEnum.ATTRACTION_VIEW]
        });
        expect(() => checkCanAdminList(actorWithAttractionView)).not.toThrow();
    });

    it('checkCanAdminList throws FORBIDDEN without ATTRACTION_VIEW', () => {
        expect(() => checkCanAdminList(actorNoPerms)).toThrowError(ServiceError);
        try {
            checkCanAdminList(actorNoPerms);
        } catch (err) {
            expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
        }
    });
});
