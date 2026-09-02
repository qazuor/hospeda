/**
 * @file plan-card-delta.test.ts
 * @description Unit tests for the cumulative plan delta (HOS-943 AC-10/11/17).
 *
 * This is the half of the feature that can actually be executed: the `.astro`
 * component around it can only be source-read, so everything worth asserting
 * about "what does tier N add over tier N-1" lives here as a pure function.
 *
 * The single most important case in this file is
 * `limits rise while entitlements are identical`. That is the shape that makes
 * an entitlement-only diff render "Everything in Basic, plus:" followed by an
 * empty list, and it is the real shape of `owner-basico` -> `owner-pro` in the
 * live catalogue — not a hypothetical.
 */

import { describe, expect, it } from 'vitest';
import type { PlanDeltaSource } from '@/components/billing/plan-card-delta';
import {
    computePlanDelta,
    computePlanDeltas,
    LIMIT_DISPLAY_ORDER,
    UNLIMITED_LIMIT_VALUE
} from '@/components/billing/plan-card-delta';

/** Build a plan fixture without repeating the whole shape at every call site. */
function plan(input: {
    slug: string;
    entitlements?: readonly string[];
    limits?: Record<string, number>;
}): PlanDeltaSource {
    return {
        slug: input.slug,
        entitlements: input.entitlements ?? [],
        limits: input.limits ?? {}
    };
}

