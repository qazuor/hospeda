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
            // Attribution is inside the {!featuredIsPlaceholder ? ...} block
            const attributionBlock = eventDetailPage
                .substring(eventDetailPage.indexOf('{!featuredIsPlaceholder ? ('))
                .split(') : (')[0];

            expect(attributionBlock).toContain('ImageAttribution');
        });
    });

    describe('Conditional rendering structure', () => {
        it('should wrap attribution in fragment with Image component', () => {
            expect(eventDetailPage).toContain('<>');
            expect(eventDetailPage).toContain('</>');
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

        if (eventDetailDataMatch) {
            const mediaBlock = eventDetailDataMatch[0];
            expect(mediaBlock).toContain('attribution?:');
            expect(mediaBlock).toContain('photographer: string');
            expect(mediaBlock).toContain('sourceUrl: string');
            expect(mediaBlock).toContain('license: string');
            expect(mediaBlock).toContain("provider: 'unsplash' | 'pexels'");
        }
    });
});
