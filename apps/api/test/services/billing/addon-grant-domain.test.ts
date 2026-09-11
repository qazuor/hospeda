/**
 * HOS-1303 — the vertical classifier the consumer-side entitlement loader uses
 * to decide whether a customer-level add-on grant is its own.
 *
 * ## What this file proves and what it deliberately does not
 *
 * It proves the CLASSIFICATION, over every vertical the epic's axis 1 reaches
 * and over the three shapes that must NOT be classified as foreign (manual
 * grants, missing purchases, unknown slugs). The classifier is pure, so this is
 * the layer where the five-vertical parity is asserted cheaply and exhaustively.
 *
 * It does NOT prove that anything calls it — `entitlement-domain-isolation.test.ts`
 * does that, through the real middleware. A green run here with the call site
 * deleted is exactly the failure mode `scripts/check-addon-product-domain.sh`
 * was written after (a defense that reads as installed and never executes), so
 * the two files are a pair, not alternatives.
 *
 * @module test/services/billing/addon-grant-domain
 */

import { ALL_ADDONS } from '@repo/billing';
import { getDb } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    admitsAddonGrant,
    CONSUMER_SIDE_PRODUCT_DOMAINS,
    classifyAddonGrantDomain,
    OWNER_SIDE_PRODUCT_DOMAINS,
    resolveAddonPurchaseSlugs
} from '../../../src/services/billing/addon-grant-domain';

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

/** The consumer-side pair, spelled once instead of at every call. */
const CONSUMER = { servedDomains: CONSUMER_SIDE_PRODUCT_DOMAINS } as const;

describe('classifyAddonGrantDomain — the five verticals of the billing axis', () => {
    it('serves an ACCOMMODATION add-on', () => {
        expect(classifyAddonGrantDomain({ ...CONSUMER, addonSlug: 'visibility-boost-7d' })).toEqual(
            {
                kind: 'served',
                domain: ProductDomainEnum.ACCOMMODATION
            }
        );
    });

    it('serves every accommodation add-on in the catalogue, not just the boost', () => {
        // Guards against a classifier that happens to answer correctly for the
        // one slug the leak was measured on.
        for (const slug of [
            'visibility-boost-30d',
            'extra-photos-20',
            'extra-accommodations-5',
            'extra-properties-5',
            'ai-support-monthly'
        ]) {
            expect(classifyAddonGrantDomain({ ...CONSUMER, addonSlug: slug })).toEqual({
                kind: 'served',
                domain: ProductDomainEnum.ACCOMMODATION
            });
        }
    });

    it('refuses a GASTRONOMY add-on — the measured leak', () => {
        // `visibility-boost-gastronomy-7d` grants EntitlementKey.FEATURED_LISTING,
        // the same key the accommodation boost grants. The key cannot tell them
        // apart; only the add-on's declared domain can.
        expect(
            classifyAddonGrantDomain({ ...CONSUMER, addonSlug: 'visibility-boost-gastronomy-7d' })
        ).toEqual({
            kind: 'foreign',
            domain: ProductDomainEnum.GASTRONOMY
        });
        expect(
            classifyAddonGrantDomain({ ...CONSUMER, addonSlug: 'extra-gastronomies-1' })
        ).toEqual({
            kind: 'foreign',
            domain: ProductDomainEnum.GASTRONOMY
        });
    });

    it('refuses an EXPERIENCE add-on', () => {
        expect(
            classifyAddonGrantDomain({ ...CONSUMER, addonSlug: 'visibility-boost-experience-30d' })
        ).toEqual({
            kind: 'foreign',
            domain: ProductDomainEnum.EXPERIENCE
        });
        expect(classifyAddonGrantDomain({ ...CONSUMER, addonSlug: 'private-galleries-5' })).toEqual(
            {
                kind: 'foreign',
                domain: ProductDomainEnum.EXPERIENCE
            }
        );
    });

    it('serves TOURIST for the consumer scope, which shares that loader with accommodation', () => {
        expect(CONSUMER_SIDE_PRODUCT_DOMAINS).toContain(ProductDomainEnum.TOURIST);
        expect(CONSUMER_SIDE_PRODUCT_DOMAINS).toContain(ProductDomainEnum.ACCOMMODATION);
        expect(CONSUMER_SIDE_PRODUCT_DOMAINS).toHaveLength(2);
    });

    it('does NOT serve tourist for the OWNER scope — the two are not interchangeable', () => {
        // HOS-1303 review F1. The owner-side resolver selects
        // `isAccommodationSubscription` alone, so handing it the consumer pair
        // (as the first revision of this module did, on a comment claiming
        // `loadDeferredAddonGrants` had one caller) would admit a
        // `tourist`-domain add-on into an OWNER's entitlement set. That is the
        // cross-vertical contamination this gate exists to stop, arriving through
        // the gate itself.
        expect(OWNER_SIDE_PRODUCT_DOMAINS).toEqual([ProductDomainEnum.ACCOMMODATION]);
        expect(OWNER_SIDE_PRODUCT_DOMAINS).not.toContain(ProductDomainEnum.TOURIST);
    });

    it('answers differently for the two real scopes when handed the same slug', () => {
        // Proves `servedDomains` reaches the predicate rather than decorating the
        // signature. No catalogue add-on declares `tourist` yet, so the
        // observable difference is demonstrated with an explicit tourist scope —
        // whose accommodation answer must flip to foreign.
        const touristOnly = { servedDomains: [ProductDomainEnum.TOURIST] } as const;

        expect(
            classifyAddonGrantDomain({ ...CONSUMER, addonSlug: 'visibility-boost-7d' }).kind
        ).toBe('served');
        expect(
            classifyAddonGrantDomain({
                ...touristOnly,
                addonSlug: 'visibility-boost-7d'
            })
        ).toEqual({ kind: 'foreign', domain: ProductDomainEnum.ACCOMMODATION });
    });

    it('has no PARTNER add-on to classify today — and says so by inventory, not by silence', () => {
        // The fifth vertical of the epic's axis 1. There is no partner add-on in
        // `ALL_ADDONS`, so no fixture can assert the refusal. Asserting the
        // ABSENCE instead is what fails the day one is added: whoever adds it
        // has to come back here and decide, rather than inheriting whatever the
        // classifier happens to answer.
        const partnerAddons = ALL_ADDONS.filter(
            (addon) => addon.productDomain === ProductDomainEnum.PARTNER
        );
        expect(partnerAddons).toEqual([]);
    });

    it('classifies EVERY catalogue add-on — no slug falls through as unplaceable', () => {
        // The exhaustiveness `productDomainForLimitKey` gets from its
        // `Record<LimitKey, …>` type, which a slug lookup cannot get from the
        // compiler. `AddonDefinition.productDomain` is required, so this must
        // hold for all of them; it fails if the catalogue and the classifier
        // ever disagree about what a domain is.
        for (const addon of ALL_ADDONS) {
            const verdict = classifyAddonGrantDomain({ ...CONSUMER, addonSlug: addon.slug });
            expect(verdict.kind).not.toBe('unplaceable');
            expect(verdict).toMatchObject({ domain: addon.productDomain });
        }
    });
});

