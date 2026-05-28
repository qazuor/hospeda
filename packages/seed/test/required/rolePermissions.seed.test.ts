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
