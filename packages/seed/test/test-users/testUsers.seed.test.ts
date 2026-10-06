/**
 * Unit tests for the `TEST_USERS` matrix declared in `testUsers.seed.ts`
 * (the non-billing remainder of the SPEC-143 Block 1 matrix — HOS-1416
 * removed every plan/subscription/addon/billing-state fixture along with the
 * legacy billing schema).
 *
 * Pure array-shape assertions only — no DB. The DB-orchestrating
 * `seedTestUsers` function itself is exercised through a real
 * `pnpm db:seed:test-users` run / the seed integration suite, matching the
 * existing precedent for every other helper in this file (see the docstring
 * on `hostAccommodation.test.ts`).
 */
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { TEST_USERS } from '../../src/test-users/testUsers.seed.js';

/** Convenience lookup so each `it.each` case reads by email, not by index. */
function findUser(email: string) {
    const user = TEST_USERS.find((u) => u.email === email);
    if (!user) {
        throw new Error(`Expected TEST_USERS to contain "${email}"`);
    }
    return user;
}

describe('TEST_USERS matrix', () => {
    it('should contain 13 test users (the non-billing remainder of the matrix)', () => {
        // Assert
        expect(TEST_USERS).toHaveLength(13);
    });

    it('should have no duplicate emails', () => {
        // Arrange / Act
        const emails = TEST_USERS.map((u) => u.email);

        // Assert
        expect(new Set(emails).size).toBe(emails.length);
    });

    it('should give every fixture the shared @local.test convention', () => {
        // Assert
        for (const user of TEST_USERS) {
            expect(user.email).toMatch(/@local\.test$/);
        }
    });

    it('should not declare any billing fixture fields (HOS-1416 demolished the billing schema)', () => {
        // The billing fixture vocabulary died with the billing tables; nothing
        // in the matrix may carry plan/subscription/addon state anymore.
        for (const user of TEST_USERS) {
            expect(user).not.toHaveProperty('planSlug');
            expect(user).not.toHaveProperty('subStatus');
            expect(user).not.toHaveProperty('addonSlug');
            expect(user).not.toHaveProperty('subscriptionProductDomain');
            expect(user).not.toHaveProperty('ownsGastronomyAtCap');
            expect(user).not.toHaveProperty('ownsExperienceAtCap');
        }
    });

    describe('commerce-gastronomy@local.test (HOS-694)', () => {
        const user = findUser('commerce-gastronomy@local.test');

        it('should hold the COMMERCE_OWNER role', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
        });

        // HOS-964 follow-up (2026-09-07 smoke finding): production's
        // `createForOwner` grants GASTRONOMY_OWNER alongside the legacy
        // COMMERCE_OWNER in the same transaction. Without this extra role,
        // this fixture never matched a What's New (or any other) audience
        // gated on GASTRONOMY_OWNER, because COMMERCE_OWNER is deliberately
        // excluded from that enum (it is retiring).
        it('should ALSO hold GASTRONOMY_OWNER, matching what createForOwner grants in production', () => {
            expect(user.extraRoles).toContain(RoleEnum.GASTRONOMY_OWNER);
        });
    });

    describe('commerce-experience@local.test (HOS-694)', () => {
        const user = findUser('commerce-experience@local.test');

        it('should hold the COMMERCE_OWNER role', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
        });

        // HOS-964 follow-up (2026-09-07 smoke finding) — see the gastronomy
        // fixture's equivalent test above for the full rationale.
        it('should ALSO hold EXPERIENCE_OWNER, matching what createForOwner grants in production', () => {
            expect(user.extraRoles).toContain(RoleEnum.EXPERIENCE_OWNER);
        });
    });

    describe('host-commerce@local.test (dual role, HOS-296 / HOS-694 AC-3 / AC-12)', () => {
        const user = findUser('host-commerce@local.test');

        it('should declare HOST as the primary role (so the HOS-30 accommodation fixture applies)', () => {
            expect(user.role).toBe(RoleEnum.HOST);
        });

        it('should declare COMMERCE_OWNER as an extra role', () => {
            expect(user.extraRoles).toContain(RoleEnum.COMMERCE_OWNER);
        });
    });

    it('should keep the four HOST fixtures for the accommodation/promotion/provider attachments', () => {
        // Arrange
        const hosts = TEST_USERS.filter((u) => u.role === RoleEnum.HOST);

        // Assert
        expect(hosts.map((u) => u.email)).toEqual([
            'host-basico@local.test',
            'host-pro@local.test',
            'host-premium@local.test',
            'host-provider@local.test',
            'host-commerce@local.test'
        ]);
    });
});
