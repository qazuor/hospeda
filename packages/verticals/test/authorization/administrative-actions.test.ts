import {
    PermissionEnum,
    PublicationStatusEnum,
    VerticalEnum,
    withoutSuperAdminExclusivePermissions
} from '@repo/schemas';
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

    it('TEST:1697:4 AC:1697:1 assigns ACC_7 only its own lift-reconciliation-mark permission', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_7).toEqual({
            permissions: [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK],
            pendingOwnPermission: null
        });
        expect(
            ADMINISTRATIVE_ACTION_PERMISSION_SET.has(
                PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK
            )
        ).toBe(true);
        expect(
            SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(
                PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK
            )
        ).toBe(true);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_7',
                actorPermissions: [
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
                    PermissionEnum.BILLING_SETTLE_EXTERNAL,
                    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
                ]
            })
        ).toBe(false);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_7',
                actorPermissions: [PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK]
            })
        ).toBe(true);
    });

    it('TEST:B9b:9 (support) assigns ACC_21 only its own promo code permission', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_21).toEqual({
            permissions: [PermissionEnum.BILLING_MANAGE_PROMO_CODES],
            pendingOwnPermission: null
        });
        expect(
            ADMINISTRATIVE_ACTION_PERMISSION_SET.has(PermissionEnum.BILLING_MANAGE_PROMO_CODES)
        ).toBe(true);
        expect(
            SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(PermissionEnum.BILLING_MANAGE_PROMO_CODES)
        ).toBe(true);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_21',
                actorPermissions: [
                    PermissionEnum.BILLING_GRANT_COMPLIMENTARY,
                    PermissionEnum.BILLING_SETTLE_EXTERNAL,
                    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION,
                    PermissionEnum.MAINTENANCE_MODE_WRITE,
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
                ]
            })
        ).toBe(false);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_21',
                actorPermissions: [PermissionEnum.BILLING_MANAGE_PROMO_CODES]
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

    it('HOS-1689 assigns ACC_11 only its own trial-extend permission', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_11).toEqual({
            permissions: [PermissionEnum.TRIAL_EXTEND],
            pendingOwnPermission: null
        });
        expect(ADMINISTRATIVE_ACTION_PERMISSION_SET.has(PermissionEnum.TRIAL_EXTEND)).toBe(true);
        expect(SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(PermissionEnum.TRIAL_EXTEND)).toBe(true);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_11',
                actorPermissions: [
                    PermissionEnum.BILLING_GRANT_COMPLIMENTARY,
                    PermissionEnum.MAINTENANCE_MODE_WRITE,
                    PermissionEnum.PARTNER_MANAGE
                ]
            })
        ).toBe(false);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_11',
                actorPermissions: [PermissionEnum.TRIAL_EXTEND]
            })
        ).toBe(true);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_1',
                actorPermissions: [PermissionEnum.TRIAL_EXTEND]
            })
        ).toBe(false);
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

    it('TEST:V8a:10 TEST:V8a:15 keeps the seven retiring administrative permissions forbidden to a system actor', () => {
        const retiring = [
            { permission: PermissionEnum.ACCOMMODATION_DELETE_ANY, formerAction: 'ACC_23' },
            { permission: PermissionEnum.ACCOMMODATION_HARD_DELETE, formerAction: 'ACC_23' },
            { permission: PermissionEnum.GASTRONOMY_DELETE, formerAction: 'ACC_23' },
            { permission: PermissionEnum.EXPERIENCE_DELETE, formerAction: 'ACC_23' },
            { permission: PermissionEnum.USER_DELETE, formerAction: 'ACC_24' },
            { permission: PermissionEnum.USER_HARD_DELETE, formerAction: 'ACC_24' },
            { permission: PermissionEnum.USER_UPDATE_ROLES, formerAction: 'ACC_26' }
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

describe('TEST:V5:28 HOS-1460 concession and action 26 permissions', () => {
    it('uses one concession permission and an independent action 26 permission', () => {
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_1.permissions).toEqual([
            PermissionEnum.BILLING_GRANT_COMPLIMENTARY
        ]);
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_2.permissions).toEqual([
            PermissionEnum.BILLING_GRANT_COMPLIMENTARY
        ]);
        expect(ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_26.permissions).toEqual([
            PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE
        ]);
    });

    it.each([
        'ACC_1',
        'ACC_2',
        'ACC_26'
    ] as const)('denies the non-exclusive permission ceiling at step 3 for %s', (action) => {
        const permitted = isAdministrativeActionPermitted({
            action,
            actorPermissions: withoutSuperAdminExclusivePermissions({
                permissions: Object.values(PermissionEnum)
            })
        });
        expect(permitted).toBe(false);
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId: 'admin',
                subjectId: 'other',
                permitted,
                isSystemActor: false
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });

    it.each([
        ['ACC_1', PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
        ['ACC_2', PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
        ['ACC_26', PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE]
    ] as const)('allows %s with its own permission for another subject', (action, permission) => {
        expect(isAdministrativeActionPermitted({ action, actorPermissions: [permission] })).toBe(
            true
        );
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId: 'super-admin',
                subjectId: 'other',
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: true });
    });

    it.each([
        'ACC_1',
        'ACC_2',
        'ACC_26'
    ] as const)('rejects self and system actors for %s', (action) => {
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId: 'same',
                subjectId: 'same',
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId: 'admin',
                subjectId: 'other',
                permitted: true,
                isSystemActor: true
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });

    it('does not let either permission open the other action', () => {
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_26',
                actorPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
            })
        ).toBe(false);
        expect(
            isAdministrativeActionPermitted({
                action: 'ACC_1',
                actorPermissions: [PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE]
            })
        ).toBe(false);
    });

    it('keeps new and retiring permissions forbidden to system actors', () => {
        for (const permission of [
            PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE,
            PermissionEnum.BILLING_GRANT_COMPLIMENTARY,
            PermissionEnum.MAINTENANCE_MODE_WRITE,
            PermissionEnum.USER_UPDATE_ROLES
        ])
            expect(SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(permission)).toBe(true);
        expect(ADMINISTRATIVE_ACTION_PERMISSION_SET.has(PermissionEnum.USER_UPDATE_ROLES)).toBe(
            false
        );
        expect(RETIRING_ADMINISTRATIVE_PERMISSIONS).toContainEqual({
            permission: PermissionEnum.USER_UPDATE_ROLES,
            formerAction: 'ACC_26'
        });
    });
});
