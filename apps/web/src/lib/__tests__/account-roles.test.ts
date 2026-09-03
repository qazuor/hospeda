/**
 * @file account-roles.test.ts
 * @description Tests for the account dashboard role-set helpers: the
 * commerce-owner navigation gate (SPEC-249 T-001, migrated onto `nav-gating`
 * by HOS-296 §6.5) and the roles → subscription-plans-page decision
 * (`resolveSubscriptionPlansPath`, BETA-201).
 *
 * Verifies that `hasCommerceNavAccess` grants access to COMMERCE_OWNER and
 * platform staff, denies plain tourists, accommodation-only hosts, and
 * unauthenticated visitors, that the commerce set stays distinct from the
 * accommodations set, and that `resolveSubscriptionPlansPath` routes
 * host-level role sets to the owner pricing page and everyone else (tourists,
 * anonymous) to the tourist pricing page.
 *
 * HOS-296: every predicate now takes the actor's whole role SET, so the
 * multi-hat cases (HOST + COMMERCE_OWNER) are asserted explicitly — that
 * combination is the entire point of the change (AC-1).
 */

import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ROLES_WITH_ACCOMMODATIONS_NAV,
    ROLES_WITH_COMMERCE_NAV,
    resolveSubscriptionPlansPath,
    resolveSubscriptionPlansPathForAudience
} from '../account-roles';
import { hasAccommodationsNavAccess, hasCommerceNavAccess } from '../nav-gating';

describe('hasCommerceNavAccess', () => {
    it('returns true for COMMERCE_OWNER', () => {
        expect(hasCommerceNavAccess({ roles: [RoleEnum.COMMERCE_OWNER] })).toBe(true);
    });

    it('returns true for platform staff (ADMIN, SUPER_ADMIN)', () => {
        expect(hasCommerceNavAccess({ roles: [RoleEnum.ADMIN] })).toBe(true);
        expect(hasCommerceNavAccess({ roles: [RoleEnum.SUPER_ADMIN] })).toBe(true);
    });

    it('returns false for a plain tourist USER', () => {
        expect(hasCommerceNavAccess({ roles: [RoleEnum.USER] })).toBe(false);
    });

    it('returns false for an accommodation-only HOST', () => {
        expect(hasCommerceNavAccess({ roles: [RoleEnum.USER, RoleEnum.HOST] })).toBe(false);
    });

    it('returns false for null / empty (unauthenticated)', () => {
        expect(hasCommerceNavAccess({ roles: null })).toBe(false);
        expect(hasCommerceNavAccess({ roles: [] })).toBe(false);
    });

    it('returns false for an unknown role string', () => {
        expect(hasCommerceNavAccess({ roles: ['NOT_A_ROLE'] })).toBe(false);
    });

    it('returns true when the commerce hat is one of several held roles', () => {
        expect(
            hasCommerceNavAccess({
                roles: [RoleEnum.USER, RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]
            })
        ).toBe(true);
    });
});

describe('AC-1 — a HOST who is also a COMMERCE_OWNER gets BOTH nav groups', () => {
    // The regression this whole spec exists for: under the old scalar `role`
    // exactly one of these two could ever be true.
    const roles = [RoleEnum.USER, RoleEnum.HOST, RoleEnum.COMMERCE_OWNER];

    it('grants the accommodations/host navigation', () => {
        expect(hasAccommodationsNavAccess({ roles })).toBe(true);
    });

    it('grants the commerce navigation', () => {
        expect(hasCommerceNavAccess({ roles })).toBe(true);
    });

    it('is order-independent', () => {
        const reversed = [...roles].reverse();
        expect(hasAccommodationsNavAccess({ roles: reversed })).toBe(true);
        expect(hasCommerceNavAccess({ roles: reversed })).toBe(true);
    });
});

describe('ROLES_WITH_COMMERCE_NAV', () => {
    it('is distinct from the accommodations nav set (HOST is not a commerce role)', () => {
        expect(ROLES_WITH_COMMERCE_NAV.has('HOST')).toBe(false);
        expect(ROLES_WITH_ACCOMMODATIONS_NAV.has('COMMERCE_OWNER')).toBe(false);
    });
});

