/**
 * @file addon-domain.test.ts
 * @description Unit tests for the per-domain addon catalog gate helpers
 * (HOS-689 item 2).
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
    it('resolves accommodation for a null affectsLimitKey (visibility-boost addons)', () => {
        // Arrange & Act
        const result = resolveAddonProductDomain({ affectsLimitKey: null });

        // Assert
        expect(result).toBe(ProductDomainEnum.ACCOMMODATION);
    });

    it('resolves accommodation for an accommodation-scoped limit key', () => {
        // Arrange & Act
        const result = resolveAddonProductDomain({ affectsLimitKey: 'max_accommodations' });

        // Assert
        expect(result).toBe(ProductDomainEnum.ACCOMMODATION);
    });

    it('resolves gastronomy for the gastronomy vertical cap', () => {
        // Arrange & Act
        const result = resolveAddonProductDomain({ affectsLimitKey: 'max_gastronomies' });

        // Assert
        expect(result).toBe(ProductDomainEnum.GASTRONOMY);
    });

    it('resolves experience for the experience vertical cap', () => {
        // Arrange & Act
        const result = resolveAddonProductDomain({ affectsLimitKey: 'max_experiences' });

        // Assert
        expect(result).toBe(ProductDomainEnum.EXPERIENCE);
    });
});

// ---------------------------------------------------------------------------
// filterAddonsByHeldDomains
// ---------------------------------------------------------------------------

describe('filterAddonsByHeldDomains', () => {
    const accommodationAddon = {
        slug: 'extra-accommodations-5',
        affectsLimitKey: 'max_accommodations'
    };
    const gastronomyAddon = { slug: 'extra-gastronomies-1', affectsLimitKey: 'max_gastronomies' };
    const experienceAddon = { slug: 'extra-experiences-1', affectsLimitKey: 'max_experiences' };
    const visibilityBoostAddon = { slug: 'visibility-boost-7d', affectsLimitKey: null };

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
