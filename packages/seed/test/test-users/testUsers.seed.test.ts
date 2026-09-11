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
import {
    ALL_EXPERIENCE_PLANS,
    ALL_GASTRONOMY_PLANS,
    ALL_PLANS,
    DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL
} from '@repo/billing';
import { RoleEnum, SubscriptionStatusEnum } from '@repo/schemas';
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
    // HOS-1268 added 25: gastronomy/experience trial + addon + at-cap fixtures
    // (accommodation already had trial + addon), plus the
    // past_due/cancelled/paused/comp/courtesy matrix across all 4 verticals.
    it('should contain 42 test users (17 pre-existing + 25 HOS-1268 fixtures)', () => {
        // Assert
        expect(TEST_USERS).toHaveLength(42);
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

        // Assert — 3 pre-existing (HOS-694) + 15 from HOS-1268: at-cap
        // experience, trial + addon per vertical (4), and the 5-state
        // past_due/cancelled/paused/comp/courtesy matrix per vertical (10).
        expect(commerceOwners).toHaveLength(18);
        for (const user of commerceOwners) {
            expect([
                DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy,
                DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience,
                'gastronomy-trial',
                'experience-trial'
            ]).toContain(user.planSlug);
        }
    });

    describe('HOS-1268 — host-trial now uses the dedicated owner-trial plan', () => {
        const user = findUser('host-trial@local.test');

        it('should resolve to owner-trial, not owner-basico', () => {
            expect(user.planSlug).toBe('owner-trial');
            expect(user.subStatus).toBe(SubscriptionStatusEnum.TRIALING);
        });
    });

    describe('HOS-1268 — commerce-experience-at-cap@local.test', () => {
        const user = findUser('commerce-experience-at-cap@local.test');

        it('should hold COMMERCE_OWNER + EXPERIENCE_OWNER on the sellable experience plan', () => {
            expect(user.role).toBe(RoleEnum.COMMERCE_OWNER);
            expect(user.extraRoles).toContain(RoleEnum.EXPERIENCE_OWNER);
            expect(user.planSlug).toBe(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience);
        });

        it('should be flagged to own an experience listing at its cap', () => {
            expect(user.ownsExperienceAtCap).toBe(true);
        });

        it('should NOT declare an explicit subscriptionProductDomain (derived from the plan)', () => {
            expect(user.subscriptionProductDomain).toBeUndefined();
        });
    });

    describe('HOS-1268 — gastronomy/experience trial fixtures', () => {
        it('commerce-gastronomy-trial@local.test should be trialing on gastronomy-trial', () => {
            const user = findUser('commerce-gastronomy-trial@local.test');
            expect(user.planSlug).toBe('gastronomy-trial');
            expect(user.subStatus).toBe(SubscriptionStatusEnum.TRIALING);
        });

        it('commerce-experience-trial@local.test should be trialing on experience-trial', () => {
            const user = findUser('commerce-experience-trial@local.test');
            expect(user.planSlug).toBe('experience-trial');
            expect(user.subStatus).toBe(SubscriptionStatusEnum.TRIALING);
        });
    });

    describe('HOS-1268 regression — ensureAddonPurchase must resolve gastronomy/experience base plans', () => {
        // `ensureAddonPurchase` (private, DB-orchestrating — not unit-tested
        // directly, per this file's own precedent) used to resolve its base
        // plan against `ALL_PLANS` alone. That throws
        // `Plan "gastronomy-basico" not found` for any commerce addon fixture,
        // because `ALL_PLANS` never included the commerce verticals — this
        // pins the catalogue fact the bug depended on, so a regression there
        // reintroduces the crash the new addon fixtures below would hit at
        // seed time.
        it('should NOT find the commerce sellable plans in ALL_PLANS', () => {
            const allPlanSlugs = ALL_PLANS.map((plan) => plan.slug);
            expect(allPlanSlugs).not.toContain(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy);
            expect(allPlanSlugs).not.toContain(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience);
        });

        it('should find them in their own vertical catalogues instead', () => {
            expect(ALL_GASTRONOMY_PLANS.map((plan) => plan.slug)).toContain(
                DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy
            );
            expect(ALL_EXPERIENCE_PLANS.map((plan) => plan.slug)).toContain(
                DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience
            );
        });
    });

    describe('HOS-1268 — gastronomy/experience addon fixtures', () => {
        it('commerce-gastronomy-plus-addon@local.test should carry extra-gastronomies-1', () => {
            const user = findUser('commerce-gastronomy-plus-addon@local.test');
            expect(user.planSlug).toBe(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy);
            expect(user.addonSlug).toBe('extra-gastronomies-1');
        });

        it('commerce-experience-plus-addon@local.test should carry extra-experiences-1', () => {
            const user = findUser('commerce-experience-plus-addon@local.test');
            expect(user.planSlug).toBe(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.experience);
            expect(user.addonSlug).toBe('extra-experiences-1');
        });
    });

    describe('HOS-1268 — billing-state matrix (past_due / cancelled / paused / comp / courtesy)', () => {
        const expectedStatusByEmail: Record<string, SubscriptionStatusEnum> = {
            'past-due': SubscriptionStatusEnum.PAST_DUE,
            cancelled: SubscriptionStatusEnum.CANCELLED,
            paused: SubscriptionStatusEnum.PAUSED,
            comp: SubscriptionStatusEnum.COMP,
            courtesy: SubscriptionStatusEnum.COURTESY
        };

        const emailPrefixByVertical: Record<string, (typeof RoleEnum)[keyof typeof RoleEnum]> = {
            host: RoleEnum.HOST,
            'commerce-gastronomy': RoleEnum.COMMERCE_OWNER,
            'commerce-experience': RoleEnum.COMMERCE_OWNER,
            tourist: RoleEnum.USER
        };

        for (const [emailPrefix, expectedRole] of Object.entries(emailPrefixByVertical)) {
            for (const [suffix, expectedStatus] of Object.entries(expectedStatusByEmail)) {
                it(`${emailPrefix}-${suffix}@local.test should exist with role ${expectedRole} and status ${expectedStatus}`, () => {
                    const user = findUser(`${emailPrefix}-${suffix}@local.test`);
                    expect(user.role).toBe(expectedRole);
                    expect(user.subStatus).toBe(expectedStatus);
                });
            }
        }

        it('should NOT declare an explicit subscriptionProductDomain for any of the generated fixtures (derived from the plan)', () => {
            for (const emailPrefix of Object.keys(emailPrefixByVertical)) {
                for (const suffix of Object.keys(expectedStatusByEmail)) {
                    const user = findUser(`${emailPrefix}-${suffix}@local.test`);
                    expect(user.subscriptionProductDomain).toBeUndefined();
                }
            }
        });
    });
});
