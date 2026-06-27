/**
 * Unit tests for the role-permissions seed static data.
 *
 * These tests verify the ROLE_PERMISSIONS constant directly — no database
 * connection is required because the data is a pure in-memory declaration.
 *
 * Literal string values are used instead of @repo/schemas imports to avoid
 * workspace module resolution issues in the Vitest runner (same approach as
 * systemUser.seed.test.ts). Values MUST match packages/schemas/src/enums/
 * permission.enum.ts and role.enum.ts.
 *
 * Focus:
 *   SPEC-155 T-016: EDITOR role newsletter permission grants.
 *   SPEC-164 T-003: ADMIN billing surface revocation (19 perms → SUPER_ADMIN-only).
 */

import { describe, expect, it } from 'vitest';
import { _internals } from '../../src/required/rolePermissions.seed.js';

// Use literal values to avoid workspace resolution issues.
// Must match packages/schemas/src/enums/role.enum.ts and permission.enum.ts.
const EDITOR = 'EDITOR' as const;
const NEWSLETTER_CAMPAIGN_VIEW = 'newsletter.campaign.view' as const;
const NEWSLETTER_CAMPAIGN_WRITE = 'newsletter.campaign.write' as const;
const NEWSLETTER_CAMPAIGN_SEND = 'newsletter.campaign.send' as const;
const NEWSLETTER_SUBSCRIBER_VIEW = 'newsletter.subscriber.view' as const;

const { ROLE_PERMISSIONS } = _internals;

describe('ROLE_PERMISSIONS — EDITOR newsletter permissions (SPEC-155 T-016)', () => {
    // Cast through unknown to satisfy the Record index signature without
    // importing the enums from @repo/schemas.
    const editorPerms = ROLE_PERMISSIONS[EDITOR as unknown as keyof typeof ROLE_PERMISSIONS];

    it('grants NEWSLETTER_CAMPAIGN_VIEW to EDITOR', () => {
        expect(editorPerms).toContain(NEWSLETTER_CAMPAIGN_VIEW);
    });

    it('grants NEWSLETTER_CAMPAIGN_WRITE to EDITOR', () => {
        expect(editorPerms).toContain(NEWSLETTER_CAMPAIGN_WRITE);
    });

    it('grants NEWSLETTER_SUBSCRIBER_VIEW to EDITOR', () => {
        expect(editorPerms).toContain(NEWSLETTER_SUBSCRIBER_VIEW);
    });

    it('does NOT grant NEWSLETTER_CAMPAIGN_SEND to EDITOR (send stays admin-only)', () => {
        expect(editorPerms).not.toContain(NEWSLETTER_CAMPAIGN_SEND);
    });
});

// ---------------------------------------------------------------------------
// SPEC-164 T-003 — Billing surface is SUPER_ADMIN-only
// ---------------------------------------------------------------------------
// Literal permission values from packages/schemas/src/enums/permission.enum.ts.
// Role literal values from packages/schemas/src/enums/role.enum.ts.

const ADMIN = 'ADMIN' as const;
const SUPER_ADMIN = 'SUPER_ADMIN' as const;

/** The 19 permissions revoked from ADMIN by SPEC-164. */
const SPEC_164_REVOKED_PERMS = [
    // Billing (6)
    'billing.readAll',
    'billing.manage',
    'subscription.manage',
    'billing.promoCode.read',
    'billing.promoCode.manage',
    'billing.metrics.read',
    // Sponsorship _ANY (6)
    'sponsorship.view.any',
    'sponsorship.update.any',
    'sponsorship.softDelete.any',
    'sponsorship.hardDelete.any',
    'sponsorship.restore.any',
    'sponsorship.updateVisibility.any',
    // Owner-promotion _ANY (6)
    'ownerPromotion.view.any',
    'ownerPromotion.update.any',
    'ownerPromotion.softDelete.any',
    'ownerPromotion.hardDelete.any',
    'ownerPromotion.restore.any',
    'ownerPromotion.updateVisibility.any',
    // Post-sponsorship (1)
    'post.sponsorship.manage'
] as const;

