/**
 * Unit tests for the `TEST_USERS` matrix declared in `testUsers.seed.ts`
 * (HOS-694 commerce-owner fixtures).
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
    it('should contain 18 test users (14 pre-existing + 4 HOS-694 commerce-owner fixtures)', () => {
        // Assert
        expect(TEST_USERS).toHaveLength(18);
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

    describe('commerce-gastronomy@local.test (under cap, HOS-694)', () => {
        const user = findUser('commerce-gastronomy@local.test');

        it('should hold the COMMERCE_OWNER role on the gastronomy-premium plan', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
            expect(user.planSlug).toBe('gastronomy-premium');
        });

        it('should stamp the subscription with the gastronomy product domain', () => {
            expect(user.subscriptionProductDomain).toBe('gastronomy');
        });

        it('should NOT own a listing at cap (cupo disponible)', () => {
            expect(user.ownsGastronomyAtCap).toBeFalsy();
        });
    });

    describe('commerce-experience@local.test (under cap, HOS-694)', () => {
        const user = findUser('commerce-experience@local.test');

        it('should hold the COMMERCE_OWNER role on the experience-premium plan', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
            expect(user.planSlug).toBe('experience-premium');
        });

        it('should stamp the subscription with the experience product domain', () => {
            expect(user.subscriptionProductDomain).toBe('experience');
        });
    });

    describe('commerce-gastronomy-at-cap@local.test (HOS-694 AC-13 / AC-30)', () => {
        const user = findUser('commerce-gastronomy-at-cap@local.test');

        it('should hold the COMMERCE_OWNER role on the gastronomy-premium plan', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
            expect(user.planSlug).toBe('gastronomy-premium');
            expect(user.subscriptionProductDomain).toBe('gastronomy');
        });

        it('should be flagged to own a listing at its cap', () => {
            expect(user.ownsGastronomyAtCap).toBe(true);
        });
    });

    describe('host-commerce@local.test (dual role, HOS-296 / HOS-694 AC-3 / AC-12)', () => {
        const user = findUser('host-commerce@local.test');

        it('should declare HOST as the primary role (so the HOS-30 accommodation fixture applies)', () => {
            expect(user.role).toBe(RoleEnum.HOST);
            expect(user.planSlug).toBe('owner-basico');
        });

        it('should declare COMMERCE_OWNER as an extra role', () => {
            expect(user.extraRoles).toContain(RoleEnum.COMMERCE_OWNER);
        });
    });

    it('should give every commerce-owner fixture a plan resolving to a real vertical plan slug', () => {
        // Arrange
        const commerceOwners = TEST_USERS.filter((u) => u.role === RoleEnum.COMMERCE_OWNER);

        // Assert
        expect(commerceOwners).toHaveLength(3);
        for (const user of commerceOwners) {
            expect(['gastronomy-premium', 'experience-premium']).toContain(user.planSlug);
        }
    });
});
