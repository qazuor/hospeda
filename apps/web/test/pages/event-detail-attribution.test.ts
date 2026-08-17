/**
 * @file event-detail-attribution.test.ts
 * @description Integration tests for stock image attribution in event detail page (SPEC-274).
 *
 * Tests verify:
 * - ImageAttribution component is imported in event detail page
 * - Attribution renders when featuredImage.attribution exists
 * - Attribution is omitted when image is placeholder
 * - Overlay variant is used for hero image
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const eventDetailPage = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/eventos/[slug].astro'),
    'utf8'
);

describe('Event detail page - Stock image attribution (SPEC-274)', () => {
    describe('Component import', () => {
        it('should import ImageAttribution component', () => {
            expect(eventDetailPage).toContain(
                "import ImageAttribution from '@/components/shared/ImageAttribution.astro'"
            );
        });
    });

    describe('Attribution rendering', () => {
        it('should render ImageAttribution when attribution exists', () => {
            expect(eventDetailPage).toContain('{featuredImage.attribution && (');
            expect(eventDetailPage).toContain('<ImageAttribution');
        });

        it('should pass attribution prop to component', () => {
            expect(eventDetailPage).toContain('attribution={featuredImage.attribution}');
        });

        it('should pass locale prop', () => {
            expect(eventDetailPage).toContain('locale={locale}');
        });

        it('should use overlay variant for hero image', () => {
            expect(eventDetailPage).toContain('variant="overlay"');
        });

        it('should only render for non-placeholder images', () => {
            // Attribution lives inside the `!featuredIsPlaceholder ? (` branch,
            // which ends at the `) : null}` that drops the hero entirely.
            const branchStart = eventDetailPage.indexOf('!featuredIsPlaceholder ? (');
            expect(branchStart).toBeGreaterThan(-1);

            const attributionBlock = eventDetailPage.substring(branchStart).split(') : null}')[0];

            expect(attributionBlock).toContain('ImageAttribution');
        });
    });

    describe('Conditional rendering structure', () => {
        it('should render nothing when the featured image is a placeholder', () => {
            // No gallery and no real image must leave no hero markup at all —
            // neither a placeholder <img> nor a space-reserving wrapper.
            const branchStart = eventDetailPage.indexOf('!featuredIsPlaceholder ? (');
            expect(branchStart).toBeGreaterThan(-1);

            const heroBranch = eventDetailPage.substring(branchStart).split(') : null}')[0];

            expect(heroBranch).toContain('event-detail__hero');
            expect(heroBranch).not.toContain('placeholder');
            // The falsy arm renders nothing at all.
            expect(eventDetailPage).toContain(') : null}');
        });

        it('should be positioned after Image component', () => {
            // Find the hero section where both Image and ImageAttribution render
            const heroSection = eventDetailPage.substring(
                eventDetailPage.indexOf('event-detail__hero')
            );
            const imageTagIndex = heroSection.indexOf('<Image\n');
            const attributionIndex = heroSection.indexOf('ImageAttribution');
            expect(attributionIndex).toBeGreaterThan(imageTagIndex);
        });
    });
});

describe('Event detail page - Type safety', () => {
    it('should have featuredImage type with attribution field', () => {
        const typesFile = readFileSync(resolve(__dirname, '../../src/data/types.ts'), 'utf8');

        // Find EventDetailData interface
        const eventDetailDataMatch = typesFile.match(
            /export interface EventDetailData \{[\s\S]*?\n {4}\/\/ --- Media ---[\s\S]*?featuredImage: \{[\s\S]*?\}/
        );

        expect(eventDetailDataMatch).toBeTruthy();
        // Asserted outside an `if`, so a regex that stops matching fails the
        // test instead of skipping every assertion below it.
        const mediaBlock = eventDetailDataMatch?.[0] ?? '';

        expect(mediaBlock).toContain('attribution?:');
        // The shared type, not a fourth inline copy of the same four fields.
        // The inline copies were what let each consumer declare its own subtly
        // different shape — one of them requiring all four subfields, which is
        // what silently discarded a credit that carried only a photographer
        // (H-125).
        expect(mediaBlock).toContain('MediaAttribution');
    });

    it('declares the credit through the shared type, not a local copy', () => {
        const typesFile = readFileSync(resolve(__dirname, '../../src/data/types.ts'), 'utf8');

        // A re-declared `provider: 'unsplash' | 'pexels'` union anywhere in this
        // file means a consumer has forked the shape again — and a fork here
        // cannot express `user-upload`, the provider a host's own photo carries.
        expect(typesFile).not.toMatch(/provider:\s*'unsplash'\s*\|\s*'pexels'/);
        expect(typesFile).toContain("import type { MediaAttribution } from '../lib/media'");
    });
});
