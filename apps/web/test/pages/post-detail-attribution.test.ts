/**
 * @file post-detail-attribution.test.ts
 * @description Integration tests for stock image attribution in post detail page (SPEC-274).
 *
 * Tests verify:
 * - ImageAttribution component is imported in post detail page
 * - Attribution renders when media.featuredImage.attribution exists
 * - Overlay variant is used for cover image
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const postDetailPage = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/[slug].astro'),
    'utf8'
);

describe('Post detail page - Stock image attribution (SPEC-274)', () => {
    describe('Component import', () => {
        it('should import ImageAttribution component', () => {
            expect(postDetailPage).toContain(
                "import ImageAttribution from '@/components/shared/ImageAttribution.astro'"
            );
        });
    });

    describe('Type definition', () => {
        it('should extend RawMediaImage with attribution field', () => {
            expect(postDetailPage).toContain('interface RawMediaImage {');
            expect(postDetailPage).toContain('attribution?: {');
            expect(postDetailPage).toContain('photographer: string');
            expect(postDetailPage).toContain('sourceUrl: string');
            expect(postDetailPage).toContain('license: string');
            expect(postDetailPage).toContain("provider: 'unsplash' | 'pexels'");
        });
    });

    describe('Attribution rendering', () => {
        it('should render ImageAttribution when attribution exists', () => {
            expect(postDetailPage).toContain('{mediaObj?.featuredImage?.attribution && (');
            expect(postDetailPage).toContain('<ImageAttribution');
        });

        it('should pass attribution prop from media object', () => {
            expect(postDetailPage).toContain('attribution={mediaObj.featuredImage.attribution}');
        });

        it('should pass locale prop', () => {
            expect(postDetailPage).toContain('locale={locale}');
        });

        it('should use overlay variant for cover image', () => {
            expect(postDetailPage).toContain('variant="overlay"');
        });

        it('should be inside post-detail__cover div', () => {
            // Find the cover section where ImageAttribution renders
            const coverSectionStart = postDetailPage.indexOf('class="post-detail__cover"');
            const coverSectionEnd = postDetailPage.indexOf('</div>', coverSectionStart + 50);
            // Find the usage of ImageAttribution component (not the import)
            const attributionIndex = postDetailPage.indexOf('<ImageAttribution', coverSectionStart);

            expect(coverSectionStart).toBeGreaterThan(-1);
            expect(attributionIndex).toBeGreaterThan(coverSectionStart);
            expect(attributionIndex).toBeLessThan(coverSectionEnd);
        });
    });
});

describe('Post detail page - Media extraction', () => {
    it('should extract attribution from media object', () => {
        // Verify the page accesses mediaObj?.featuredImage?.attribution
        expect(postDetailPage).toContain('mediaObj?.featuredImage?.attribution');
    });

    it('should handle optional chaining for safe access', () => {
        // Optional chaining prevents errors when media or featuredImage is null
        expect(postDetailPage).toContain('mediaObj?.featuredImage?.attribution');
    });
});
