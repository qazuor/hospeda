/**
 * @file account-roles.test.ts
 * @description Tests for the account dashboard role helpers, focused on the
 * commerce-owner navigation gate (SPEC-249 T-001).
 *
 * Verifies that `isCommerceOwnerRole` grants access to COMMERCE_OWNER and
 * platform staff, denies plain tourists, accommodation-only hosts, and
 * unauthenticated visitors, and that the commerce set stays distinct from
 * the accommodations set.
 */

import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ROLES_WITH_ACCOMMODATIONS_NAV,
    ROLES_WITH_COMMERCE_NAV,
    isCommerceOwnerRole
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
