import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import {
    stripStaffBypassPermissions,
    UNVERIFIED_STAFF_BYPASS_PERMISSIONS
} from '../../src/middlewares/step2-staff-bypass';

describe('TEST:1692:6 stripStaffBypassPermissions drops only the staff bypass set', () => {
    it('keeps only the two own-read permissions', () => {
        const actor: Actor = {
            id: '11111111-1111-4111-8111-111111111111',
            roles: [RoleEnum.USER],
            permissions: [
                ...UNVERIFIED_STAFF_BYPASS_PERMISSIONS,
                PermissionEnum.BILLING_VIEW_OWN,
                PermissionEnum.ACCOMMODATION_VIEW_OWN
            ]
        };
        const result = stripStaffBypassPermissions({ actor });
        expect(result.actor.permissions).toEqual([
            PermissionEnum.BILLING_VIEW_OWN,
            PermissionEnum.ACCOMMODATION_VIEW_OWN
        ]);
    });

    it('returns the same actor when it has no staff bypass permission', () => {
        const actor: Actor = {
            id: '11111111-1111-4111-8111-111111111111',
            roles: [RoleEnum.USER],
            permissions: [PermissionEnum.BILLING_VIEW_OWN, PermissionEnum.ACCOMMODATION_VIEW_OWN]
        };
        expect(stripStaffBypassPermissions({ actor }).actor).toBe(actor);
    });

    it('does not mutate the original actor', () => {
        const actor: Actor = {
            id: '11111111-1111-4111-8111-111111111111',
            roles: [RoleEnum.USER],
            permissions: [
                ...UNVERIFIED_STAFF_BYPASS_PERMISSIONS,
                PermissionEnum.BILLING_VIEW_OWN,
                PermissionEnum.ACCOMMODATION_VIEW_OWN
            ]
        };
        stripStaffBypassPermissions({ actor });
        expect(actor.permissions).toHaveLength(9);
    });

    it('defines seven distinct permissions', () => {
        expect(UNVERIFIED_STAFF_BYPASS_PERMISSIONS).toHaveLength(7);
        expect(new Set(UNVERIFIED_STAFF_BYPASS_PERMISSIONS).size).toBe(7);
    });
});
