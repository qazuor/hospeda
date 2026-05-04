/**
 * @file DestinationGallery.test.ts
 * @description Source-based assertions for DestinationGallery.astro.
 * Astro components cannot be DOM-rendered in Vitest; we assert on source content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationGallery.astro'),
    'utf8'
);

describe('DestinationGallery.astro', () => {
    describe('imports', () => {
        it('should import ImageGallery from the shared island', () => {
            expect(src).toContain("from '@/components/ImageGallery.client'");
            expect(src).toContain('ImageGallery');
        });

        it('should import GalleryImage type from the shared island', () => {
            expect(src).toContain('GalleryImage');
        });

        it('should import createTranslations from @/lib/i18n', () => {
            expect(src).toContain("from '@/lib/i18n'");
            expect(src).toContain('createTranslations');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props', () => {
        it('should declare featuredImage as readonly with url', () => {
            expect(src).toContain('readonly featuredImage: FeaturedImage');
        });

        it('should declare gallery as readonly ReadonlyArray', () => {
            expect(src).toContain('readonly gallery: ReadonlyArray<GalleryItem>');
        });

        it('should declare destinationName as readonly string', () => {
            expect(src).toContain('readonly destinationName: string');
        });

        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('rendering', () => {
        it('should return early when no real images exist', () => {
            expect(src).toContain('hasRealImages');
            expect(src).toContain('return');
        });

        it('should deduplicate images by URL using a Set', () => {
            expect(src).toContain('new Set<string>()');
            expect(src).toContain('seen.has(url)');
            expect(src).toContain('seen.add(url)');
        });

        it('should combine featuredImage and gallery items', () => {
            expect(src).toContain('featuredImage.url');
            expect(src).toContain('for (const item of gallery)');
        });

        it('should pass variant="detail" to ImageGallery', () => {
            expect(src).toContain('variant="detail"');
        });

        it('should hydrate the island with client:visible', () => {
            expect(src).toContain('client:visible');
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for section title with fallback', () => {
            expect(src).toContain("t('destination.detail.gallery.title'");
            expect(src).toContain('Galería');
        });
    });

    describe('accessibility', () => {
        it('should provide aria-labelledby on the section', () => {
            expect(src).toContain('aria-labelledby="dest-gallery-title"');
        });

        it('should label the section heading with matching id', () => {
            expect(src).toContain('id="dest-gallery-title"');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties only (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should use --font-heading for section title', () => {
            expect(src).toContain('var(--font-heading)');
        });

        it('should use --core-foreground for title color', () => {
            expect(src).toContain('var(--core-foreground)');
        });
    });
});