describe('computePlanDelta', () => {
    describe('first tier (no predecessor)', () => {
        it('reports every entitlement and every limit as its own offer', () => {
            const basic = plan({
                slug: 'owner-basico',
                entitlements: ['publish_accommodations', 'view_basic_stats'],
                limits: { max_accommodations: 1, max_photos_per_accommodation: 15 }
            });

            const delta = computePlanDelta({ plan: basic });

            expect(delta.isFirstTier).toBe(true);
            expect(delta.addedEntitlements).toEqual(['publish_accommodations', 'view_basic_stats']);
            expect(delta.limitChanges.map((c) => c.key)).toEqual([
                'max_accommodations',
                'max_photos_per_accommodation'
            ]);
            expect(delta.isEmpty).toBe(false);
        });

        it('reports previousSlug as null, never a slug and never undefined', () => {
            // AC-17: this null is what the template gates the
            // "Todo lo del plan <X>, más:" header on. A delta that reported an
            // absent predecessor as anything other than null is exactly how
            // "Todo lo del plan undefined, más:" gets rendered.
            const delta = computePlanDelta({ plan: plan({ slug: 'tourist-free' }) });

            expect(delta.previousSlug).toBeNull();
            expect(delta.previousSlug).not.toBeUndefined();
        });

        it('treats an explicitly undefined predecessor exactly like an absent one', () => {
            const only = plan({ slug: 'solo', entitlements: ['save_favorites'] });

            expect(computePlanDelta({ plan: only, previous: undefined })).toEqual(
                computePlanDelta({ plan: only })
            );
        });

        it('reports isEmpty for a tier that grants nothing at all', () => {
            const delta = computePlanDelta({ plan: plan({ slug: 'empty' }) });

            expect(delta.isEmpty).toBe(true);
            expect(delta.addedEntitlements).toEqual([]);
            expect(delta.limitChanges).toEqual([]);
        });
    });

    describe('two tiers', () => {
        it('lists only the entitlements the upper tier introduces', () => {
            const lower = plan({ slug: 'a', entitlements: ['read_reviews', 'save_favorites'] });
            const upper = plan({
                slug: 'b',
                entitlements: ['read_reviews', 'save_favorites', 'featured_listing']
            });

            const delta = computePlanDelta({ plan: upper, previous: lower });

            expect(delta.isFirstTier).toBe(false);
            expect(delta.previousSlug).toBe('a');
            expect(delta.addedEntitlements).toEqual(['featured_listing']);
        });

        it('lists a limit that rises even though the entitlements are IDENTICAL', () => {
            // The trap this whole module exists for. `owner-basico` and
            // `owner-pro` share `publish_accommodations`; what separates them is
            // 1 listing / 15 photos versus 3 listings / 30 photos. An
            // entitlement-only diff returns nothing here.
            const basico = plan({
                slug: 'owner-basico',
                entitlements: ['publish_accommodations'],
                limits: { max_accommodations: 1, max_photos_per_accommodation: 15 }
            });
            const pro = plan({
                slug: 'owner-pro',
                entitlements: ['publish_accommodations'],
                limits: { max_accommodations: 3, max_photos_per_accommodation: 30 }
            });

            const delta = computePlanDelta({ plan: pro, previous: basico });

            expect(delta.addedEntitlements).toEqual([]);
            expect(delta.isEmpty).toBe(false);
            expect(delta.limitChanges).toEqual([
                {
                    key: 'max_accommodations',
                    value: 3,
                    previousValue: 1,
                    kind: 'raised',
                    isUnlimited: false
                },
                {
                    key: 'max_photos_per_accommodation',
                    value: 30,
                    previousValue: 15,
                    kind: 'raised',
                    isUnlimited: false
                }
            ]);
        });

        it('lists an entitlement that appears even though every limit is unchanged', () => {
            const lower = plan({
                slug: 'a',
                entitlements: ['publish_accommodations'],
                limits: { max_accommodations: 3 }
            });
            const upper = plan({
                slug: 'b',
                entitlements: ['publish_accommodations', 'custom_branding'],
                limits: { max_accommodations: 3 }
            });

            const delta = computePlanDelta({ plan: upper, previous: lower });

            expect(delta.addedEntitlements).toEqual(['custom_branding']);
            expect(delta.limitChanges).toEqual([]);
            expect(delta.isEmpty).toBe(false);
        });

        it('reports a limit the previous tier did not have at all as introduced', () => {
            const lower = plan({ slug: 'a', limits: { max_favorites: 5 } });
            const upper = plan({ slug: 'b', limits: { max_favorites: 5, max_collections: 10 } });

            const delta = computePlanDelta({ plan: upper, previous: lower });

            expect(delta.limitChanges).toEqual([
                {
                    key: 'max_collections',
                    value: 10,
                    previousValue: null,
                    kind: 'introduced',
                    isUnlimited: false
                }
            ]);
        });

        it('reports isEmpty when the upper tier adds literally nothing', () => {
            const lower = plan({ slug: 'a', entitlements: ['x'], limits: { max_favorites: 5 } });
            const upper = plan({ slug: 'b', entitlements: ['x'], limits: { max_favorites: 5 } });

            expect(computePlanDelta({ plan: upper, previous: lower }).isEmpty).toBe(true);
        });
    });

    describe('the unlimited sentinel', () => {
        it('ranks -1 ABOVE a finite value, so going unlimited is a rise', () => {
            // A naive numeric comparison reads -1 as smaller than 5 and drops
            // `owner-premium`'s unlimited promotions from its delta entirely.
            const pro = plan({ slug: 'pro', limits: { max_active_promotions: 5 } });
            const premium = plan({
                slug: 'premium',
                limits: { max_active_promotions: UNLIMITED_LIMIT_VALUE }
            });

            const delta = computePlanDelta({ plan: premium, previous: pro });

            expect(delta.limitChanges).toEqual([
                {
                    key: 'max_active_promotions',
                    value: -1,
                    previousValue: 5,
                    kind: 'raised',
                    isUnlimited: true
                }
            ]);
        });

        it('does not report going from unlimited DOWN to a finite value as a rise', () => {
            const lower = plan({ slug: 'a', limits: { max_favorites: UNLIMITED_LIMIT_VALUE } });
            const upper = plan({ slug: 'b', limits: { max_favorites: 25 } });

            expect(computePlanDelta({ plan: upper, previous: lower }).limitChanges).toEqual([]);
        });

        it('flags isUnlimited on a first-tier limit that is already unlimited', () => {
            const only = plan({ slug: 'vip', limits: { max_favorites: UNLIMITED_LIMIT_VALUE } });

            expect(computePlanDelta({ plan: only }).limitChanges[0]?.isUnlimited).toBe(true);
        });
    });

    describe('values that must not reach a card', () => {
        it('omits a limit that DROPS — "plus: fewer AI chats" is not a plus', () => {
            const lower = plan({ slug: 'a', limits: { max_ai_chat_per_month: 2000 } });
            const upper = plan({ slug: 'b', limits: { max_ai_chat_per_month: 1250 } });

            expect(computePlanDelta({ plan: upper, previous: lower }).limitChanges).toEqual([]);
        });

        it('omits a limit that stays exactly the same', () => {
            const lower = plan({ slug: 'a', limits: { max_favorites: 25 } });
            const upper = plan({ slug: 'b', limits: { max_favorites: 25 } });

            expect(computePlanDelta({ plan: upper, previous: lower }).limitChanges).toEqual([]);
        });

        it('drops NaN and Infinity rather than rendering them as a cap', () => {
            const malformed = plan({
                slug: 'broken',
                limits: {
                    max_favorites: Number.NaN,
                    max_collections: Number.POSITIVE_INFINITY,
                    max_accommodations: 2
                }
            });

            expect(computePlanDelta({ plan: malformed }).limitChanges.map((c) => c.key)).toEqual([
                'max_accommodations'
            ]);
        });

        it('treats a malformed PREVIOUS value as absent, so the cap is still shown', () => {
            const lower = plan({ slug: 'a', limits: { max_favorites: Number.NaN } });
            const upper = plan({ slug: 'b', limits: { max_favorites: 25 } });

            const delta = computePlanDelta({ plan: upper, previous: lower });

            expect(delta.limitChanges).toEqual([
                {
                    key: 'max_favorites',
                    value: 25,
                    previousValue: null,
                    kind: 'introduced',
                    isUnlimited: false
                }
            ]);
        });
    });

    describe('display order', () => {
        it('orders curated limit keys by LIMIT_DISPLAY_ORDER, not by payload order', () => {
            const only = plan({
                slug: 'owner',
                limits: {
                    max_ai_search_per_month: 200,
                    max_favorites: 5,
                    max_accommodations: 1
                }
            });

            const keys = computePlanDelta({ plan: only }).limitChanges.map((c) => c.key);

            expect(keys).toEqual([
                'max_accommodations',
                'max_favorites',
                'max_ai_search_per_month'
            ]);
            // Anchored to the constant, so a reorder there moves this with it.
            expect(LIMIT_DISPLAY_ORDER.indexOf('max_accommodations')).toBeLessThan(
                LIMIT_DISPLAY_ORDER.indexOf('max_favorites')
            );
        });

        it('appends an uncurated key rather than dropping it', () => {
            const only = plan({
                slug: 'future',
                limits: { max_something_nobody_listed: 4, max_accommodations: 1 }
            });

            expect(computePlanDelta({ plan: only }).limitChanges.map((c) => c.key)).toEqual([
                'max_accommodations',
                'max_something_nobody_listed'
            ]);
        });
    });
});

