/**
 * Unit tests for `resolveCommercePlanSlug` (HOS-166 D-7 → HOS-688 §6.8).
 *
 * `env` is module-mocked so every configuration shape is exercised without
 * touching real `process.env` or booting the app. Mirrors the mocking style in
 * `start-subscription.service.test.ts`.
 *
 * The property that actually matters here is that the two verticals resolve to
 * DIFFERENT plans. MercadoPago scopes a free trial to
 * `(payer, preapproval_plan)`, so a resolver that returned one slug for both —
 * which is precisely what this function did before HOS-688 — silently charges
 * the second vertical from day one while the page promises a trial (HOS-522).
 * Nothing about that failure is visible from the outside.
 *
 * @module test/commerce/commerce-plan-resolver
 */
import {
    DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PREMIUM_PLAN,
    EXPERIENCE_PRO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PRO_PLAN
} from '@repo/billing';
import { CommerceEntityTypeEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mock (hoisted above imports by Vitest). `vi.hoisted` is required so
// `mockEnv` is safely accessible from inside the (also hoisted) `vi.mock`
// factory — a plain top-level `const` is NOT reliably visible there.
// ──────────────────────────────────────────────────────────────────────────
const mockEnv = vi.hoisted<{ HOSPEDA_COMMERCE_PLAN_SLUGS?: string }>(() => ({
    HOSPEDA_COMMERCE_PLAN_SLUGS: undefined
}));

vi.mock('../../src/utils/env', () => ({
    env: mockEnv
}));

import {
    CommercePlanNotConfiguredError,
    CommercePlanNotForVerticalError,
    resolveCommercePlanSlug
} from '../../src/services/commerce-plan-resolver';

describe('resolveCommercePlanSlug (HOS-688)', () => {
    it('resolves each vertical to a DIFFERENT plan', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        const gastronomy = resolveCommercePlanSlug({
            entityType: CommerceEntityTypeEnum.GASTRONOMY
        });
        const experience = resolveCommercePlanSlug({
            entityType: CommerceEntityTypeEnum.EXPERIENCE
        });

        expect(gastronomy).not.toBe(experience);
        // HOS-818: the sellable tier of both verticals is the BASIC one.
        expect(gastronomy).toBe(GASTRONOMY_BASICO_PLAN.slug);
        expect(experience).toBe(EXPERIENCE_BASICO_PLAN.slug);
    });

    it('falls back to the shipped catalogue when the variable is unset', () => {
        // Unset is the normal state in dev and CI. Production is covered by the
        // boot validation in `env.ts`, not by a throw here.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        expect(resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })).toBe(
            DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy
        );
    });

    it('honours a configured override, per vertical', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS =
            'gastronomy:custom-gastro-plan,experience:custom-exp-plan';

        expect(resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })).toBe(
            'custom-gastro-plan'
        );
        expect(resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.EXPERIENCE })).toBe(
            'custom-exp-plan'
        );
    });

    it('throws rather than silently using the defaults when the value is malformed', () => {
        // A present-but-wrong value must never be swapped for the defaults:
        // that would hide exactly the operator mistake the boot validation
        // exists to surface.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = 'gastronomy=oops';

        expect(() =>
            resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })
        ).toThrow(CommercePlanNotConfiguredError);
    });

    it('throws when the mapping covers only one vertical', () => {
        // The half-set failure mode a single variable exists to make
        // impossible: one vertical selling, the other 503-ing, site looks fine.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = 'gastronomy:gastronomy-premium';

        expect(() =>
            resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.EXPERIENCE })
        ).toThrow(/experience/);
    });

    it('throws on an unknown vertical name', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS =
            'gastronmy:gastronomy-premium,experience:experience-premium';

        expect(() =>
            resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })
        ).toThrow(/unknown vertical/);
    });

    it('treats an empty string the same as unset', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = '';

        expect(resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })).toBe(
            DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy
        );
    });
});

/**
 * HOS-1119 — the resolver now takes the buyer's pick.
 *
 * The invariant AC-35's guard protects is "a vertical becomes a plan slug HERE
 * and nowhere else", and these tests are about the half of it a type cannot
 * state: that a slug arriving from a request body cannot move a checkout onto
 * the OTHER vertical's plan, and therefore onto the other vertical's MercadoPago
 * `preapproval_plan`.
 */
