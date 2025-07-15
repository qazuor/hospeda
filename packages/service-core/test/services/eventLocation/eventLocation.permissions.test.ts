import { PermissionEnum, RoleEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    checkCanCreateEventLocation,
    checkCanDeleteEventLocation,
    checkCanUpdateEventLocation
} from '../../../src/services/eventLocation/eventLocation.permissions';
import type { Actor } from '../../../src/types';

const actorWithPerm: Actor = {
    id: '1',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.EVENT_LOCATION_UPDATE]
};
const actorWithoutPerm: Actor = { id: '2', role: RoleEnum.ADMIN, permissions: [] };

describe('eventLocation permissions', () => {
    it('allows create if actor has permission', () => {
        expect(() => checkCanCreateEventLocation(actorWithPerm)).not.toThrow();
    });
    it('throws if actor lacks permission on create', () => {
        expect(() => checkCanCreateEventLocation(actorWithoutPerm)).toThrow();
    });
    it('allows update if actor has permission', () => {
        expect(() => checkCanUpdateEventLocation(actorWithPerm)).not.toThrow();
    });
    it('throws if actor lacks permission on update', () => {
        expect(() => checkCanUpdateEventLocation(actorWithoutPerm)).toThrow();
    });
    it('allows delete if actor has permission', () => {
        expect(() => checkCanDeleteEventLocation(actorWithPerm)).not.toThrow();
    });
    it('throws if actor lacks permission on delete', () => {
        expect(() => checkCanDeleteEventLocation(actorWithoutPerm)).toThrow();
    });
    it('throws if actor is USER without permission', () => {
        const user: Actor = { id: '3', role: RoleEnum.USER, permissions: [] };
        expect(() => checkCanCreateEventLocation(user)).toThrow();
        expect(() => checkCanUpdateEventLocation(user)).toThrow();
        expect(() => checkCanDeleteEventLocation(user)).toThrow();
    });
    it('throws if actor is GUEST', () => {
        const guest: Actor = { id: '4', role: RoleEnum.GUEST, permissions: [] };
        expect(() => checkCanCreateEventLocation(guest)).toThrow();
        expect(() => checkCanUpdateEventLocation(guest)).toThrow();
        expect(() => checkCanDeleteEventLocation(guest)).toThrow();
    });
    it('allows SUPER_ADMIN with permission', () => {
        const superAdmin: Actor = {
            id: '5',
            role: RoleEnum.SUPER_ADMIN,
            permissions: [PermissionEnum.EVENT_LOCATION_UPDATE]
        };
        expect(() => checkCanCreateEventLocation(superAdmin)).not.toThrow();
        expect(() => checkCanUpdateEventLocation(superAdmin)).not.toThrow();
        expect(() => checkCanDeleteEventLocation(superAdmin)).not.toThrow();
    });
    it('throws if actor has irrelevant permissions', () => {
        const actor: Actor = {
            id: '6',
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.TAG_UPDATE]
        };
        expect(() => checkCanCreateEventLocation(actor)).toThrow();
        expect(() => checkCanUpdateEventLocation(actor)).toThrow();
        expect(() => checkCanDeleteEventLocation(actor)).toThrow();
    });
    it('allows if actor has multiple permissions including required', () => {
        const actor: Actor = {
            id: '7',
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.TAG_UPDATE, PermissionEnum.EVENT_LOCATION_UPDATE]
        };
        expect(() => checkCanCreateEventLocation(actor)).not.toThrow();
        expect(() => checkCanUpdateEventLocation(actor)).not.toThrow();
        expect(() => checkCanDeleteEventLocation(actor)).not.toThrow();
    });
    it('throws if actor is null', () => {
        // @ts-expect-error
        expect(() => checkCanCreateEventLocation(null)).toThrow();
    });
});
