/**
 * @file host-reviews-amenities.source.test.ts
 * @description HOS-2528 / HOS-2530 (AC-2.3, AC-2.5, AC-2.6). Vitest cannot render `.astro`
 * here, so these tests read the comment-stripped SOURCE of the components and pin the
 * behaviour that has no branching logic of its own: counts, wiring and removals.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Removes every match of `pattern`, repeating until none is left so nested fragments cannot re-form a marker. */
function stripUntilStable(source: string, pattern: RegExp): string {
    let current = source;
    let previous: string;
    do {
        previous = current;
        current = current.replace(pattern, '');
    } while (current !== previous);
    return current;
}

function read(relativePath: string): string {
    const source = readFileSync(resolve(__dirname, '../../../src', relativePath), 'utf8');
    const withoutCode = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return stripUntilStable(withoutCode, /<!--[\s\S]*?-->/g);
}

const AMENITIES = read('components/accommodation/AmenitiesGrid.astro');
const FEATURES = read('components/accommodation/FeaturesGrid.astro');
const REVIEWS = read('components/accommodation/ReviewPreview.astro');
const HOST = read('components/accommodation/HostSection.astro');
const PAGE = read('pages/[lang]/alojamientos/[slug].astro');

describe('AmenitiesGrid.astro (AC-2.3)', () => {
    it('shows 6 pills on mobile and 8 on desktop', () => {
        expect(AMENITIES).toMatch(/MOBILE_COUNT\s*=\s*6/);
        expect(AMENITIES).toMatch(/DESKTOP_COUNT\s*=\s*8/);
        expect(AMENITIES).toContain('entries.slice(0, DESKTOP_COUNT)');
        expect(AMENITIES).toContain('index >= MOBILE_COUNT');
    });

    it('opens the full list in the sheet island and no longer expands inline', () => {
        expect(AMENITIES).toContain('<ListingItemsSheet');
        expect(AMENITIES).toContain('client:idle');
        expect(AMENITIES).toContain('entries.map((entry) => <ListingPill');
        expect(AMENITIES).not.toContain('<script');
        expect(AMENITIES).not.toContain('data-amenities-toggle');
        expect(AMENITIES).not.toContain('nth-child');
        expect(AMENITIES).not.toContain('data-expanded');
    });

    it('renders every amenity past the visible pills in SSR, outside the closed sheet island (SEO / no-JS)', () => {
        expect(AMENITIES).toContain('entries.slice(DESKTOP_COUNT)');
        expect(AMENITIES).toContain('data-amenities-rest');
        // The rest list is a sibling of the island, never one of its children.
        const island = AMENITIES.slice(
            AMENITIES.indexOf('<ListingItemsSheet'),
            AMENITIES.indexOf('</ListingItemsSheet>')
        );
        expect(island).not.toContain('data-amenities-rest');
        expect(AMENITIES).toMatch(/<noscript>\s*<style is:inline>[\s\S]*data-amenities-rest/);
    });
});

describe('FeaturesGrid.astro (AC-2.3)', () => {
    it('summarizes only when there are more than 6 features and keeps the full grouped list in the sheet', () => {
        expect(FEATURES).toMatch(/SUMMARY_COUNT\s*=\s*6/);
        expect(FEATURES).toContain('features.length > SUMMARY_COUNT');
        expect(FEATURES).toContain('<ListingItemsSheet');
        expect(FEATURES).toContain('features.slice(0, SUMMARY_COUNT)');
    });

    it('renders the features past the summary in SSR, outside the closed sheet island (SEO / no-JS)', () => {
        expect(FEATURES).toContain('features.slice(SUMMARY_COUNT)');
        expect(FEATURES).toContain('data-features-rest');
        const island = FEATURES.slice(
            FEATURES.indexOf('<ListingItemsSheet'),
            FEATURES.indexOf('</ListingItemsSheet>')
        );
        expect(island).not.toContain('data-features-rest');
        expect(FEATURES).toMatch(/<noscript>\s*<style is:inline>[\s\S]*data-features-rest/);
    });
});

describe('ReviewPreview.astro (AC-2.6)', () => {
    it('keeps the empty state and renders the strip only for a listing with reviews', () => {
        expect(REVIEWS).toContain('accommodations.detail.reviewsDetail.noReviews');
        const emptyBranch = REVIEWS.indexOf('!hasReviews');
        const stripAt = REVIEWS.indexOf('data-review-strip');
        expect(emptyBranch).toBeGreaterThan(-1);
        expect(stripAt).toBeGreaterThan(emptyBranch);
        expect(REVIEWS).toContain('strip.length > 0');
    });

    it('opens the existing ReviewsModal from «Ver las N reseñas»', () => {
        expect(REVIEWS).toContain("'reviews-modal-trigger': ''");
        expect(REVIEWS).toContain('accommodations.detail.reviewsDetail.viewAll');
    });

    it('page feeds the strip from the loaded reviews, never sample data', () => {
        expect(PAGE).toContain('reviews={toReviewStripItems({ items: reviewItems })}');
    });
});

describe('HostSection.astro (AC-2.5)', () => {
    it('shows avatar, name, since date, optional languages and the contact button', () => {
        expect(HOST).toContain('owner.name');
        expect(HOST).toContain('accommodations.detail.host.since');
        expect(HOST).toContain('spokenLanguages.length > 0');
        expect(HOST).toContain('<HostContactButton');
        expect(HOST).toContain('panelId={panelId}');
    });

    it('never invents a «since» date and renders only for a real owner (AC-2.5)', () => {
        expect(HOST).toContain('owner.createdAt ?');
        expect(HOST).toContain('{sinceDate && <span class="host-section__since"');
        expect(PAGE).toContain('const hasHostSection = Boolean(accommodation.owner.id)');
        expect(PAGE).toContain('host: hasHostSection');
        expect(PAGE).toMatch(/\{hasHostSection && \(\s*<div id=\{LISTING_SECTION_IDS\.host\}/);
    });

    it('does not claim data that does not exist', () => {
        expect(HOST).not.toMatch(/responseTime|response_time|superhost|badge/i);
    });

    it('is mounted in the main column right before the location', () => {
        const host = PAGE.indexOf('<HostSection');
        const location = PAGE.indexOf('<LocationSection');
        expect(host).toBeGreaterThan(-1);
        expect(host).toBeLessThan(location);
        expect(PAGE).toContain('panelId={panelId}');
    });
});
