/**
 * @file addon-domain.test.ts
 * @description Unit tests for the per-domain addon catalog gate helpers
 * (HOS-689 item 2), reading the DECLARED domain since HOS-1178.
 *
 * These fixtures carry `productDomain` rather than `affectsLimitKey` because
 * the module no longer derives: `AddonResponse` declares the domain and this
 * reads it. The derivation cases these tests used to cover (a null
 * `affectsLimitKey` coerced to accommodation, a typo'd key answering nothing)
 * moved to where the fact is now decided — `packages/billing`'s
 * `productDomainForAddonSlug` and `addon-catalog.mapper`.
 *
 * The domain-resolution/filtering logic that makes a commerce-only owner see
 * gastronomy/experience addons without an accommodation subscription. The
 * HOS-594 "must use the canonical entitlement predicate, never a hand-rolled
 * status list" regression is covered separately by the static guard
 * `apps/web/test/pages/addons-status-gate-canonical-predicate.guard.test.ts`
 * — `isEntitlementGrantingStatus` is called directly in
 * `mi-cuenta/addons/index.astro` (that guard requires the call to live in
 * the page's own source), not wrapped in a helper here.
 */

import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    filterAddonsByHeldDomains,
    resolveAddonProductDomain
} from '../../../src/lib/billing/addon-domain';

// ---------------------------------------------------------------------------
// resolveAddonProductDomain
// ---------------------------------------------------------------------------

describe('resolveAddonProductDomain', () => {
    it.each([
        ['accommodation', ProductDomainEnum.ACCOMMODATION],
        ['gastronomy', ProductDomainEnum.GASTRONOMY],
        ['experience', ProductDomainEnum.EXPERIENCE]
    ])('reads the declared %s domain straight off the response', (declared, expected) => {
        expect(resolveAddonProductDomain({ productDomain: declared })).toBe(expected);
    });

    it('answers NO domain — never accommodation — when the API declared none', () => {
        // `productDomain: null` is what `AddonResponse` carries for an addon
        // whose slug is not in the catalogue (one an operator created through
        // the admin UI). Guessing accommodation here is the `?? ACCOMMODATION`
        // HOS-1078 deleted, and it would offer that addon to every host.
        //
        // `undefined` covers a response that predates the field entirely.
        for (const addon of [{ productDomain: null }, { productDomain: undefined }, {}]) {
            const result = resolveAddonProductDomain(addon);
            expect(result).toBeUndefined();
            expect(result).not.toBe(ProductDomainEnum.ACCOMMODATION);
        }
    });

    it('does NOT derive the domain from affectsLimitKey any more (HOS-1178)', () => {
        // The regression that matters most: while both paths were live they
        // could disagree, and the derived one was the presentation layer's.
        // An addon carrying a perfectly derivable `affectsLimitKey` and NO
        // declared domain must now resolve to nothing, not to gastronomy.
        const derivableButUndeclared = {
            affectsLimitKey: 'max_gastronomies',
            productDomain: null
        } as { affectsLimitKey: string; productDomain: string | null };

        expect(resolveAddonProductDomain(derivableButUndeclared)).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// filterAddonsByHeldDomains
// ---------------------------------------------------------------------------

describe('filterAddonsByHeldDomains', () => {
    const accommodationAddon = {
        slug: 'extra-accommodations-5',
        productDomain: ProductDomainEnum.ACCOMMODATION
    };
    const gastronomyAddon = {
        slug: 'extra-gastronomies-1',
        productDomain: ProductDomainEnum.GASTRONOMY
    };
    const experienceAddon = {
        slug: 'extra-experiences-1',
        productDomain: ProductDomainEnum.EXPERIENCE
    };
    // HOS-1178: this one is the reason the derivation could not stay. It has no
    // `affectsLimitKey` to derive from, so the old code coerced it to
    // accommodation by hand; now it DECLARES accommodation, which is the same
    // answer arrived at by reading instead of guessing.
    const visibilityBoostAddon = {
        slug: 'visibility-boost-7d',
        productDomain: ProductDomainEnum.ACCOMMODATION
    };

    it('returns only the addons whose domain the caller holds a subscription in', () => {
        // Arrange
        const addons = [accommodationAddon, gastronomyAddon, experienceAddon, visibilityBoostAddon];
        const domainsWithSubscription = new Set([ProductDomainEnum.GASTRONOMY]);

        // Act
        const result = filterAddonsByHeldDomains({ addons, domainsWithSubscription });

        // Assert — a commerce-only (gastronomy) owner sees ONLY the
        // gastronomy addon, not accommodation-scoped ones.
        expect(result).toEqual([gastronomyAddon]);
    });

    it('returns every addon when the caller holds all three domains', () => {
        // Arrange
        const addons = [accommodationAddon, gastronomyAddon, experienceAddon, visibilityBoostAddon];
        const domainsWithSubscription = new Set([
            ProductDomainEnum.ACCOMMODATION,
            ProductDomainEnum.GASTRONOMY,
            ProductDomainEnum.EXPERIENCE
        ]);

        // Act
        const result = filterAddonsByHeldDomains({ addons, domainsWithSubscription });

        // Assert
        expect(result).toEqual(addons);
    });

    it('returns an empty array when the caller holds no domain at all', () => {
        // Arrange
        const addons = [accommodationAddon, gastronomyAddon];

        // Act
        const result = filterAddonsByHeldDomains({ addons, domainsWithSubscription: new Set() });

        // Assert
        expect(result).toEqual([]);
    });

    it('drops an addon the API declared no domain for, even for a full holder (HOS-1078, HOS-1178)', () => {
        // Arrange — the caller holds EVERY domain, so the only thing that can
        // exclude this addon is its own undeclared domain. With the old
        // `?? 'accommodation'` default it was offered here.
        const typoAddon = { slug: 'operator-invented', productDomain: null };
        const addons = [accommodationAddon, typoAddon];
        const domainsWithSubscription = new Set([
            ProductDomainEnum.ACCOMMODATION,
            ProductDomainEnum.GASTRONOMY,
            ProductDomainEnum.EXPERIENCE
        ]);

        // Act
        const result = filterAddonsByHeldDomains({ addons, domainsWithSubscription });

        // Assert — the real addon survives (non-vacuity), the typo does not.
        expect(result).toEqual([accommodationAddon]);
    });

    it('never sums two verticals into one shared reading (AC-19 parity at the addon layer)', () => {
        // Arrange — held ONLY in experience, catalog has both vertical addons.
        const addons = [gastronomyAddon, experienceAddon];
        const domainsWithSubscription = new Set([ProductDomainEnum.EXPERIENCE]);

        // Act
        const result = filterAddonsByHeldDomains({ addons, domainsWithSubscription });

        // Assert — gastronomy must stay excluded even though experience is held.
        expect(result).toEqual([experienceAddon]);
        expect(result).not.toContain(gastronomyAddon);
    });
});
