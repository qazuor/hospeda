/**
 * @file tourist-vip-axis-disjointness.test.ts
 * @description HOS-1323: the catalogue property the tourist-VIP gift rests on —
 * **a plan's own limit keys and the tourist tier's limit keys never overlap.**
 *
 * ## Why this file exists
 *
 * The gift (`apps/api/src/services/billing/tourist-vip-inheritance.ts`) merges
 * the tourist-VIP block onto whatever a user already resolved, and it merges by
 * REPLACEMENT. That is only safe because the two key sets are disjoint: a
 * gastronomy plan declares no tourist key of its own, so replacing every key the
 * gift carries cannot reach `max_gastronomies`.
 *
 * Until this file, that was true **by convention**. Nothing checked it, and the
 * first plan to declare, say, `max_favorites` alongside its own cap would have
 * silently handed the tourist tier authority over a vertical's commercial term.
 * The owner stated the rule — *"los entitlements y límites de turista sólo
 * aplican a turista y los de gastronomía sólo aplican a gastronomía"* — and this
 * is what makes it an invariant instead of a habit.
 *
 * ## Why it lives in `@repo/billing` and asserts over the CONFIG
 *
 * The property belongs to the catalogue, not to the engine. Asserting it here
 * means a plan definition that breaks it fails at the source, in the package
 * that owns `plans.config.ts`, rather than as a puzzling entitlement bug three
 * layers away.
 *
 * **What it deliberately does NOT cover:** the `billing_plans` ROW. A row is
 * editable through `PUT /admin/billing/plans/{id}` with no deploy, so no static
 * test can freeze it. That gap is closed at runtime by the gift's allowlist
 * (`GIFTABLE_LIMIT_KEYS`), which is why both defences exist and neither is
 * redundant.
 */

import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL,
    LIMIT_KEY_BY_COMMERCE_VERTICAL,
    PRIVATE_GALLERY_LIMIT_KEY
} from '../src/config/commerce-limits.config.js';
import {
    ALL_PLAN_CATALOGS,
    OWNER_PREMIUM_PLAN,
    TEST_DAILY_PLAN,
    TOURIST_FREE_PLAN,
    TOURIST_VIP_PLAN
} from '../src/config/plans.config.js';
import type { LimitKey } from '../src/types/index.js';

/** The tourist axis: the seven keys the top tourist tier declares. */
const TOURIST_AXIS: ReadonlySet<LimitKey> = new Set(TOURIST_VIP_PLAN.limits.map((l) => l.key));

/**
 * Every key a vertical declares **as its own** — the listing cap, the vertical's
 * AI-chat quota, the gallery cap.
 *
 * Read from the `LIMIT_KEY_BY_*` maps rather than from a plan's `limits` array
 * on purpose: a commerce plan's array already contains the tourist block too
 * (`commerceVerticalTier` merges it in), so "the plan's keys" would trivially
 * intersect the tourist axis and prove nothing. The maps are the vertical's own
 * vocabulary.
 */
const COMMERCE_OWN_KEYS: readonly LimitKey[] = [
    ...Object.values(LIMIT_KEY_BY_COMMERCE_VERTICAL),
    ...Object.values(AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL),
    PRIVATE_GALLERY_LIMIT_KEY
];

/**
 * Every plan that carries the tourist block — **DERIVED from the catalogues,
 * never listed.**
 *
 * The first version of this file hand-wrote twelve plan constants here, which is
 * the exact trap HOS-1290 had already found and named: *"three separate defences
 * each narrowed their own scope to `ALL_PLANS`, so the six commerce plans and
 * the three partner plans fell outside all three at once"*. A guard whose
 * universe is a literal goes green on the plan nobody added to it — and this
 * one was already wrong in both directions, carrying the three `COMPLEX_*` that
 * HOS-692 removed from `ALL_PLANS` while missing `owner-test-daily`.
 *
 * `ALL_PLAN_CATALOGS` (`plans.config.ts:1650`) is the catalogue-of-catalogues
 * HOS-1290 introduced for precisely this. Filtering it by "does this plan
 * declare any tourist key" means a future `owner-elite` is inspected the day it
 * is written, with no edit here.
 *
 * The question a guard has to answer is not "does my assertion discriminate?"
 * but **"where does the universe I iterate come from, and who maintains it?"**
 */
