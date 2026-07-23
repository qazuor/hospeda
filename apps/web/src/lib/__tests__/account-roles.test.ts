/**
 * @file account-roles.test.ts
 * @description Tests for the account dashboard role helpers: the commerce-owner
 * navigation gate (SPEC-249 T-001) and the role → subscription-plans-page
 * decision (`resolveSubscriptionPlansPath`, BETA-201).
 *
 * Verifies that `isCommerceOwnerRole` grants access to COMMERCE_OWNER and
 * platform staff, denies plain tourists, accommodation-only hosts, and
 * unauthenticated visitors, that the commerce set stays distinct from the
 * accommodations set, and that `resolveSubscriptionPlansPath` routes host-level
 * roles to the owner pricing page and everyone else (tourists, anonymous) to
 * the tourist pricing page.
 */

import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    isCommerceOwnerRole,
    ROLES_WITH_ACCOMMODATIONS_NAV,
    ROLES_WITH_COMMERCE_NAV,
    resolveSubscriptionPlansPath
} from '../account-roles';

describe('isCommerceOwnerRole', () => {
    it('returns true for COMMERCE_OWNER', () => {
        expect(isCommerceOwnerRole(RoleEnum.COMMERCE_OWNER)).toBe(true);
    });

    it('returns true for platform staff (ADMIN, SUPER_ADMIN)', () => {
        expect(isCommerceOwnerRole(RoleEnum.ADMIN)).toBe(true);
        expect(isCommerceOwnerRole(RoleEnum.SUPER_ADMIN)).toBe(true);
    });

    it('returns false for a plain tourist USER', () => {
        expect(isCommerceOwnerRole(RoleEnum.USER)).toBe(false);
    });

    it('returns false for an accommodation-only HOST', () => {
        expect(isCommerceOwnerRole(RoleEnum.HOST)).toBe(false);
    });

    it('returns false for null (unauthenticated)', () => {
        expect(isCommerceOwnerRole(null)).toBe(false);
    });

    it('returns false for an unknown role string', () => {
        expect(isCommerceOwnerRole('NOT_A_ROLE')).toBe(false);
    });
});

describe('ROLES_WITH_COMMERCE_NAV', () => {
    it('is distinct from the accommodations nav set (HOST is not a commerce role)', () => {
        expect(ROLES_WITH_COMMERCE_NAV.has('HOST')).toBe(false);
        expect(ROLES_WITH_ACCOMMODATIONS_NAV.has('COMMERCE_OWNER')).toBe(false);
    });
});

describe('resolveSubscriptionPlansPath (BETA-201)', () => {
    // Strong coverage of the role → pricing-page decision shared by the role-aware
    // surfaces (BETA-165 dashboard/addons, BETA-201 checkout return pages). The
    // .astro pages only wire this helper (asserted source-side in
    // test/pages/checkout-pages.test.ts); the logic lives here.
    it('routes every host-level role to the owner plans page', () => {
        for (const role of ROLES_WITH_ACCOMMODATIONS_NAV) {
            expect(resolveSubscriptionPlansPath({ role })).toBe('suscriptores/planes');
        }
    });

    it('routes a plain USER (tourist) to the tourist plans page', () => {
        expect(resolveSubscriptionPlansPath({ role: RoleEnum.USER })).toBe('suscriptores/turistas');
    });

    it('routes a COMMERCE_OWNER (not an accommodation host) to the tourist page', () => {
        // Commerce is a separate billing domain; a commerce owner is not an
        // accommodation host, so the accommodation-plans upsell treats them as a
        // tourist (consistent with isHostRole).
        expect(resolveSubscriptionPlansPath({ role: RoleEnum.COMMERCE_OWNER })).toBe(
            'suscriptores/turistas'
        );
    });

    it('routes a null role (anonymous / MP return with no session cookie) to the tourist page', () => {
        expect(resolveSubscriptionPlansPath({ role: null })).toBe('suscriptores/turistas');
    });

    it('routes an unknown role to the tourist page (safe default)', () => {
        expect(resolveSubscriptionPlansPath({ role: 'NOT_A_ROLE' })).toBe('suscriptores/turistas');
    });
});
