/**
 * Unit tests for the plan-slug → product-domain read (HOS-1122).
 *
 * ## What is actually at stake
 *
 * Two `apps/api` services decide whether to restrict or restore an owner's
 * ACCOMMODATIONS and PROMOTIONS by asking this module which domain a plan
 * belongs to. Every wrong answer is silent by construction:
 *
 * - answering `'accommodation'` for a commerce tier sends the restore direction
 *   to read caps that tier does not declare, which resolve to *unlimited*, and
 *   un-restricts the owner's whole portfolio without an error;
 * - answering `undefined` for a real accommodation plan refuses a restoration a
 *   paying host is owed;
 * - answering a commerce domain for the WRONG vertical points the downgrade at
 *   the other vertical's listings — of which the subscription has none, so it
 *   restricts nothing and reports success.
 *
 * The map is built by walking the catalogues, so these tests are also what
 * catches a seventh commerce tier or a fourth partner plan silently dropping
 * out of it.
 *
 * @module test/plan-domains
 */
import { describe, expect, it } from 'vitest';
import {
    ALL_EXPERIENCE_PLANS,
    ALL_GASTRONOMY_PLANS,
    ALL_PLANS,
    commerceVerticalForPlanSlug,
    isAccommodationPlanSlug,
    PARTNER_GOLD_PLAN,
    PARTNER_LISTING_PLAN,
    PARTNER_SILVER_PLAN,
    productDomainForPlanSlug
} from '../src/index.js';

describe('productDomainForPlanSlug (HOS-1122)', () => {
    it('classifies EVERY plan in ALL_PLANS as accommodation', () => {
        // Walked, not listed: a seventh owner tier added to the catalogue is
        // covered here the day it lands, which is the whole reason the map is
        // derived rather than spelled out.
        expect(ALL_PLANS.length).toBeGreaterThan(0);
        for (const plan of ALL_PLANS) {
            expect(productDomainForPlanSlug(plan.slug)).toBe('accommodation');
        }
    });

    it('classifies each commerce tier as its OWN vertical, never a shared bucket', () => {
        expect(ALL_GASTRONOMY_PLANS.length).toBeGreaterThan(0);
        expect(ALL_EXPERIENCE_PLANS.length).toBeGreaterThan(0);
        for (const plan of ALL_GASTRONOMY_PLANS) {
            expect(productDomainForPlanSlug(plan.slug)).toBe('gastronomy');
        }
        for (const plan of ALL_EXPERIENCE_PLANS) {
            expect(productDomainForPlanSlug(plan.slug)).toBe('experience');
        }
    });

    it('classifies the partner plans as partner', () => {
        for (const plan of [PARTNER_LISTING_PLAN, PARTNER_SILVER_PLAN, PARTNER_GOLD_PLAN]) {
            expect(productDomainForPlanSlug(plan.slug)).toBe('partner');
        }
    });

    it('answers undefined for an unknown slug — no default (HOS-1078 rule)', () => {
        // The `?? ACCOMMODATION` this deliberately does not have is the exact
        // shape HOS-1078 deleted one layer down: a typo got a confident, wrong
        // answer and went on to read a plan that does not declare the key.
        expect(productDomainForPlanSlug('owner-prro')).toBeUndefined();
        expect(productDomainForPlanSlug('')).toBeUndefined();
        expect(productDomainForPlanSlug('gastronomy')).toBeUndefined();
    });
});

describe('isAccommodationPlanSlug', () => {
    it('is true for an accommodation plan and false for every other domain', () => {
        expect(isAccommodationPlanSlug(ALL_PLANS[0]?.slug ?? '')).toBe(true);
        expect(isAccommodationPlanSlug(ALL_GASTRONOMY_PLANS[0]?.slug ?? '')).toBe(false);
        expect(isAccommodationPlanSlug(ALL_EXPERIENCE_PLANS[0]?.slug ?? '')).toBe(false);
        expect(isAccommodationPlanSlug(PARTNER_GOLD_PLAN.slug)).toBe(false);
    });

    it('is FALSE for an unknown slug — it fails closed, unlike subscriptionMatchesDomain', () => {
        // `subscriptionMatchesDomain` reads a missing `product_domain` as
        // accommodation because that COLUMN post-dates most rows. A plan slug
        // has no such history, so the same permissiveness here would hand an
        // unrecognised plan the accommodation restore path.
        expect(isAccommodationPlanSlug('not-a-plan')).toBe(false);
    });
});

describe('commerceVerticalForPlanSlug', () => {
    it('names the vertical of each commerce tier', () => {
        for (const plan of ALL_GASTRONOMY_PLANS) {
            expect(commerceVerticalForPlanSlug(plan.slug)).toBe('gastronomy');
        }
        for (const plan of ALL_EXPERIENCE_PLANS) {
            expect(commerceVerticalForPlanSlug(plan.slug)).toBe('experience');
        }
    });

    it('answers undefined for accommodation, partner and unknown slugs', () => {
        // This is the value the cron branches on: `undefined` means "run the
        // accommodation remediation". A commerce answer here for an owner plan
        // would send a host's downgrade at a listing table it has no rows in.
        expect(commerceVerticalForPlanSlug(ALL_PLANS[0]?.slug ?? '')).toBeUndefined();
        expect(commerceVerticalForPlanSlug(PARTNER_SILVER_PLAN.slug)).toBeUndefined();
        expect(commerceVerticalForPlanSlug('not-a-plan')).toBeUndefined();
    });
});
