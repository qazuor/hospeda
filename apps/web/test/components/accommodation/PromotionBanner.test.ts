/**
 * @file PromotionBanner.test.ts
 * @description Source-reading tests for PromotionBanner.astro (SPEC-285 T-009).
 *
 * Vitest cannot render `.astro` files, so these tests pin the component's
 * source shape: correct imports, discount-type handling, validity rendering,
 * empty-state early return, and accessibility attributes.
 *
 * Coverage:
 *  - Three discount types: percentage, fixed, free_night
 *  - Validity rendering (validUntil label)
 *  - minNights conditional rendering
 *  - Empty-state early return (no HTML when promos is empty)
 *  - i18n key usage and formatting-utility imports
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSrc = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/PromotionBanner.astro'),
    'utf8'
);

const detailPageSrc = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/alojamientos/[slug].astro'),
    'utf8'
);

const endpointsSrc = readFileSync(resolve(__dirname, '../../../src/lib/api/endpoints.ts'), 'utf8');

// ─── PromotionBanner.astro ────────────────────────────────────────────────────

describe('PromotionBanner.astro — imports', () => {
    it('imports OwnerPromotionPublicItem type from the central endpoints module', () => {
        expect(componentSrc).toContain("from '@/lib/api/endpoints'");
        expect(componentSrc).toContain('OwnerPromotionPublicItem');
    });

    it('imports formatDate and formatPrice from format-utils', () => {
        expect(componentSrc).toContain("from '@/lib/format-utils'");
        expect(componentSrc).toContain('formatDate');
        expect(componentSrc).toContain('formatPrice');
    });

    it('imports createTranslations for i18n', () => {
        expect(componentSrc).toContain("from '@/lib/i18n'");
        expect(componentSrc).toContain('createTranslations');
    });
});

describe('PromotionBanner.astro — Props interface', () => {
    it('declares a promos prop', () => {
        expect(componentSrc).toContain('promos');
    });

    it('declares a locale prop typed as SupportedLocale', () => {
        expect(componentSrc).toContain('locale');
        expect(componentSrc).toContain('SupportedLocale');
    });
});

describe('PromotionBanner.astro — empty state', () => {
    it('returns early (renders nothing) when the promos list is empty', () => {
        // Guards against empty arrays: promos.length === 0 → early return
        expect(componentSrc).toMatch(/promos\.length\s*===\s*0\s*\)\s*return/);
    });

    it('does NOT call fetch() directly (must go through apiClient)', () => {
        expect(componentSrc).not.toMatch(/\bfetch\(/);
    });
});

describe('PromotionBanner.astro — discount type rendering', () => {
    it('handles percentage discount type using the value directly', () => {
        // For percentage: renders "{discountValue}% {discountOff key}"
        expect(componentSrc).toContain("discountType === 'percentage'");
        expect(componentSrc).toContain('discountValue');
    });

    it('handles fixed discount type using formatPrice for centavos formatting', () => {
        // For fixed: uses formatPrice to convert centavos to currency string
        expect(componentSrc).toContain("discountType === 'fixed'");
        expect(componentSrc).toContain('formatPrice');
        expect(componentSrc).toContain('amount');
    });

    it('handles free_night discount type using the host.promotions.discountTypes key', () => {
        // For free_night: reuses existing owner-side i18n key
        expect(componentSrc).toContain("discountType === 'free_night'");
        expect(componentSrc).toContain('host.promotions.discountTypes.free_night');
    });

    it('uses accommodations.detail.promotions.discountOff suffix key for percentage and fixed', () => {
        expect(componentSrc).toContain('accommodations.detail.promotions.discountOff');
    });
});

describe('PromotionBanner.astro — validity rendering', () => {
    it('renders the section title via accommodations.detail.promotions.sectionTitle', () => {
        expect(componentSrc).toContain('accommodations.detail.promotions.sectionTitle');
    });

    it('renders validUntil label when validUntil is set', () => {
        expect(componentSrc).toContain('accommodations.detail.promotions.validUntil');
        expect(componentSrc).toContain('promo.validUntil');
        // Must use formatDate to produce a locale-aware date string
        expect(componentSrc).toContain('formatDate');
    });

    it('renders minNights label when minNights is set', () => {
        expect(componentSrc).toContain('accommodations.detail.promotions.minNights');
        expect(componentSrc).toContain('promo.minNights');
    });

    it('guards validUntil rendering (only when value is truthy)', () => {
        // Null/undefined validUntil must not produce a label
        expect(componentSrc).toMatch(/promo\.validUntil\s*\?/);
    });

    it('guards minNights rendering (only when value is not null)', () => {
        expect(componentSrc).toMatch(/promo\.minNights\s*!=\s*null/);
    });
});

describe('PromotionBanner.astro — accessibility and HTML structure', () => {
    it('wraps the section with an aria-label attribute', () => {
        expect(componentSrc).toContain('aria-label');
    });

    it('uses a <section> element as the outer container', () => {
        expect(componentSrc).toContain('<section');
    });

    it('uses an <h2> for the section title (correct heading level for detail page)', () => {
        expect(componentSrc).toContain('<h2 class="promo-banner__title">');
    });

    it('uses a <ul> list for multiple promotions', () => {
        expect(componentSrc).toContain('<ul');
        expect(componentSrc).toContain('role="list"');
    });

    it('uses <li> items inside the list', () => {
        expect(componentSrc).toContain('<li ');
    });

    it('renders promo title in a paragraph', () => {
        expect(componentSrc).toContain('promo.title');
    });

    it('has scoped CSS styles (no Tailwind utility classes)', () => {
        // Web convention: no Tailwind; use scoped <style> or CSS Modules
        expect(componentSrc).toContain('<style>');
        // Tailwind classes are forbidden in web components
        expect(componentSrc).not.toMatch(/class="[^"]*(?:flex-col|grid-cols|text-\w+|bg-\w+|p-\d)/);
    });
});

// ─── Detail page wiring ───────────────────────────────────────────────────────

describe('Detail page — PromotionBanner wiring (SPEC-285 T-007)', () => {
    it('imports PromotionBanner from the accommodation components folder', () => {
        expect(detailPageSrc).toContain("from '@/components/accommodation/PromotionBanner.astro'");
    });

    it('imports ownerPromotionsApi from the central endpoints module', () => {
        expect(detailPageSrc).toContain('ownerPromotionsApi');
        expect(detailPageSrc).toContain("from '@/lib/api/endpoints'");
    });

    it('imports OwnerPromotionPublicItem type from endpoints', () => {
        expect(detailPageSrc).toContain('OwnerPromotionPublicItem');
    });

    it('adds promotionsResult to the Promise.allSettled destructure', () => {
        expect(detailPageSrc).toContain('promotionsResult');
        expect(detailPageSrc).toContain('Promise.allSettled');
    });

    it('calls ownerPromotionsApi.listByAccommodation with the accommodation id', () => {
        expect(detailPageSrc).toContain('ownerPromotionsApi.listByAccommodation');
        expect(detailPageSrc).toContain('accommodationId: accommodation.id');
    });

    it('extracts activePromos using the existing extractItems helper', () => {
        expect(detailPageSrc).toContain('activePromos');
        expect(detailPageSrc).toContain('extractItems(promotionsResult)');
    });

    it('mounts PromotionBanner with the promos and locale props', () => {
        expect(detailPageSrc).toMatch(/<PromotionBanner[^>]*promos=\{activePromos\}/);
        expect(detailPageSrc).toMatch(/<PromotionBanner[^>]*locale=\{locale\}/);
    });

    it('places PromotionBanner after AmenitiesGrid and before ReviewPreview', () => {
        const amenitiesIdx = detailPageSrc.indexOf('<AmenitiesGrid');
        const bannerIdx = detailPageSrc.indexOf('<PromotionBanner');
        const reviewIdx = detailPageSrc.indexOf('<ReviewPreview');
        expect(amenitiesIdx).toBeGreaterThan(-1);
        expect(bannerIdx).toBeGreaterThan(-1);
        expect(reviewIdx).toBeGreaterThan(-1);
        expect(bannerIdx).toBeGreaterThan(amenitiesIdx);
        expect(bannerIdx).toBeLessThan(reviewIdx);
    });
});

// ─── API client (ownerPromotionsApi) ─────────────────────────────────────────

describe('ownerPromotionsApi (SPEC-285 T-005)', () => {
    it('exports ownerPromotionsApi', () => {
        expect(endpointsSrc).toContain('export const ownerPromotionsApi');
    });

    it('provides a listByAccommodation method', () => {
        expect(endpointsSrc).toContain('listByAccommodation');
    });

    it('routes through apiClient.getList at the public owner-promotions path', () => {
        expect(endpointsSrc).toContain('owner-promotions');
        expect(endpointsSrc).toContain('apiClient.getList');
    });

    it('passes accommodationId as a query param', () => {
        expect(endpointsSrc).toContain('params: { accommodationId }');
    });

    it('exports the OwnerPromotionPublicItem interface', () => {
        expect(endpointsSrc).toContain('export interface OwnerPromotionPublicItem');
    });

    it('documents the three discount types on the interface', () => {
        expect(endpointsSrc).toContain("'percentage' | 'fixed' | 'free_night'");
    });

    it('does NOT call fetch() directly (must route through apiClient)', () => {
        // Extract only the ownerPromotionsApi block to keep the check scoped
        const apiBlock = endpointsSrc.slice(
            endpointsSrc.indexOf('ownerPromotionsApi'),
            endpointsSrc.indexOf('partnerApi')
        );
        expect(apiBlock).not.toMatch(/\bfetch\(/);
    });
});