describe('ROLE_PERMISSIONS — SPEC-164 admin billing surface (SUPER_ADMIN-only)', () => {
    type RoleKey = keyof typeof ROLE_PERMISSIONS;
    const adminPerms = ROLE_PERMISSIONS[ADMIN as unknown as RoleKey] as readonly string[];
    const superAdminPerms = ROLE_PERMISSIONS[
        SUPER_ADMIN as unknown as RoleKey
    ] as readonly string[];

    // AC-15: ADMIN does NOT hold any of the 19 revoked permissions.
    describe('AC-15: ADMIN does not hold any of the 19 revoked billing permissions', () => {
        it('has exactly 19 permissions in the revoked list', () => {
            // Arrange / Act
            const count = SPEC_164_REVOKED_PERMS.length;
            // Assert
            expect(count).toBe(19);
        });

        for (const perm of SPEC_164_REVOKED_PERMS) {
            it(`does NOT grant "${perm}" to ADMIN`, () => {
                expect(adminPerms).not.toContain(perm);
            });
        }
    });

    // AC-16: ADMIN still holds POST_SPONSOR_MANAGE and ACCESS_PANEL_ADMIN.
    describe('AC-16: ADMIN still holds non-revoked permissions', () => {
        it('grants "post.sponsor.manage" to ADMIN (distinct from post.sponsorship.manage)', () => {
            expect(adminPerms).toContain('post.sponsor.manage');
        });

        it('grants "access.panelAdmin" to ADMIN', () => {
            expect(adminPerms).toContain('access.panelAdmin');
        });
    });

    // AC-17: SUPER_ADMIN seed list still contains all 19 permissions.
    describe('AC-17: SUPER_ADMIN seed list retains all 19 billing permissions', () => {
        for (const perm of SPEC_164_REVOKED_PERMS) {
            it(`grants "${perm}" to SUPER_ADMIN`, () => {
                expect(superAdminPerms).toContain(perm);
            });
        }
    });
});

// ---------------------------------------------------------------------------
// SPEC-170 T-011 — Per-user permission-management trio seeded to SUPER_ADMIN
// ---------------------------------------------------------------------------
// Literal permission values from packages/schemas/src/enums/permission.enum.ts.
// Seeding these explicitly stops the panel gate from relying on the
// all-permissions short-circuit; they remain SUPER_ADMIN-only.

const PERMISSION_MANAGEMENT_TRIO = [
    'permission.view',
    'permission.assign',
    'permission.revoke'
] as const;

describe('ROLE_PERMISSIONS — SPEC-170 permission-management gate (SUPER_ADMIN-only)', () => {
    type RoleKey = keyof typeof ROLE_PERMISSIONS;
    const superAdminPerms = ROLE_PERMISSIONS[
        SUPER_ADMIN as unknown as RoleKey
    ] as readonly string[];
    const adminPerms = ROLE_PERMISSIONS[ADMIN as unknown as RoleKey] as readonly string[];

    for (const perm of PERMISSION_MANAGEMENT_TRIO) {
        it(`grants "${perm}" to SUPER_ADMIN`, () => {
            expect(superAdminPerms).toContain(perm);
        });

        it(`does NOT grant "${perm}" to ADMIN`, () => {
            expect(adminPerms).not.toContain(perm);
        });
    }
});

// ---------------------------------------------------------------------------
// SPEC-271 — Partner admin permissions seeded to staff roles
// ---------------------------------------------------------------------------

describe('ROLE_PERMISSIONS — SPEC-271 partner admin grants', () => {
    type RoleKey = keyof typeof ROLE_PERMISSIONS;
    const superAdminPerms = ROLE_PERMISSIONS[
        SUPER_ADMIN as unknown as RoleKey
    ] as readonly string[];
    const adminPerms = ROLE_PERMISSIONS[ADMIN as unknown as RoleKey] as readonly string[];

    for (const perm of ['partner.viewAll', 'partner.manage'] as const) {
        it(`grants "${perm}" to SUPER_ADMIN`, () => {
            expect(superAdminPerms).toContain(perm);
        });

        it(`grants "${perm}" to ADMIN`, () => {
            expect(adminPerms).toContain(perm);
        });
    }
});

