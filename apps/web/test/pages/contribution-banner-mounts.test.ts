/**
 * @file contribution-banner-mounts.test.ts
 * @description Source-reading tests for the ContributionBanner mounts
 * (SPEC-191 FR-8) — locked placements per surface:
 *   - Destination detail: photos banner AFTER the gallery, before reviews
 *     (source: destination_detail)
 *
 * T-012/T-013 extend this file with the listing mounts.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const detailSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/[...path].astro'),
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