describe('computePlanDeltas', () => {
    it('returns one delta per plan, positionally aligned with the input', () => {
        const plans = [plan({ slug: 'a' }), plan({ slug: 'b' }), plan({ slug: 'c' })];

        const deltas = computePlanDeltas({ plans });

        expect(deltas).toHaveLength(3);
        expect(deltas.map((d) => d.slug)).toEqual(['a', 'b', 'c']);
    });

    it('diffs each tier against its IMMEDIATE predecessor, not against the first', () => {
        // Three-tier ladder: the third card must say "everything in the second"
        // and list only what the second lacked — not re-list what the first
        // already had.
        const plans = [
            plan({ slug: 'basico', entitlements: ['a'], limits: { max_accommodations: 1 } }),
            plan({ slug: 'pro', entitlements: ['a', 'b'], limits: { max_accommodations: 3 } }),
            plan({
                slug: 'premium',
                entitlements: ['a', 'b', 'c'],
                limits: { max_accommodations: 10 }
            })
        ];

        const [first, second, third] = computePlanDeltas({ plans });

        expect(first?.isFirstTier).toBe(true);
        expect(first?.addedEntitlements).toEqual(['a']);

        expect(second?.previousSlug).toBe('basico');
        expect(second?.addedEntitlements).toEqual(['b']);
        expect(second?.limitChanges[0]?.previousValue).toBe(1);

        expect(third?.previousSlug).toBe('pro');
        expect(third?.addedEntitlements).toEqual(['c']);
        expect(third?.limitChanges[0]?.previousValue).toBe(3);
    });

    it('handles an audience with a SINGLE tier without inventing a predecessor', () => {
        // AC-17. A one-plan audience is a live configuration (deactivating
        // `tourist-plus` left the tourist catalogue at two, and deactivating one
        // more leaves it at one).
        const deltas = computePlanDeltas({
            plans: [plan({ slug: 'only', entitlements: ['x'], limits: { max_favorites: 5 } })]
        });

        expect(deltas).toHaveLength(1);
        expect(deltas[0]?.isFirstTier).toBe(true);
        expect(deltas[0]?.previousSlug).toBeNull();
        expect(deltas[0]?.addedEntitlements).toEqual(['x']);
    });

    it('returns an empty list for an empty catalogue instead of throwing', () => {
        expect(computePlanDeltas({ plans: [] })).toEqual([]);
    });
});
