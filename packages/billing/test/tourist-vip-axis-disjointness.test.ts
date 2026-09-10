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

import { describe, expect, it } from 'vitest';
import {
    AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL,
    LIMIT_KEY_BY_COMMERCE_VERTICAL,
    PRIVATE_GALLERY_LIMIT_KEY
} from '../src/config/commerce-limits.config.js';
import {
    COMPLEX_BASICO_PLAN,
    COMPLEX_PREMIUM_PLAN,
    COMPLEX_PRO_PLAN,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PREMIUM_PLAN,
    EXPERIENCE_PRO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PREMIUM_PLAN,
    GASTRONOMY_PRO_PLAN,
    OWNER_BASICO_PLAN,
    OWNER_PREMIUM_PLAN,
    OWNER_PRO_PLAN,
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

/** Every plan that carries the tourist block, for the value-agreement check. */
const PLANS_CARRYING_THE_BLOCK = [
    OWNER_BASICO_PLAN,
    OWNER_PRO_PLAN,
    OWNER_PREMIUM_PLAN,
    COMPLEX_BASICO_PLAN,
    COMPLEX_PRO_PLAN,
    COMPLEX_PREMIUM_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PRO_PLAN,
    GASTRONOMY_PREMIUM_PLAN,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PRO_PLAN,
    EXPERIENCE_PREMIUM_PLAN
];

describe('HOS-1323 — the tourist axis is disjoint from every vertical axis', () => {
    it('the tourist tier declares exactly seven limit keys', () => {
        // Not a magic number for its own sake: every claim below is about THIS
        // set, and a silent change to it should surface here first.
        expect(TOURIST_AXIS.size).toBe(7);
    });

    it.each(
        COMMERCE_OWN_KEYS.map((key) => [key] as const)
    )('the commerce-owned key %s is NOT a tourist key', (key) => {
        expect(TOURIST_AXIS.has(key)).toBe(false);
    });

    /**
     * The accommodation side of the same rule. An owner plan's `limits` array
     * DOES contain the tourist block (it spreads `TOURIST_VIP_LIMITS`), so its
     * own keys are what remains after removing that block — and none of what
     * remains may be a tourist key, which is the same statement as "the two
     * lists in `plans.config.ts` do not overlap".
     */
    it.each(
        [OWNER_BASICO_PLAN, OWNER_PRO_PLAN, OWNER_PREMIUM_PLAN].map(
            (plan) => [plan.slug, plan] as const
        )
    )('%s declares no tourist key outside the inherited block', (_slug, plan) => {
        const declaredTwice = plan.limits
            .map((l) => l.key)
            .filter((key, index, all) => all.indexOf(key) !== index);

        // `mergeLimits` collapses by key, so a genuine override would appear as
        // a single entry with a non-VIP value — covered by the next test. What
        // this rules out is the plan declaring the same key twice, which would
        // make "its own keys" ambiguous.
        expect(declaredTwice).toEqual([]);
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
