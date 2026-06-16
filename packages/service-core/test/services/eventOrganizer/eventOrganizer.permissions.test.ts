import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkCanAdminList,
    checkCanCreateEventOrganizer,
    checkCanDeleteEventOrganizer,
    checkCanUpdateEventOrganizer
} from '../../../src/services/eventOrganizer/eventOrganizer.permissions';
import type { Actor } from '../../../src/types';

const actorWithPerm: Actor = {
    id: '1',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.EVENT_ORGANIZER_MANAGE]
};
const actorWithoutPerm: Actor = { id: '2', role: RoleEnum.ADMIN, permissions: [] };

describe('eventOrganizer permissions', () => {
    it('allows create if actor has permission', () => {
        expect(() => checkCanCreateEventOrganizer(actorWithPerm)).not.toThrow();
    });
    it('throws if actor lacks permission on create', () => {
        expect(() => checkCanCreateEventOrganizer(actorWithoutPerm)).toThrow();
    });
    it('allows update if actor has permission', () => {
        expect(() => checkCanUpdateEventOrganizer(actorWithPerm)).not.toThrow();
    });
    it('throws if actor lacks permission on update', () => {
        expect(() => checkCanUpdateEventOrganizer(actorWithoutPerm)).toThrow();
    });
    it('allows delete if actor has permission', () => {
        expect(() => checkCanDeleteEventOrganizer(actorWithPerm)).not.toThrow();
    });
    it('throws if actor lacks permission on delete', () => {
        expect(() => checkCanDeleteEventOrganizer(actorWithoutPerm)).toThrow();
    });
    it('throws if actor is USER without permission', () => {
        const user: Actor = { id: '3', role: RoleEnum.USER, permissions: [] };
        expect(() => checkCanCreateEventOrganizer(user)).toThrow();
        expect(() => checkCanUpdateEventOrganizer(user)).toThrow();
        expect(() => checkCanDeleteEventOrganizer(user)).toThrow();
    });
    it('throws if actor is GUEST', () => {
        const guest: Actor = { id: '4', role: RoleEnum.GUEST, permissions: [] };
        expect(() => checkCanCreateEventOrganizer(guest)).toThrow();
        expect(() => checkCanUpdateEventOrganizer(guest)).toThrow();
        expect(() => checkCanDeleteEventOrganizer(guest)).toThrow();
    });
    it('allows SUPER_ADMIN with permission', () => {
        const superAdmin: Actor = {
            id: '5',
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.EVENT_ORGANIZER_MANAGE]
        };
        expect(() => checkCanCreateEventOrganizer(superAdmin)).not.toThrow();
        expect(() => checkCanUpdateEventOrganizer(superAdmin)).not.toThrow();
        expect(() => checkCanDeleteEventOrganizer(superAdmin)).not.toThrow();
    });
    it('throws if actor has irrelevant permissions', () => {
        const actor: Actor = {
            id: '6',
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.TAG_SYSTEM_VIEW]
        };
        expect(() => checkCanCreateEventOrganizer(actor)).toThrow();
        expect(() => checkCanUpdateEventOrganizer(actor)).toThrow();
        expect(() => checkCanDeleteEventOrganizer(actor)).toThrow();
    });
    it('allows if actor has multiple permissions including required', () => {
        const actor: Actor = {
            id: '7',
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.TAG_SYSTEM_VIEW, PermissionEnum.EVENT_ORGANIZER_MANAGE]
        };
        expect(() => checkCanCreateEventOrganizer(actor)).not.toThrow();
        expect(() => checkCanUpdateEventOrganizer(actor)).not.toThrow();
        expect(() => checkCanDeleteEventOrganizer(actor)).not.toThrow();
    });
    it('throws if actor is null', () => {
        // @ts-expect-error
        expect(() => checkCanCreateEventOrganizer(null)).toThrow();
    });

    describe('checkCanAdminList', () => {
        it('should allow actor with EVENT_ORGANIZER_VIEW permission', () => {
            const actor: Actor = {
                id: 'eo-admin',
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.EVENT_ORGANIZER_VIEW]
            };
            expect(() => checkCanAdminList(actor)).not.toThrow();
        });

        it('should throw FORBIDDEN when actor lacks EVENT_ORGANIZER_VIEW permission', () => {
            expect(() => checkCanAdminList(actorWithoutPerm)).toThrow();
        });

        it('should throw FORBIDDEN when actor is null', () => {
            // @ts-expect-error
            expect(() => checkCanAdminList(null)).toThrow();
        });
    });
});