describe('resolveSubscriptionPlansPath (BETA-201)', () => {
    // Strong coverage of the roles → pricing-page decision shared by the role-aware
    // surfaces (BETA-165 dashboard/addons, BETA-201 checkout return pages). The
    // .astro pages only wire this helper (asserted source-side in
    // test/pages/checkout-pages.test.ts); the logic lives here.
    it('routes every host-level role to the owner plans page', () => {
        for (const role of ROLES_WITH_ACCOMMODATIONS_NAV) {
            expect(resolveSubscriptionPlansPath({ roles: [role] })).toBe(
                'suscriptores/planes/anfitriones'
            );
        }
    });

    it('routes a plain USER (tourist) to the tourist plans page', () => {
        expect(resolveSubscriptionPlansPath({ roles: [RoleEnum.USER] })).toBe(
            'suscriptores/planes/turistas'
        );
    });

    it('routes a COMMERCE_OWNER (not an accommodation host) to the tourist page', () => {
        // Commerce is a separate billing domain; a commerce owner is not an
        // accommodation host, so the accommodation-plans upsell treats them as a
        // tourist (consistent with the host-tier predicate).
        expect(resolveSubscriptionPlansPath({ roles: [RoleEnum.COMMERCE_OWNER] })).toBe(
            'suscriptores/planes/turistas'
        );
    });

    it('routes a COMMERCE_OWNER who is ALSO a HOST to the owner page', () => {
        // Holding the host hat is the stronger signal about which catalog the
        // user can actually buy from (HOS-296).
        expect(
            resolveSubscriptionPlansPath({ roles: [RoleEnum.COMMERCE_OWNER, RoleEnum.HOST] })
        ).toBe('suscriptores/planes/anfitriones');
    });

    it('routes a null / empty role set (anonymous / MP return with no session cookie) to the tourist page', () => {
        expect(resolveSubscriptionPlansPath({ roles: null })).toBe('suscriptores/planes/turistas');
        expect(resolveSubscriptionPlansPath({ roles: [] })).toBe('suscriptores/planes/turistas');
    });

    it('routes an unknown role to the tourist page (safe default)', () => {
        expect(resolveSubscriptionPlansPath({ roles: ['NOT_A_ROLE'] })).toBe(
            'suscriptores/planes/turistas'
        );
    });
});

describe('resolveSubscriptionPlansPathForAudience (HOS-283)', () => {
    // The audience-driven twin of `resolveSubscriptionPlansPath`, used when the
    // caller has an entitlement error's `details.upgradeAudience` instead of a
    // role set. Both must land on the same two pages.
    it('routes a host audience to the owner plans page', () => {
        expect(resolveSubscriptionPlansPathForAudience({ audience: 'host' })).toBe(
            'suscriptores/planes/anfitriones'
        );
    });

    it('routes a tourist audience to the tourist plans page', () => {
        expect(resolveSubscriptionPlansPathForAudience({ audience: 'tourist' })).toBe(
            'suscriptores/planes/turistas'
        );
    });

    it('agrees with the roles-driven helper on both pages', () => {
        // Guards against the two helpers drifting apart: an upsell reached via a
        // role and the same upsell reached via an API error must not send the
        // user to different pricing pages.
        expect(resolveSubscriptionPlansPathForAudience({ audience: 'host' })).toBe(
            resolveSubscriptionPlansPath({ roles: [RoleEnum.HOST] })
        );
        expect(resolveSubscriptionPlansPathForAudience({ audience: 'tourist' })).toBe(
            resolveSubscriptionPlansPath({ roles: [RoleEnum.USER] })
        );
    });
});

// ---------------------------------------------------------------------------
// HOS-1077 — the per-vertical owner roles reach the same commerce area
//
// The gate is a SET membership check, so the failure mode is silent and total:
// a role missing from the set makes every `/mi-cuenta/comercio/*` page redirect
// away with nothing in the sidebar to explain why. These assert the two new
// roles are in, without disturbing what was already out.
// ---------------------------------------------------------------------------

describe('HOS-1077 vertical owner roles and the commerce nav', () => {
    it('a GASTRONOMY_OWNER holding no other commerce hat reaches the commerce nav', () => {
        expect(hasCommerceNavAccess({ roles: [RoleEnum.USER, RoleEnum.GASTRONOMY_OWNER] })).toBe(
            true
        );
    });

    it('an EXPERIENCE_OWNER holding no other commerce hat reaches the commerce nav', () => {
        expect(hasCommerceNavAccess({ roles: [RoleEnum.USER, RoleEnum.EXPERIENCE_OWNER] })).toBe(
            true
        );
    });

    it('neither vertical owner reaches the ACCOMMODATIONS nav', () => {
        // The commerce and accommodation sets stay disjoint for the new roles
        // exactly as they were for COMMERCE_OWNER.
        expect(hasAccommodationsNavAccess({ roles: [RoleEnum.GASTRONOMY_OWNER] })).toBe(false);
        expect(hasAccommodationsNavAccess({ roles: [RoleEnum.EXPERIENCE_OWNER] })).toBe(false);
    });

    it('ROLES_WITH_COMMERCE_NAV names both new roles alongside the legacy one', () => {
        expect(ROLES_WITH_COMMERCE_NAV.has('GASTRONOMY_OWNER')).toBe(true);
        expect(ROLES_WITH_COMMERCE_NAV.has('EXPERIENCE_OWNER')).toBe(true);
        // Expand, not contract: the legacy role must still be in the set, or
        // every existing commerce owner loses the area on deploy.
        expect(ROLES_WITH_COMMERCE_NAV.has('COMMERCE_OWNER')).toBe(true);
    });

    it('ROLES_WITH_ACCOMMODATIONS_NAV gained neither', () => {
        expect(ROLES_WITH_ACCOMMODATIONS_NAV.has('GASTRONOMY_OWNER')).toBe(false);
        expect(ROLES_WITH_ACCOMMODATIONS_NAV.has('EXPERIENCE_OWNER')).toBe(false);
    });

    it('a plain tourist still does not reach the commerce nav', () => {
        // Instrument check: if the set had been widened to everyone, every
        // assertion above would pass while measuring nothing.
        expect(hasCommerceNavAccess({ roles: [RoleEnum.USER] })).toBe(false);
    });
});
