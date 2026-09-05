/**
 * HOS-1062 F1 — the public-catalogue visibility mark.
 *
 * The mark is the lock on a negotiated price (a municipality's agreement, a
 * partner's exclusive plan). Nothing reports its failure: a plan that leaks
 * renders a perfectly correct pricing page, and the damage is that somebody
 * READ it. So the reader is tested for the two directions separately — what
 * makes a plan listed, and everything that must make it unlisted — rather than
 * for a happy path.
 */

import { describe, expect, it } from 'vitest';
import {
    BillingPlanPublicListingSchema,
    BillingPlanResponseSchema,
    isPubliclyListedPlan,
    PLAN_PUBLIC_LISTING_METADATA_KEY,
    resolvePlanPublicListing
} from '../../../src/api/billing/billing-plan.schema.js';

describe('PLAN_PUBLIC_LISTING_METADATA_KEY', () => {
    it('names the metadata key an operator writes by hand', () => {
        // The key is a wire contract with the DB rows an operator marks until
        // the admin form exists. Renaming it orphans every marked plan, so the
        // literal is pinned here rather than derived from the constant.
        expect(PLAN_PUBLIC_LISTING_METADATA_KEY).toBe('publicListing');
    });
});

describe('BillingPlanPublicListingSchema', () => {
    it('accepts exactly the two documented values', () => {
        expect(BillingPlanPublicListingSchema.safeParse('listed').success).toBe(true);
        expect(BillingPlanPublicListingSchema.safeParse('unlisted').success).toBe(true);
    });

    it('rejects a value that merely looks like one of them', () => {
        for (const value of ['Listed', 'UNLISTED', 'hidden', 'private', '', true, 1, null]) {
            expect(BillingPlanPublicListingSchema.safeParse(value).success).toBe(false);
        }
    });
});

describe('resolvePlanPublicListing — what stays listed', () => {
    it('treats an unmarked plan as listed', () => {
        // Every plan in production is this case. If it resolved any other way
        // the public catalogue would go dark on deploy.
        expect(resolvePlanPublicListing({ metadata: {} })).toEqual({ publicListing: 'listed' });
    });

    it('treats a plan carrying OTHER metadata as listed', () => {
        expect(
            resolvePlanPublicListing({
                metadata: { displayName: 'Básico', sortOrder: 1, testPlan: false }
            })
        ).toEqual({ publicListing: 'listed' });
    });

    it('treats null/undefined metadata as listed, not as an unreadable mark', () => {
        // `mapDbToPlan` already tolerates this shape (`planRow.metadata ?? {}`).
        // An absent metadata object means nothing was ever marked.
        expect(resolvePlanPublicListing({ metadata: null })).toEqual({ publicListing: 'listed' });
        expect(resolvePlanPublicListing({ metadata: undefined })).toEqual({
            publicListing: 'listed'
        });
    });

    it('reads an explicit listed mark', () => {
        expect(resolvePlanPublicListing({ metadata: { publicListing: 'listed' } })).toEqual({
            publicListing: 'listed'
        });
    });
});

describe('resolvePlanPublicListing — what fails closed', () => {
    it('reads an explicit unlisted mark', () => {
        expect(resolvePlanPublicListing({ metadata: { publicListing: 'unlisted' } })).toEqual({
            publicListing: 'unlisted'
        });
    });

    it('withholds a plan whose mark is present but unrecognised', () => {
        // A typo in the operator's UPDATE, a value from a future vocabulary, a
        // boolean written by someone who assumed a flag. The mark exists and
        // cannot be read: the plan is withheld, never published by default.
        for (const raw of ['unlited', 'hidden', true, 1, null, {}, []]) {
            expect(resolvePlanPublicListing({ metadata: { publicListing: raw } })).toEqual({
                publicListing: 'unlisted'
            });
        }
    });

    it('withholds a plan whose metadata is not an interrogable object', () => {
        for (const metadata of ['unlisted', 42, true, ['publicListing']]) {
            expect(resolvePlanPublicListing({ metadata })).toEqual({ publicListing: 'unlisted' });
        }
    });

    it('is case-sensitive — an almost-right mark still hides the plan', () => {
        expect(resolvePlanPublicListing({ metadata: { publicListing: 'Unlisted' } })).toEqual({
            publicListing: 'unlisted'
        });
        // And the dangerous direction: an almost-right LISTED value does not
        // resolve to listed either.
        expect(resolvePlanPublicListing({ metadata: { publicListing: 'Listed' } })).toEqual({
            publicListing: 'unlisted'
        });
    });

    it('ignores a mark written under a different key', () => {
        // `adminOnly` was the name the spec sketched; only the implemented key
        // marks a plan. A near-miss key leaves the plan listed — which is why
        // the key literal is pinned by the test above and by the CI guard.
        expect(resolvePlanPublicListing({ metadata: { adminOnly: true } })).toEqual({
            publicListing: 'listed'
        });
    });
});

describe('isPubliclyListedPlan', () => {
    it('serves a listed plan', () => {
        expect(isPubliclyListedPlan({ publicListing: 'listed' })).toBe(true);
    });

    it('withholds an unlisted plan', () => {
        expect(isPubliclyListedPlan({ publicListing: 'unlisted' })).toBe(false);
    });

    it('withholds a plan whose mark never arrived', () => {
        // The predicate is positive (`=== 'listed'`) precisely for this: a
        // mapper that forgets the field, a fixture that never had it, a payload
        // from an older service. None of those may publish a plan.
        expect(isPubliclyListedPlan({})).toBe(false);
        expect(isPubliclyListedPlan({ publicListing: undefined })).toBe(false);
        expect(isPubliclyListedPlan({ publicListing: null })).toBe(false);
        expect(isPubliclyListedPlan({ publicListing: true })).toBe(false);
    });
});

describe('BillingPlanResponseSchema.publicListing', () => {
    const base = {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'owner-basico',
        name: 'Basic',
        description: 'Basic plan.',
        category: 'owner',
        monthlyPriceArs: 1_500_000,
        annualPriceArs: 15_000_000,
        monthlyPriceUsdRef: 15,
        hasTrial: true,
        trialDays: 14,
        isDefault: true,
        sortOrder: 1,
        entitlements: ['publish_accommodations'],
        limits: { max_accommodations: 1 },
        isActive: true,
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-30T00:00:00.000Z'
    };

    it('rejects a payload with no mark at all', () => {
        // Required, no default — the owner's call. A default would have made an
        // absent field indistinguishable from an explicit 'listed', and every
        // reader downstream would have had to assume which one it was looking
        // at. The cost is one deploy window: while Coolify serves the old and
        // new containers at once, an admin client can meet a payload from an API
        // that predates the field, and this is the parse that will refuse it.
        const parsed = BillingPlanResponseSchema.safeParse(base);

        expect(parsed.success).toBe(false);
    });

    it('accepts a payload that carries the mark explicitly', () => {
        const parsed = BillingPlanResponseSchema.safeParse({ ...base, publicListing: 'listed' });

        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.publicListing).toBe('listed');
    });

    it('carries an unlisted mark through unchanged', () => {
        const parsed = BillingPlanResponseSchema.safeParse({
            ...base,
            publicListing: 'unlisted'
        });

        expect(parsed.success && parsed.data.publicListing).toBe('unlisted');
    });

    it('rejects an unrecognised value', () => {
        expect(
            BillingPlanResponseSchema.safeParse({ ...base, publicListing: 'hidden' }).success
        ).toBe(false);
    });
});
