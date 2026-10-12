import { PermissionEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { resolveAdministrativeActionStep } from '../../src/authorization/administrative-action-step';
import {
    ADMINISTRATIVE_ACTION_PERMISSION_SET,
    ADMINISTRATIVE_ACTION_PERMISSIONS,
    ADMINISTRATIVE_ACTIONS,
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

    it('TEST:V8a:10 keeps the four retiring delete permissions forbidden to a system actor', () => {
        const retiring = [
            PermissionEnum.ACCOMMODATION_DELETE_ANY,
            PermissionEnum.ACCOMMODATION_HARD_DELETE,
            PermissionEnum.GASTRONOMY_DELETE,
            PermissionEnum.EXPERIENCE_DELETE
        ];
        expect(RETIRING_ADMINISTRATIVE_PERMISSIONS.map((entry) => entry.permission)).toEqual(
            retiring
        );
        for (const permission of retiring) {
            expect(ADMINISTRATIVE_ACTION_PERMISSION_SET.has(permission)).toBe(false);
            expect(SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(permission)).toBe(true);
        }
        for (const permission of ADMINISTRATIVE_ACTION_PERMISSION_SET) {
            expect(SYSTEM_ACTOR_FORBIDDEN_PERMISSION_SET.has(permission)).toBe(true);
        }
    });
});
