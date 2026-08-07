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
    // HOS-374 §7.6.2 / OQ-2 (owner-confirmed) REVERSES the SPEC-169 §3 verdict this
    // allow-list used to encode: EDITOR is now scoped to its own content, in both
    // view and edit. It holds no broad grant at all — POST_VIEW_OWN / EVENT_VIEW_OWN
    // replaced POST_VIEW_ALL / POST_VIEW_PRIVATE / EVENT_VIEW_ALL / EVENT_VIEW_PRIVATE.
    // Deliberately no key here (an empty allow-list, same as HOST above).
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

    it('EDITOR holds NO broad view grant — HOS-374 reverses the SPEC-169 editorial exception', () => {
        const editorBroad = (ROLE_PERMISSIONS[RoleEnum.EDITOR] ?? []).filter(isBroadGrant);
        expect(editorBroad).toEqual([]);
        expect(ROLE_PERMISSIONS[RoleEnum.EDITOR]).not.toContain(PermissionEnum.POST_VIEW_ALL);
        expect(ROLE_PERMISSIONS[RoleEnum.EDITOR]).not.toContain(PermissionEnum.EVENT_VIEW_ALL);
    });

    it('EDITOR holds POST_VIEW_OWN / EVENT_VIEW_OWN (the author-scoped replacement)', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.EDITOR]).toContain(PermissionEnum.POST_VIEW_OWN);
        expect(ROLE_PERMISSIONS[RoleEnum.EDITOR]).toContain(PermissionEnum.EVENT_VIEW_OWN);
    });
});

/** All 24 social permissions introduced by SPEC-254. */
const SOCIAL_PERMISSIONS = [
    PermissionEnum.SOCIAL_POST_VIEW,
    PermissionEnum.SOCIAL_POST_CREATE,
    PermissionEnum.SOCIAL_POST_UPDATE,
    PermissionEnum.SOCIAL_POST_APPROVE,
    PermissionEnum.SOCIAL_POST_SCHEDULE,
    PermissionEnum.SOCIAL_POST_PAUSE,
    PermissionEnum.SOCIAL_POST_ARCHIVE,
    PermissionEnum.SOCIAL_POST_HARD_DELETE,
    PermissionEnum.SOCIAL_POST_VIEW_LOGS,
    PermissionEnum.SOCIAL_HASHTAG_VIEW,
    PermissionEnum.SOCIAL_HASHTAG_MANAGE,
    PermissionEnum.SOCIAL_HASHTAG_SET_MANAGE,
    PermissionEnum.SOCIAL_FOOTER_MANAGE,
    PermissionEnum.SOCIAL_CAMPAIGN_MANAGE,
    PermissionEnum.SOCIAL_BATCH_MANAGE,
    PermissionEnum.SOCIAL_AUDIENCE_MANAGE,
    PermissionEnum.SOCIAL_PLATFORM_MANAGE,
    PermissionEnum.SOCIAL_PLATFORM_FORMAT_VIEW,
    PermissionEnum.SOCIAL_ASSET_VIEW,
    PermissionEnum.SOCIAL_ASSET_MANAGE,
    PermissionEnum.SOCIAL_SETTINGS_MANAGE,
    PermissionEnum.SOCIAL_PUBLISH_LOG_VIEW,
    PermissionEnum.SOCIAL_AUDIT_LOG_VIEW,
    PermissionEnum.SOCIAL_DISPATCH_MANAGE
] as const;

describe('SPEC-254 — social media publish pipeline permissions', () => {
    it('SUPER_ADMIN holds all 24 social permissions', () => {
        const superAdminPerms = ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN];
        for (const perm of SOCIAL_PERMISSIONS) {
            expect(superAdminPerms, `SUPER_ADMIN missing ${perm}`).toContain(perm);
        }
        expect(SOCIAL_PERMISSIONS).toHaveLength(24);
    });

    it('ADMIN holds all 24 social permissions', () => {
        const adminPerms = ROLE_PERMISSIONS[RoleEnum.ADMIN];
        for (const perm of SOCIAL_PERMISSIONS) {
            expect(adminPerms, `ADMIN missing ${perm}`).toContain(perm);
        }
    });

    it('no non-staff role holds any social permission', () => {
        const socialSet = new Set<PermissionEnum>(SOCIAL_PERMISSIONS);
        for (const role of NON_STAFF_ROLES) {
            const offending = (ROLE_PERMISSIONS[role] ?? []).filter((p) => socialSet.has(p));
            expect(offending, `${role} should not hold social permissions`).toEqual([]);
        }
    });
});