// ---------------------------------------------------------------------------
// SPEC-156 — Platform Settings V1 role bundle assignments (D1, AC-22..AC-27)
// ---------------------------------------------------------------------------
// Literal permission values from packages/schemas/src/enums/permission.enum.ts
// (SPEC-156 block). Role literals from role.enum.ts.

const HOST = 'HOST' as const;
const CLIENT_MANAGER = 'CLIENT_MANAGER' as const;
const SPONSOR = 'SPONSOR' as const;
const USER = 'USER' as const;
const GUEST = 'GUEST' as const;
const SYSTEM = 'SYSTEM' as const;

const SETTINGS_GENERAL_VIEW = 'settings.general.view' as const;
const SETTINGS_GENERAL_WRITE = 'settings.general.write' as const;
const MAINTENANCE_MODE_WRITE = 'system.maintenanceMode.write' as const;
const BILLING_SETTINGS_VIEW = 'billing.settings.view' as const;
const BILLING_SETTINGS_WRITE = 'billing.settings.write' as const;
const BILLING_VIEW_OWN = 'billing.view.own' as const;
const SUBSCRIPTION_VIEW_OWN = 'subscription.view.own' as const;
const USER_UPDATE_SELF = 'user.update.self' as const;
const BILLING_READ_ALL = 'billing.readAll' as const;

const ALL_SPEC_156_PERMS = [
    SETTINGS_GENERAL_VIEW,
    SETTINGS_GENERAL_WRITE,
    MAINTENANCE_MODE_WRITE,
    BILLING_SETTINGS_VIEW,
    BILLING_SETTINGS_WRITE,
    BILLING_VIEW_OWN,
    SUBSCRIPTION_VIEW_OWN,
    USER_UPDATE_SELF
] as const;