describe('resolveCommercePlanSlug — requested tier (HOS-1119)', () => {
    it('resolves the requested tier when it belongs to the vertical', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        expect(
            resolveCommercePlanSlug({
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                requestedPlanSlug: GASTRONOMY_PRO_PLAN.slug
            })
        ).toBe(GASTRONOMY_PRO_PLAN.slug);
    });

    it('is NOT the default — the pick genuinely moves the answer', () => {
        // Guards against a mutation that ignores `requestedPlanSlug` entirely:
        // the assertion above would still pass if `-pro` happened to be the
        // default, so pin that it is not.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        expect(GASTRONOMY_PRO_PLAN.slug).not.toBe(
            DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy
        );
        expect(
            resolveCommercePlanSlug({
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                requestedPlanSlug: GASTRONOMY_PRO_PLAN.slug
            })
        ).not.toBe(DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy);
    });

    it('REFUSES the other vertical’s plan — the whole point of the validation', () => {
        // This is the failure AC-35's guard describes in prose: two verticals
        // billed against one MercadoPago preapproval plan, the second free trial
        // silently not happening, and every page still rendering perfectly.
        // Before HOS-1119 it was impossible because there was one answer per
        // vertical; now it is impossible because the request is checked.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        expect(() =>
            resolveCommercePlanSlug({
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                requestedPlanSlug: EXPERIENCE_BASICO_PLAN.slug
            })
        ).toThrow(CommercePlanNotForVerticalError);

        expect(() =>
            resolveCommercePlanSlug({
                entityType: CommerceEntityTypeEnum.EXPERIENCE,
                requestedPlanSlug: GASTRONOMY_PRO_PLAN.slug
            })
        ).toThrow(CommercePlanNotForVerticalError);
    });

    it('refuses a slug that names no plan at all', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        expect(() =>
            resolveCommercePlanSlug({
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                requestedPlanSlug: 'owner-premium'
            })
        ).toThrow(CommercePlanNotForVerticalError);
    });

    it('refuses an accommodation plan slug', () => {
        // The other direction of the same leak: an accommodation plan reached
        // through a commerce checkout would put a restaurant on a host plan,
        // with the host plan's caps and entitlements.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        expect(() =>
            resolveCommercePlanSlug({
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                requestedPlanSlug: 'owner-basico'
            })
        ).toThrow(CommercePlanNotForVerticalError);
    });

    it('accepts EVERY tier of the vertical — sellability is the database’s call', () => {
        // This resolver answers membership only; whether the tier is sellable is
        // decided by `billing_plans.active` at checkout, so that an operator
        // activating or retiring a tier does not need a deploy. A membership
        // check that also read `isActive` would freeze that decision into the
        // binary.
        //
        // Until HOS-975 this test demonstrated that with `experience-pro`,
        // which shipped `isActive: false`, and asserted the flag as its
        // precondition. HOS-975 put all six commerce tiers on sale, so there is
        // no inactive tier left to demonstrate it WITH — the assertion is
        // restated as the property the resolver actually has: every tier of the
        // vertical resolves, none of them consulted for activeness.
        //
        // Whether membership SHOULD read `isActive` — so a tier an operator
        // deactivates stops being requestable through `requestedPlanSlug`
        // instead of only failing later at checkout — is an open question raised
        // by HOS-975 and deliberately NOT settled here.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        for (const plan of [EXPERIENCE_BASICO_PLAN, EXPERIENCE_PRO_PLAN, EXPERIENCE_PREMIUM_PLAN]) {
            expect(
                resolveCommercePlanSlug({
                    entityType: CommerceEntityTypeEnum.EXPERIENCE,
                    requestedPlanSlug: plan.slug
                })
            ).toBe(plan.slug);
        }
    });

    it('ignores the requested tier when it is absent or blank', () => {
        // The pre-HOS-1119 path, which every caller without a picker still
        // takes. A blank string is "no pick", not an invalid slug: it is what an
        // untouched form field serialises to.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS = undefined;

        expect(resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })).toBe(
            GASTRONOMY_BASICO_PLAN.slug
        );
        expect(
            resolveCommercePlanSlug({
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                requestedPlanSlug: '   '
            })
        ).toBe(GASTRONOMY_BASICO_PLAN.slug);
    });

    it('lets an explicit pick override the ENV default, not just the shipped one', () => {
        // Staging and production both set the variable, so a picker that only
        // beat the code default would do nothing where it matters.
        mockEnv.HOSPEDA_COMMERCE_PLAN_SLUGS =
            'gastronomy:custom-gastro-plan,experience:custom-exp-plan';

        expect(
            resolveCommercePlanSlug({
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                requestedPlanSlug: GASTRONOMY_PRO_PLAN.slug
            })
        ).toBe(GASTRONOMY_PRO_PLAN.slug);

        // …and still falls back to the env value when nothing is picked.
        expect(resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })).toBe(
            'custom-gastro-plan'
        );
    });
});
