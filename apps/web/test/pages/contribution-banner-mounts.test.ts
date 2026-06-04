/**
 * @file contribution-banner-mounts.test.ts
 * @description Source-reading tests for the ContributionBanner mounts
 * (SPEC-191 FR-8) — locked placements per surface:
 *   - Destination detail: photos banner AFTER the gallery, before reviews
 *     (source: destination_detail)
 *   - Destination listing: photos banner AFTER the card grid
 *     (source: destination_listing); page/[page].astro is a redirect and is
 *     NOT touched
 *   - Blog + events listings: editors banner AFTER the grid, before the
 *     pagination slot (sources: blog_listing / events_listing); their
 *     page/[page].astro rewrites are NOT touched
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const detailSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/[...path].astro'),
    'utf8'
);

const destListingSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/index.astro'),
    'utf8'
);

const destPageRedirectSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/page/[page].astro'),
    'utf8'
);

const blogListingSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/index.astro'),
    'utf8'
);

const eventsListingSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro'),
    'utf8'
);

const blogPageRewriteSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/page/[page].astro'),
    'utf8'
);

const eventsPageRewriteSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/eventos/page/[page].astro'),
    'utf8'
);

describe('destination detail — photos banner (FR-8, source: destination_detail)', () => {
    it('mounts ContributionBanner with variant photos and source destination_detail', () => {
        expect(detailSrc).toContain('<ContributionBanner');
        expect(detailSrc).toContain('source="destination_detail"');
        expect(detailSrc).toContain('variant="photos"');
    });

    it('points the banner CTA at /colaborar/fotos via buildUrl', () => {
        expect(detailSrc).toContain("path: 'colaborar/fotos'");
    });

    it('places the banner after the gallery block and before the reviews section', () => {
        const galleryIdx = detailSrc.indexOf('<DestinationGallery');
        const bannerIdx = detailSrc.indexOf('<ContributionBanner');
        const reviewsIdx = detailSrc.indexOf('<DestinationReviewsSection');
        expect(galleryIdx).toBeGreaterThan(-1);
        expect(bannerIdx).toBeGreaterThan(galleryIdx);
        expect(bannerIdx).toBeLessThan(reviewsIdx);
    });

    it('passes translated copy from the contributions namespace', () => {
        expect(detailSrc).toMatch(/t\(\s*'contributions\.banner\.photos\./);
    });
});

describe('destinations listing — photos banner (FR-8, source: destination_listing)', () => {
    it('mounts ContributionBanner with variant photos and source destination_listing', () => {
        expect(destListingSrc).toContain('<ContributionBanner');
        expect(destListingSrc).toContain('source="destination_listing"');
        expect(destListingSrc).toContain('variant="photos"');
    });

    it('points the banner CTA at /colaborar/fotos via buildUrl', () => {
        expect(destListingSrc).toContain("path: 'colaborar/fotos'");
    });

    it('places the banner after the destination card grid', () => {
        const gridIdx = destListingSrc.indexOf('class="dest-grid"');
        const bannerIdx = destListingSrc.indexOf('<ContributionBanner');
        expect(gridIdx).toBeGreaterThan(-1);
        expect(bannerIdx).toBeGreaterThan(gridIdx);
    });

    it('does NOT touch the page/[page].astro redirect', () => {
        expect(destPageRedirectSrc).not.toContain('ContributionBanner');
    });
});

describe('blog listing — editors banner (FR-8, source: blog_listing)', () => {
    it('mounts ContributionBanner with variant editors and source blog_listing', () => {
        expect(blogListingSrc).toContain('<ContributionBanner');
        expect(blogListingSrc).toContain('source="blog_listing"');
        expect(blogListingSrc).toContain('variant="editors"');
    });

    it('points the banner CTA at /colaborar/editores via buildUrl', () => {
        expect(blogListingSrc).toContain("path: 'colaborar/editores'");
    });

    it('places the banner after the article grid, before the pagination slot', () => {
        const gridIdx = blogListingSrc.indexOf('class="posts-grid"');
        const bannerIdx = blogListingSrc.indexOf('<ContributionBanner');
        const paginationIdx = blogListingSrc.indexOf('<Pagination');
        expect(gridIdx).toBeGreaterThan(-1);
        expect(bannerIdx).toBeGreaterThan(gridIdx);
        expect(bannerIdx).toBeLessThan(paginationIdx);
    });

    it('does NOT touch the page/[page].astro rewrite', () => {
        expect(blogPageRewriteSrc).not.toContain('ContributionBanner');
    });
});

describe('events listing — editors banner (FR-8, source: events_listing)', () => {
    it('mounts ContributionBanner with variant editors and source events_listing', () => {
        expect(eventsListingSrc).toContain('<ContributionBanner');
        expect(eventsListingSrc).toContain('source="events_listing"');
        expect(eventsListingSrc).toContain('variant="editors"');
    });

    it('points the banner CTA at /colaborar/editores via buildUrl', () => {
        expect(eventsListingSrc).toContain("path: 'colaborar/editores'");
    });

    it('places the banner after the events grid, before the pagination slot', () => {
        const gridIdx = eventsListingSrc.indexOf('class="events-grid"');
        const bannerIdx = eventsListingSrc.indexOf('<ContributionBanner');
        const paginationIdx = eventsListingSrc.indexOf('<Pagination');
        expect(gridIdx).toBeGreaterThan(-1);
        expect(bannerIdx).toBeGreaterThan(gridIdx);
        expect(bannerIdx).toBeLessThan(paginationIdx);
    });

    it('does NOT touch the page/[page].astro rewrite', () => {
        expect(eventsPageRewriteSrc).not.toContain('ContributionBanner');
    });
});
