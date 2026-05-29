/**
 * @fileoverview
 * SPEC-169 AC-6 regression test — the systemic guard for the whole permission model.
 *
 * Asserts that no NON-STAFF role holds a broad view grant (_VIEW_ALL / _READ_ALL / _VIEW_PRIVATE)
 * unless it is in the documented allow-list below with an explicit rationale. This is what protects
 * EVERY entity going forward: if anyone re-grants a broad permission to a non-staff role (the exact
 * mistake that caused the HOST accommodation leak), this test fails.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../src/required/rolePermissions.seed';

/** Enum KEYS ending in one of these are "broad" view grants. */
const BROAD_SUFFIXES = ['_VIEW_ALL', '_READ_ALL', '_VIEW_PRIVATE'] as const;

/** Staff roles are allowed broad grants by definition. */
const STAFF_ROLES = new Set<RoleEnum>([RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]);

/** Reverse lookup: permission VALUE (e.g. 'accommodation.viewAll') → enum KEY (e.g. ACCOMMODATION_VIEW_ALL). */
const VALUE_TO_KEY = new Map<string, string>(
    Object.entries(PermissionEnum).map(([key, value]) => [value as string, key])
);

const isBroadGrant = (permissionValue: PermissionEnum): boolean => {
    const key = VALUE_TO_KEY.get(permissionValue) ?? '';
    return BROAD_SUFFIXES.some((suffix) => key.endsWith(suffix));
};

/**
 * Documented allow-list of broad grants per non-staff role.
 * Anything broad outside this list fails the audit.
 */
const ALLOWED_BROAD_GRANTS: Partial<Record<RoleEnum, readonly PermissionEnum[]>> = {
    // LEGITIMATE (SPEC-169 §3, owner-confirmed): the editorial role sees all editorial content
    // (posts + events, incl. private) by design. SUPER_ADMIN can narrow per-user via overrides.
    [RoleEnum.EDITOR]: [
        PermissionEnum.POST_VIEW_ALL,
        PermissionEnum.POST_VIEW_PRIVATE,
        PermissionEnum.EVENT_VIEW_ALL,
        PermissionEnum.EVENT_VIEW_PRIVATE
    ],
    // KNOWN DEBT (SPEC-169 §11 / §8 Q2): CLIENT_MANAGER is unused and deferred to a future spec —
    // these grants are NOT endorsed, they are tracked debt, listed so the audit passes until the
    // role is activated and tightened. Removing CLIENT_MANAGER from this list is the trigger to fix it.
    [RoleEnum.CLIENT_MANAGER]: [
        PermissionEnum.ACCOMMODATION_VIEW_ALL,
        PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
        PermissionEnum.DESTINATION_VIEW_ALL,
        PermissionEnum.DESTINATION_VIEW_PRIVATE,
        PermissionEnum.USER_READ_ALL
    ]
};

const NON_STAFF_ROLES = (Object.values(RoleEnum) as RoleEnum[]).filter(
    (role) => !STAFF_ROLES.has(role)
);

describe('SPEC-169 AC-6 — role permission audit (broad grants)', () => {
    it('HOST holds NO broad view grant — the closed accommodation leak', () => {
        const hostBroad = (ROLE_PERMISSIONS[RoleEnum.HOST] ?? []).filter(isBroadGrant);
        expect(hostBroad).toEqual([]);
        expect(ROLE_PERMISSIONS[RoleEnum.HOST]).not.toContain(
            PermissionEnum.ACCOMMODATION_VIEW_ALL
        );
    });

    it('HOST holds ACCOMMODATION_VIEW_OWN (the owner-scoped replacement)', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.HOST]).toContain(PermissionEnum.ACCOMMODATION_VIEW_OWN);
    });

    for (const role of NON_STAFF_ROLES) {
        it(`${role} holds no broad grant outside the documented allow-list`, () => {
            const allowed = new Set(ALLOWED_BROAD_GRANTS[role] ?? []);
            const offending = (ROLE_PERMISSIONS[role] ?? []).filter(
                (permission) => isBroadGrant(permission) && !allowed.has(permission)
            );
            expect(offending).toEqual([]);
        });
    }

    it('EDITOR keeps exactly its documented editorial broad grants', () => {
        const editorBroad = (ROLE_PERMISSIONS[RoleEnum.EDITOR] ?? []).filter(isBroadGrant);
        expect([...editorBroad].sort()).toEqual([...ALLOWED_BROAD_GRANTS[RoleEnum.EDITOR]!].sort());
    });
});