describe('ROLE_PERMISSIONS — SPEC-156 Platform Settings V1 (D1)', () => {
    type RoleKey = keyof typeof ROLE_PERMISSIONS;
    const get = (role: string): readonly string[] =>
        ROLE_PERMISSIONS[role as unknown as RoleKey] as readonly string[];

    const superAdmin = get(SUPER_ADMIN);
    const admin = get(ADMIN);
    const host = get(HOST);
    const editor = get(EDITOR);
    const clientManager = get(CLIENT_MANAGER);
    const sponsor = get(SPONSOR);
    const user = get(USER);
    const guest = get(GUEST);
    const system = get(SYSTEM);

    describe('SUPER_ADMIN holds the full set (all 8 new perms)', () => {
        for (const perm of ALL_SPEC_156_PERMS) {
            it(`grants "${perm}" to SUPER_ADMIN`, () => {
                expect(superAdmin).toContain(perm);
            });
        }
    });

    describe('ADMIN holds 7 (no MAINTENANCE_MODE_WRITE — SUPER_ADMIN-only)', () => {
        const adminExpected = [
            SETTINGS_GENERAL_VIEW,
            SETTINGS_GENERAL_WRITE,
            BILLING_SETTINGS_VIEW,
            BILLING_SETTINGS_WRITE,
            BILLING_VIEW_OWN,
            SUBSCRIPTION_VIEW_OWN,
            USER_UPDATE_SELF
        ] as const;

        for (const perm of adminExpected) {
            it(`grants "${perm}" to ADMIN`, () => {
                expect(admin).toContain(perm);
            });
        }

        it('does NOT grant MAINTENANCE_MODE_WRITE to ADMIN', () => {
            expect(admin).not.toContain(MAINTENANCE_MODE_WRITE);
        });
    });

    describe('HOST has self-billing visibility but NOT admin-tier billing', () => {
        it('grants BILLING_VIEW_OWN to HOST', () => {
            expect(host).toContain(BILLING_VIEW_OWN);
        });

        it('grants SUBSCRIPTION_VIEW_OWN to HOST', () => {
            expect(host).toContain(SUBSCRIPTION_VIEW_OWN);
        });

        it('grants USER_UPDATE_SELF to HOST', () => {
            expect(host).toContain(USER_UPDATE_SELF);
        });

        it('does NOT grant BILLING_READ_ALL to HOST (admin-tier — kept SPEC-164 boundary)', () => {
            expect(host).not.toContain(BILLING_READ_ALL);
        });

        it('does NOT grant MAINTENANCE_MODE_WRITE to HOST', () => {
            expect(host).not.toContain(MAINTENANCE_MODE_WRITE);
        });

        it('does NOT grant SETTINGS_GENERAL_WRITE to HOST (admin-only)', () => {
            expect(host).not.toContain(SETTINGS_GENERAL_WRITE);
        });
    });

    describe('USER_UPDATE_SELF granted to all authenticated roles', () => {
        const authenticatedRoles: Array<readonly [string, readonly string[]]> = [
            ['SUPER_ADMIN', superAdmin],
            ['ADMIN', admin],
            ['HOST', host],
            ['EDITOR', editor],
            ['CLIENT_MANAGER', clientManager],
            ['USER', user],
            ['SPONSOR', sponsor]
        ];

        for (const [roleName, perms] of authenticatedRoles) {
            it(`grants USER_UPDATE_SELF to ${roleName}`, () => {
                expect(perms).toContain(USER_UPDATE_SELF);
            });
        }
    });

    describe('GUEST and SYSTEM hold none of the new SPEC-156 perms', () => {
        for (const perm of ALL_SPEC_156_PERMS) {
            it(`does NOT grant "${perm}" to GUEST`, () => {
                expect(guest).not.toContain(perm);
            });
            it(`does NOT grant "${perm}" to SYSTEM`, () => {
                expect(system).not.toContain(perm);
            });
        }
    });

    describe('Paying roles also have self-billing access (T-007 expansion)', () => {
        // USER buys tourist tiers, CLIENT_MANAGER buys complex tiers, SPONSOR
        // pays for sponsorship packages — all need /protected/billing/* access.
        // Per the dev test-users matrix (SPEC-143): tourist-free / tourist-plus /
        // tourist-vip (USER); complex-basico / complex-pro / complex-premium
        // (CLIENT_MANAGER); sponsor (SPONSOR).
        const payingRoles: Array<readonly [string, readonly string[]]> = [
            ['USER', user],
            ['CLIENT_MANAGER', clientManager],
            ['SPONSOR', sponsor]
        ];

        for (const [roleName, perms] of payingRoles) {
            it(`grants BILLING_VIEW_OWN to ${roleName}`, () => {
                expect(perms).toContain(BILLING_VIEW_OWN);
            });

            it(`grants SUBSCRIPTION_VIEW_OWN to ${roleName}`, () => {
                expect(perms).toContain(SUBSCRIPTION_VIEW_OWN);
            });

            it(`does NOT grant BILLING_READ_ALL to ${roleName} (admin-tier remains SPEC-164 boundary)`, () => {
                expect(perms).not.toContain(BILLING_READ_ALL);
            });
        }
    });

    describe('EDITOR (internal role) does NOT receive billing gates', () => {
        // EDITOR is content moderation, internal, non-paying. Should not be
        // able to hit /protected/billing/* even with valid auth.
        it('does NOT grant BILLING_VIEW_OWN to EDITOR', () => {
            expect(editor).not.toContain(BILLING_VIEW_OWN);
        });

        it('does NOT grant SUBSCRIPTION_VIEW_OWN to EDITOR', () => {
            expect(editor).not.toContain(SUBSCRIPTION_VIEW_OWN);
        });
    });

    describe('Settings/maintenance gates remain admin-only', () => {
        const nonAdminRoles: Array<readonly [string, readonly string[]]> = [
            ['EDITOR', editor],
            ['CLIENT_MANAGER', clientManager],
            ['USER', user],
            ['SPONSOR', sponsor],
            ['HOST', host]
        ];

        const adminOnlyGates = [
            SETTINGS_GENERAL_VIEW,
            SETTINGS_GENERAL_WRITE,
            MAINTENANCE_MODE_WRITE,
            BILLING_SETTINGS_VIEW,
            BILLING_SETTINGS_WRITE
        ] as const;

        for (const [roleName, perms] of nonAdminRoles) {
            for (const perm of adminOnlyGates) {
                it(`does NOT grant "${perm}" to ${roleName}`, () => {
                    expect(perms).not.toContain(perm);
                });
            }
        }
    });
});

