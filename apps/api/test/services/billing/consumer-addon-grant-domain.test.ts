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
 * @module test/services/billing/consumer-addon-grant-domain
 */

import { ALL_ADDONS } from '@repo/billing';
import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    admitsConsumerAddonGrant,
    CONSUMER_SIDE_PRODUCT_DOMAINS,
    classifyConsumerAddonGrant
} from '../../../src/services/billing/consumer-addon-grant-domain';

describe('classifyConsumerAddonGrant — the five verticals of the billing axis', () => {
    it('serves an ACCOMMODATION add-on', () => {
        expect(classifyConsumerAddonGrant({ addonSlug: 'visibility-boost-7d' })).toEqual({
            kind: 'served',
            domain: ProductDomainEnum.ACCOMMODATION
        });
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
            expect(classifyConsumerAddonGrant({ addonSlug: slug })).toEqual({
                kind: 'served',
                domain: ProductDomainEnum.ACCOMMODATION
            });
        }
    });

    it('refuses a GASTRONOMY add-on — the measured leak', () => {
        // `visibility-boost-gastronomy-7d` grants EntitlementKey.FEATURED_LISTING,
        // the same key the accommodation boost grants. The key cannot tell them
        // apart; only the add-on's declared domain can.
        expect(classifyConsumerAddonGrant({ addonSlug: 'visibility-boost-gastronomy-7d' })).toEqual(
            {
                kind: 'foreign',
                domain: ProductDomainEnum.GASTRONOMY
            }
        );
        expect(classifyConsumerAddonGrant({ addonSlug: 'extra-gastronomies-1' })).toEqual({
            kind: 'foreign',
            domain: ProductDomainEnum.GASTRONOMY
        });
    });

    it('refuses an EXPERIENCE add-on', () => {
        expect(
            classifyConsumerAddonGrant({ addonSlug: 'visibility-boost-experience-30d' })
        ).toEqual({
            kind: 'foreign',
            domain: ProductDomainEnum.EXPERIENCE
        });
        expect(classifyConsumerAddonGrant({ addonSlug: 'private-galleries-5' })).toEqual({
            kind: 'foreign',
            domain: ProductDomainEnum.EXPERIENCE
        });
    });

    it('serves TOURIST, the fifth vertical, which shares this loader with accommodation', () => {
        expect(CONSUMER_SIDE_PRODUCT_DOMAINS).toContain(ProductDomainEnum.TOURIST);
        expect(CONSUMER_SIDE_PRODUCT_DOMAINS).toContain(ProductDomainEnum.ACCOMMODATION);
        expect(CONSUMER_SIDE_PRODUCT_DOMAINS).toHaveLength(2);
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
            const verdict = classifyConsumerAddonGrant({ addonSlug: addon.slug });
            expect(verdict.kind).not.toBe('unplaceable');
            expect(verdict).toMatchObject({ domain: addon.productDomain });
        }
    });
});

describe('classifyConsumerAddonGrant — unplaceable is ADMITTED, never refused', () => {
    it('answers unplaceable for a slug outside the catalogue', () => {
        expect(classifyConsumerAddonGrant({ addonSlug: 'operator-invented' })).toEqual({
            kind: 'unplaceable',
            reason: 'unknown-slug'
        });
    });

    it('admits it anyway — refusing would strip an entitlement a customer paid for', () => {
        // The posture inversion versus HOS-1279, asserted rather than only
        // documented: there, refusing means "leave the cap alone"; here it means
        // "take the feature away".
        expect(admitsConsumerAddonGrant({ addonSlug: 'operator-invented' })).toBe(true);
        expect(admitsConsumerAddonGrant({ addonSlug: '' })).toBe(true);
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
            expect(admitsConsumerAddonGrant({ addonSlug: addon.slug })).toBe(served);
        }
    });
});
