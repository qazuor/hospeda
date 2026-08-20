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
    EXPERIENCE_PREMIUM_PLAN,
    GASTRONOMY_PREMIUM_PLAN
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
        expect(gastronomy).toBe(GASTRONOMY_PREMIUM_PLAN.slug);
        expect(experience).toBe(EXPERIENCE_PREMIUM_PLAN.slug);
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