const PLANS_CARRYING_THE_BLOCK = ALL_PLAN_CATALOGS.flat().filter(
    (plan) =>
        // The tourist tiers are the axis, not carriers of it. `tourist-free`
        // legitimately declares three of the seven at FREE values; asserting it
        // against the VIP tier would be asserting that the two tiers are the
        // same tier. Their relationship has its own case at the bottom of this
        // file. Excluded by DOMAIN, so a third tourist tier is excluded too.
        plan.productDomain !== ProductDomainEnum.TOURIST &&
        plan.limits.some((l) => TOURIST_AXIS.has(l.key))
);

describe('HOS-1323 — the tourist axis is disjoint from every vertical axis', () => {
    it('the tourist tier declares exactly seven limit keys', () => {
        // Not a magic number for its own sake: every claim below is about THIS
        // set, and a silent change to it should surface here first.
        expect(TOURIST_AXIS.size).toBe(7);
    });

    /**
     * Anti-vacuity for the DERIVED universe, and the price of deriving it.
     *
     * A hand-written list is wrong silently; a derived one can go EMPTY silently,
     * and `it.each([])` contributes zero cases without failing — the whole
     * value-agreement block below would simply stop existing. A rename in
     * `plans.config.ts`, or a filter that stops matching, has to land as a red
     * test rather than as a suite that quietly shrank.
     *
     * Nine today: the three owner tiers plus the six commerce ones. Asserted as
     * a FLOOR, not an equality — a new plan carrying the block should extend the
     * guard, not break it.
     */
    it('the derived universe is non-empty and covers both catalogues', () => {
        expect(PLANS_CARRYING_THE_BLOCK.length).toBeGreaterThanOrEqual(9);

        const domains = new Set(PLANS_CARRYING_THE_BLOCK.map((p) => p.productDomain));
        expect(domains.has(ProductDomainEnum.ACCOMMODATION)).toBe(true);
        expect(domains.has(ProductDomainEnum.GASTRONOMY)).toBe(true);
        expect(domains.has(ProductDomainEnum.EXPERIENCE)).toBe(true);
    });

    it.each(
        COMMERCE_OWN_KEYS.map((key) => [key] as const)
    )('the commerce-owned key %s is NOT a tourist key', (key) => {
        expect(TOURIST_AXIS.has(key)).toBe(false);
    });

    /**
     * `owner-test-daily` is the one plan that carries the block and is NOT in
     * `ALL_PLAN_CATALOGS`, so the derived universe above does not reach it. It is
     * covered TRANSITIVELY instead — `limits: [...OWNER_PREMIUM_PLAN.limits]`
     * (`plans.config.ts:1532`) is a spread copy, so whatever holds for
     * `owner-premium` holds for it.
     *
     * This asserts that PREMISE rather than the conclusion. The day somebody
     * gives the test plan limits of its own, this goes red and the transitive
     * argument stops being available — which is the moment to decide whether the
     * derived universe needs widening.
     */
    it('owner-test-daily still inherits owner-premium limits verbatim', () => {
        expect(TEST_DAILY_PLAN.limits).toEqual(OWNER_PREMIUM_PLAN.limits);
    });

    /**
     * The value half. Disjoint KEY sets make replacement safe; agreeing VALUES
     * are what make it invisible today. If a plan ever declares a tourist key at
     * a value other than the tourist tier's, replacement starts moving numbers
     * and somebody needs to have decided that on purpose.
     */
    it.each(
        PLANS_CARRYING_THE_BLOCK.map((plan) => [plan.slug, plan] as const)
    )('%s carries the tourist block at the tourist tier values', (_slug, plan) => {
        for (const limit of plan.limits) {
            if (!TOURIST_AXIS.has(limit.key)) {
                continue;
            }
            const tierValue = TOURIST_VIP_PLAN.limits.find((l) => l.key === limit.key)?.value;
            expect(limit.value).toBe(tierValue);
        }
    });

    /**
     * The collision that IS real, stated so nobody re-derives it the hard way:
     * `tourist-free` shares keys with `tourist-vip` because they are two tiers
     * of one product. That is the only overlap in the catalogue, it is expected,
     * and it is precisely what the gift replaces.
     */
    it('tourist-free overlaps tourist-vip, and only on the tourist axis', () => {
        const freeKeys = TOURIST_FREE_PLAN.limits.map((l) => l.key);

        expect(freeKeys.length).toBeGreaterThan(0);
        for (const key of freeKeys) {
            expect(TOURIST_AXIS.has(key)).toBe(true);
        }
        // Strict subset — the free tier meters less, never more.
        expect(freeKeys.length).toBeLessThan(TOURIST_AXIS.size);
    });
});
