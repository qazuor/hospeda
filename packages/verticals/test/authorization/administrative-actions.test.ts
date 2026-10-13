import { PermissionEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { resolveAdministrativeActionStep } from '../../src/authorization/administrative-action-step';
import {
    ADMINISTRATIVE_ACTION_PERMISSION_SET,
    ADMINISTRATIVE_ACTION_PERMISSIONS,
    ADMINISTRATIVE_ACTIONS,
    isAdministrativeActionPermitted,
    RETIRING_ADMINISTRATIVE_PERMISSIONS,
    SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET
} from '../../src/authorization/administrative-actions';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';

describe('TEST:V5:14 — la cadena rechaza al actor de sistema', () => {
    it('contains exactly the 25 live NUCLEO/08 §3 actions', () => {
        const expected = [
            ...Array.from({ length: 15 }, (_, index) => `ACC_${index + 1}`),
            ...Array.from({ length: 10 }, (_, index) => `ACC_${index + 17}`)
        ];
        expect(ADMINISTRATIVE_ACTIONS).toEqual(expected);
        expect(ADMINISTRATIVE_ACTIONS).toHaveLength(25);
        expect(ADMINISTRATIVE_ACTIONS).not.toContain('ACC_16');
        expect(Object.keys(ADMINISTRATIVE_ACTION_PERMISSIONS)).toEqual(expected);
    });

    it.each(ADMINISTRATIVE_ACTIONS)('refuses a system actor for %s', (action) => {
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId: 'system',
                subjectId: 'owner',
                permitted: true,
                isSystemActor: true
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });

    it.each(ADMINISTRATIVE_ACTIONS)('keeps the person and subject checks for %s', (action) => {
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId: 'admin',
                subjectId: 'owner',
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: true });
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId: 'owner',
                subjectId: 'owner',
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });

    it('refuses a system actor on a foreign listing before step 4', async () => {
        const billing = { coverage: vi.fn(async () => ({ covered: false, sources: [] })) };
        const effectiveSet = vi.fn(async () => {
            throw new Error('step 6 must not run');
        });
        const result = await resolveListingAccess({
            actorId: 'system',
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
            operation: 'EDIT',
            adminAction: { action: 'ACC_15', permitted: true, isSystemActor: true },
            billing,
            effectiveSet
        });
        expect(result).toEqual({ allowed: false, reason: 'FORBIDDEN' });
        expect('evaluatedSteps' in result).toBe(false);
        expect(billing.coverage).not.toHaveBeenCalled();
        expect(effectiveSet).not.toHaveBeenCalled();
    });

    it('collects exactly the permissions in the 25 rows', () => {
        const fromRows = new Set(
            ADMINISTRATIVE_ACTIONS.flatMap(
                (action) => ADMINISTRATIVE_ACTION_PERMISSIONS[action].permissions
            )
        );
        expect(
            ADMINISTRATIVE_ACTION_PERMISSION_SET.has(PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT)
        ).toBe(true);
        expect([...ADMINISTRATIVE_ACTION_PERMISSION_SET].sort()).toEqual([...fromRows].sort());
    });

    it('TEST:V6:12 assigns ACC_12 only the shared action 13 permission', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_12).toEqual({
            permissions: [PermissionEnum.LISTING_MODERATE],
            pendingOwnPermission: null
        });
    });

    it('TEST:V8a:10 assigns ACC_23 only its own purge-on-request permission', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_23).toEqual({
            permissions: [PermissionEnum.LISTING_PURGE_ON_REQUEST],
            pendingOwnPermission: null
        });
        expect(
            ADMINISTRATIVE_ACTION_PERMISSION_SET.has(PermissionEnum.LISTING_PURGE_ON_REQUEST)
        ).toBe(true);
    });

    it('TEST:B5:6 assigns ACC_14 only its own settle-external permission', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_14).toEqual({
            permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL],
            pendingOwnPermission: null
        });
        expect(
            ADMINISTRATIVE_ACTION_PERMISSION_SET.has(PermissionEnum.BILLING_SETTLE_EXTERNAL)
        ).toBe(true);
        expect(
            SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(PermissionEnum.BILLING_SETTLE_EXTERNAL)
        ).toBe(true);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_14',
                actorPermissions: [
                    PermissionEnum.REFUND_PROCESS,
                    PermissionEnum.PAYMENT_REFUND,
                    PermissionEnum.REFUND_APPROVE,
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
                    PermissionEnum.PARTNER_MANAGE,
                    PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT
                ]
            })
        ).toBe(false);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_14',
                actorPermissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
            })
        ).toBe(true);
    });

    it('HOS-1543 assigns ACC_8 only its own cancel-subscription permission (base of S36)', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_8).toEqual({
            permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
            pendingOwnPermission: null
        });
        expect(
            ADMINISTRATIVE_ACTION_PERMISSION_SET.has(PermissionEnum.BILLING_CANCEL_SUBSCRIPTION)
        ).toBe(true);
        expect(
            SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(PermissionEnum.BILLING_CANCEL_SUBSCRIPTION)
        ).toBe(true);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_8',
                actorPermissions: [
                    PermissionEnum.BILLING_SETTLE_EXTERNAL,
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
                    PermissionEnum.BILLING_SETTINGS_WRITE,
                    PermissionEnum.PAYMENT_REFUND,
                    PermissionEnum.REFUND_PROCESS
                ]
            })
        ).toBe(false);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_8',
                actorPermissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
            })
        ).toBe(true);
    });

    it('TEST:V8a:15 assigns ACC_24 only its own close-on-request permission', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_24).toEqual({
            permissions: [PermissionEnum.USER_CLOSE_ON_REQUEST],
            pendingOwnPermission: null
        });
        expect(ADMINISTRATIVE_ACTION_PERMISSION_SET.has(PermissionEnum.USER_CLOSE_ON_REQUEST)).toBe(
            true
        );
    });

    it('TEST:V8a:15 opens ACC_24 only with its own permission, and never another action', () => {
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_24',
                actorPermissions: [PermissionEnum.USER_DELETE, PermissionEnum.USER_HARD_DELETE]
            })
        ).toBe(false);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_24',
                actorPermissions: [PermissionEnum.USER_CLOSE_ON_REQUEST]
            })
        ).toBe(true);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_23',
                actorPermissions: [PermissionEnum.USER_CLOSE_ON_REQUEST]
            })
        ).toBe(false);
    });

    it('TEST:V8a:10 TEST:V8a:15 keeps the six retiring delete permissions forbidden to a system actor', () => {
        const retiring = [
            { permission: PermissionEnum.ACCOMMODATION_DELETE_ANY, formerAction: 'ACC_23' },
            { permission: PermissionEnum.ACCOMMODATION_HARD_DELETE, formerAction: 'ACC_23' },
            { permission: PermissionEnum.GASTRONOMY_DELETE, formerAction: 'ACC_23' },
            { permission: PermissionEnum.EXPERIENCE_DELETE, formerAction: 'ACC_23' },
            { permission: PermissionEnum.USER_DELETE, formerAction: 'ACC_24' },
            { permission: PermissionEnum.USER_HARD_DELETE, formerAction: 'ACC_24' }
        ];
        expect(RETIRING_ADMINISTRATIVE_PERMISSIONS).toEqual(retiring);
        for (const { permission } of retiring) {
            expect(ADMINISTRATIVE_ACTION_PERMISSION_SET.has(permission)).toBe(false);
            expect(SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(permission)).toBe(true);
        }
        for (const permission of ADMINISTRATIVE_ACTION_PERMISSION_SET) {
            expect(SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(permission)).toBe(true);
        }
    });
});
