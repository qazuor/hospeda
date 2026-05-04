/**
 * @file DestinationRelatedPosts.test.ts
 * @description Source-based assertions for DestinationRelatedPosts.astro.
 * Astro components cannot be DOM-rendered in Vitest; we assert on source content.
 *
 * Coverage:
 * - imports (RelatedPostCard, i18n, types)
 * - props interface (posts, destinationName, locale, destinationId)
 * - early return when posts array is empty
 * - cap at MAX_VISIBLE (3)
 * - "see all" link rendered only when hasMore
 * - i18n keys for title, subtitle, see-all
 * - locale forwarded to RelatedPostCard as lang prop
 * - responsive grid (1/2/3 columns)
 * - CSS custom property usage
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/destination/DestinationRelatedPosts.astro'),
    'utf8'
);

describe('DestinationRelatedPosts.astro', () => {
    describe('imports', () => {
        it('should import RelatedPostCard from shared cards', () => {
            expect(src).toContain("from '@/components/shared/cards/RelatedPostCard.astro'");
            expect(src).toContain('RelatedPostCard');
        });

        it('should import createTranslations and SupportedLocale from @/lib/i18n', () => {
            expect(src).toContain("from '@/lib/i18n'");
            expect(src).toContain('createTranslations');
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props', () => {
        it('should declare posts as ReadonlyArray<unknown>', () => {
            expect(src).toContain('readonly posts: ReadonlyArray<unknown>');
        });

        it('should declare destinationName as readonly string', () => {
            expect(src).toContain('readonly destinationName: string');
        });

        it('should declare locale as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('should declare destinationId as optional', () => {
            expect(src).toContain('readonly destinationId?:');
        });
    });

    describe('rendering', () => {
        it('should return early when posts array is empty', () => {
            expect(src).toContain('posts.length === 0');
            expect(src).toContain('return');
        });

        it('should cap visible posts at MAX_VISIBLE = 3', () => {
            expect(src).toContain('MAX_VISIBLE = 3');
            expect(src).toContain('.slice(0, MAX_VISIBLE)');
        });

        it('should compute hasMore when posts.length > MAX_VISIBLE', () => {
            expect(src).toContain('posts.length > MAX_VISIBLE');
            expect(src).toContain('hasMore');
        });

        it('should render the "see all" link conditionally on hasMore', () => {
            expect(src).toContain('hasMore');
            expect(src).toContain("'destination.detail.relatedPosts.seeAll'");
        });

        it('should pass lang={locale} to RelatedPostCard', () => {
            expect(src).toContain('lang={locale}');
        });

        it('should pass slug to RelatedPostCard', () => {
            expect(src).toContain('slug={post.slug}');
        });

        it('should pass title to RelatedPostCard', () => {
            expect(src).toContain('title={post.title}');
        });
    });

    describe('i18n', () => {
        it('should call createTranslations(locale)', () => {
            expect(src).toContain('createTranslations(locale)');
        });

        it('should use t() for section title with destinationName interpolation', () => {
            expect(src).toContain("'destination.detail.relatedPosts.title'");
            expect(src).toContain('name: destinationName');
        });

        it('should use t() for subtitle', () => {
            expect(src).toContain("'destination.detail.relatedPosts.subtitle'");
        });

        it('should include Spanish fallback for subtitle', () => {
            expect(src).toContain('Notas y guías relacionadas');
        });

        it('should include Spanish fallback for see-all link', () => {
            expect(src).toContain('Ver todas las publicaciones');
        });
    });

    describe('accessibility', () => {
        it('should label section with aria-labelledby', () => {
            expect(src).toContain('aria-labelledby="dest-related-posts-title"');
        });

        it('should provide matching id on the section heading', () => {
            expect(src).toContain('id="dest-related-posts-title"');
        });
    });

    describe('styling', () => {
        it('should use CSS custom properties only (no hardcoded hex colors)', () => {
            expect(src).toContain('var(--');
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        });

        it('should use --core-foreground for title text', () => {
            expect(src).toContain('var(--core-foreground)');
        });

        it('should use --core-muted-foreground for subtitle text', () => {
            expect(src).toContain('var(--core-muted-foreground)');
        });

        it('should use a 1-col → 2-col → 3-col responsive grid', () => {
            expect(src).toContain('repeat(2, 1fr)');
            expect(src).toContain('repeat(3, 1fr)');
        });

        it('should use --radius-pill on the see-all link', () => {
            expect(src).toContain('var(--radius-pill)');
        });

        it('should use --core-card for see-all link background', () => {
            expect(src).toContain('var(--core-card)');
        });
    });
});