describe('classifyAddonGrantDomain — unplaceable is ADMITTED, never refused', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('answers unplaceable for a slug outside the catalogue', () => {
        expect(classifyAddonGrantDomain({ ...CONSUMER, addonSlug: 'operator-invented' })).toEqual({
            kind: 'unplaceable',
            reason: 'unknown-slug'
        });
    });

    it('admits it anyway — refusing would strip an entitlement a customer paid for', () => {
        // The posture inversion versus HOS-1279, asserted rather than only
        // documented: there, refusing means "leave the cap alone"; here it means
        // "take the feature away".
        expect(admitsAddonGrant({ ...CONSUMER, addonSlug: 'operator-invented' })).toBe(true);
        expect(admitsAddonGrant({ ...CONSUMER, addonSlug: '' })).toBe(true);
    });

    it('sends a FAILED purchase lookup to Sentry, not only to a log line', async () => {
        // HOS-1303 review F2. An empty map is indistinguishable from "this
        // customer holds no add-on grants", so a permanently failing read turns
        // the whole gate into a no-op that looks exactly like a clean customer.
        // Its sibling degradation in `loadEntitlements` captures; this one did
        // not, and a `warn` with nobody tailing it is not a signal.
        vi.mocked(getDb).mockImplementationOnce(() => {
            throw new Error('connection reset');
        });

        const slugs = await resolveAddonPurchaseSlugs({ purchaseIds: ['p1'] });

        expect(slugs.size).toBe(0);
        expect(Sentry.captureException).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                tags: expect.objectContaining({ action: 'resolve-addon-grant-domain' })
            })
        );
    });

    it('does not query at all for an empty id list', async () => {
        // The early return. Without it every entitlement load of a customer with
        // no add-on grants would pay for a round-trip.
        const slugs = await resolveAddonPurchaseSlugs({ purchaseIds: [] });

        expect(slugs.size).toBe(0);
        expect(getDb).not.toHaveBeenCalled();
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('admits every served add-on and refuses every foreign one', () => {
        for (const addon of ALL_ADDONS) {
            // `AddonDefinition.productDomain` is a required KEY with a nullable
            // VALUE (`mapRowToAddonDefinition` builds the same shape from a
            // `billing_addons` row an operator may have created off-catalogue).
            // Every static entry declares one; an `undefined` here would be
            // unplaceable, and unplaceable is admitted.
            const domain = addon.productDomain;
            const served = domain === undefined || CONSUMER_SIDE_PRODUCT_DOMAINS.includes(domain);
            expect(admitsAddonGrant({ ...CONSUMER, addonSlug: addon.slug })).toBe(served);
        }
    });
});