// ---------------------------------------------------------------------------
// SPEC-173 T-023 — AI_SETTINGS_MANAGE is SUPER_ADMIN-only
// ---------------------------------------------------------------------------

describe('ROLE_PERMISSIONS — AI_SETTINGS_MANAGE is SUPER_ADMIN-only (SPEC-173 T-023)', () => {
    type RoleKey = keyof typeof ROLE_PERMISSIONS;
    const AI_SETTINGS_MANAGE = 'ai.settings.manage' as const;
    const superAdminPerms = ROLE_PERMISSIONS[
        SUPER_ADMIN as unknown as RoleKey
    ] as readonly string[];

    const nonSuperRoles: Array<readonly [string, readonly string[]]> = [
        ['ADMIN', ROLE_PERMISSIONS[ADMIN as unknown as RoleKey] as readonly string[]],
        ['EDITOR', ROLE_PERMISSIONS[EDITOR as unknown as RoleKey] as readonly string[]],
        ['HOST', ROLE_PERMISSIONS['HOST' as unknown as RoleKey] as readonly string[]],
        ['USER', ROLE_PERMISSIONS['USER' as unknown as RoleKey] as readonly string[]]
    ];

    it('grants AI_SETTINGS_MANAGE to SUPER_ADMIN', () => {
        expect(superAdminPerms).toContain(AI_SETTINGS_MANAGE);
    });

    for (const [roleName, perms] of nonSuperRoles) {
        it(`does NOT grant AI_SETTINGS_MANAGE to ${roleName}`, () => {
            expect(perms).not.toContain(AI_SETTINGS_MANAGE);
        });
    }
});

// ---------------------------------------------------------------------------
// SPEC-239 — Admin-tier commerce permissions granted to ADMIN and SUPER_ADMIN
// ---------------------------------------------------------------------------
// Literal permission values from packages/schemas/src/enums/permission.enum.ts.

const COMMERCE_CREATE = 'commerce.create' as const;
const COMMERCE_VIEW_ALL = 'commerce.viewAll' as const;
const COMMERCE_EDIT_ALL = 'commerce.editAll' as const;
const COMMERCE_DELETE = 'commerce.delete' as const;
const COMMERCE_MODERATE_REVIEW = 'commerce.moderateReview' as const;

const ADMIN_TIER_COMMERCE_PERMS = [
    COMMERCE_CREATE,
    COMMERCE_VIEW_ALL,
    COMMERCE_EDIT_ALL,
    COMMERCE_DELETE,
    COMMERCE_MODERATE_REVIEW
] as const;

describe('ROLE_PERMISSIONS — Admin-tier commerce permissions (SPEC-239)', () => {
    type RoleKey = keyof typeof ROLE_PERMISSIONS;
    const superAdminPerms = ROLE_PERMISSIONS[
        SUPER_ADMIN as unknown as RoleKey
    ] as readonly string[];
    const adminPerms = ROLE_PERMISSIONS[ADMIN as unknown as RoleKey] as readonly string[];

    describe('SUPER_ADMIN holds all 5 admin commerce permissions', () => {
        for (const perm of ADMIN_TIER_COMMERCE_PERMS) {
            it(`grants "${perm}" to SUPER_ADMIN`, () => {
                expect(superAdminPerms).toContain(perm);
            });
        }
    });

    describe('ADMIN holds all 5 admin commerce permissions', () => {
        for (const perm of ADMIN_TIER_COMMERCE_PERMS) {
            it(`grants "${perm}" to ADMIN`, () => {
                expect(adminPerms).toContain(perm);
            });
        }
    });
});
