/**
 * @file addon-domain.test.ts
 * @description Unit tests for the per-domain addon catalog gate helpers
 * (HOS-689 item 2).
 *
 * Covers the HOS-594 regression directly at the predicate level (a `comp`
 * subscription must be treated as usable) instead of relying on a
 * source-string match, and the domain-resolution/filtering logic that makes
 * a commerce-only owner see gastronomy/experience addons without an
 * accommodation subscription.
 */

import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    filterAddonsByHeldDomains,
    isUsableSubscription,
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
// isUsableSubscription — HOS-594 regression (comp must count as usable)
// ---------------------------------------------------------------------------

describe('isUsableSubscription', () => {
    it('returns false for a null subscription', () => {
        expect(isUsableSubscription(null)).toBe(false);
    });

    it('returns true for an active subscription', () => {
        expect(isUsableSubscription({ status: 'active' })).toBe(true);
    });

    it('returns true for a trialing subscription', () => {
        expect(isUsableSubscription({ status: 'trialing' })).toBe(true);
    });

    it('returns true for a comp subscription (HOS-594 regression)', () => {
        // A hand-rolled ['active', 'trial', 'trialing'] list silently omits
        // 'comp' — exactly the bug HOS-594 fixed at the API layer. This
        // predicate must not repeat it.
        expect(isUsableSubscription({ status: 'comp' })).toBe(true);
    });

    it('returns true for the web-mapped "trial" status (deliberate exception)', () => {
        expect(isUsableSubscription({ status: 'trial' })).toBe(true);
    });

    it('returns false for a cancelled subscription', () => {
        expect(isUsableSubscription({ status: 'cancelled' })).toBe(false);
    });

    it('returns false for an expired subscription', () => {
        expect(isUsableSubscription({ status: 'expired' })).toBe(false);
    });

    it('returns false for a past_due subscription', () => {
        expect(isUsableSubscription({ status: 'past_due' })).toBe(false);
    });

    it('returns false for a pending subscription', () => {
        expect(isUsableSubscription({ status: 'pending' })).toBe(false);
    });

    it('returns false for a paused subscription', () => {
        expect(isUsableSubscription({ status: 'paused' })).toBe(false);
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
