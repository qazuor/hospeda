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
import { DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL } from '@repo/billing';
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
    // Recounted, not decremented by eye: HOS-1224 retired
    // `tourist-plus@local.test` along with the plan it existed to exercise.
    it('should contain 17 test users (13 pre-existing + 4 HOS-694 commerce-owner fixtures)', () => {
        // Assert
        expect(TEST_USERS).toHaveLength(17);
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

        it('should hold the COMMERCE_OWNER role on the sellable gastronomy plan', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
            // Asserted against the catalogue default rather than a literal: the
            // fixture derives its slug from that same constant, so hard-coding the
            // slug here would only re-break on the next retier (HOS-818 moved it
            // from `gastronomy-premium` to `gastronomy-basico`).
            expect(user.planSlug).toBe(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy);
        });

        it('should stamp the subscription with the gastronomy product domain', () => {
            expect(user.subscriptionProductDomain).toBe('gastronomy');
        });

        it('should NOT own a listing at cap (cupo disponible)', () => {
            expect(user.ownsGastronomyAtCap).toBeFalsy();
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

    describe('commerce-experience@local.test (under cap, HOS-694)', () => {
        const user = findUser('commerce-experience@local.test');

        it('should hold the COMMERCE_OWNER role on the sellable experience plan', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
            expect(user.planSlug).toBe(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience);
        });

        it('should stamp the subscription with the experience product domain', () => {
            expect(user.subscriptionProductDomain).toBe('experience');
        });

        // HOS-964 follow-up (2026-09-07 smoke finding) — see the gastronomy
        // fixture's equivalent test above for the full rationale.
        it('should ALSO hold EXPERIENCE_OWNER, matching what createForOwner grants in production', () => {
            expect(user.extraRoles).toContain(RoleEnum.EXPERIENCE_OWNER);
        });
    });

    describe('commerce-gastronomy-at-cap@local.test (HOS-694 AC-13 / AC-30)', () => {
        const user = findUser('commerce-gastronomy-at-cap@local.test');

        it('should hold the COMMERCE_OWNER role on the sellable gastronomy plan', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
            expect(user.planSlug).toBe(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy);
            expect(user.subscriptionProductDomain).toBe('gastronomy');
        });

        it('should be flagged to own a listing at its cap', () => {
            expect(user.ownsGastronomyAtCap).toBe(true);
        });

        // HOS-964 follow-up (2026-09-07 smoke finding) — see the gastronomy
        // fixture's equivalent test above for the full rationale.
        it('should ALSO hold GASTRONOMY_OWNER, matching what createForOwner grants in production', () => {
            expect(user.extraRoles).toContain(RoleEnum.GASTRONOMY_OWNER);
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
            expect([
                DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy,
                DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience
            ]).toContain(user.planSlug);
        }
    });
});
