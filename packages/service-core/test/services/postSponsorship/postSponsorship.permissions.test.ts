import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanAdminList,
    checkCanManagePostSponsorship
} from '../../../src/services/postSponsorship/postSponsorship.permissions';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';

describe('postSponsorship.permissions', () => {
    it('should allow if actor has POST_SPONSOR_MANAGE permission', () => {
        const actor = createActor({ permissions: [PermissionEnum.POST_SPONSOR_MANAGE] });
        expect(() => checkCanManagePostSponsorship(actor)).not.toThrow();
    });
    it('should throw FORBIDDEN if actor lacks POST_SPONSOR_MANAGE permission', () => {
        const actor = createActor({ permissions: [] });
        try {
            checkCanManagePostSponsorship(actor);
            throw new Error('Should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        }
    });
    it('should throw FORBIDDEN if actor is undefined', () => {
        // @ts-expect-error purposely passing undefined
        expect(() => checkCanManagePostSponsorship(undefined)).toThrow(ServiceError);
    });

    describe('checkCanAdminList', () => {
        it('should allow actor with POST_SPONSORSHIP_VIEW permission', () => {
            const actor = createActor({ permissions: [PermissionEnum.POST_SPONSORSHIP_VIEW] });
            expect(() => checkCanAdminList(actor)).not.toThrow();
        });

        it('should throw FORBIDDEN when actor lacks POST_SPONSORSHIP_VIEW permission', () => {
            const actor = createActor({ permissions: [] });
            expect(() => checkCanAdminList(actor)).toThrowError(ServiceError);
            try {
                checkCanAdminList(actor);
            } catch (err) {
                expect((err as ServiceError).code).toBe(ServiceErrorCode.FORBIDDEN);
            }
        });
    });
});
