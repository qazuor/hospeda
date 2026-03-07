/**
 * @file blog-variants.test.ts
 * @description Source-content tests for paginated blog routes:
 * - publicaciones/page/[page].astro (pagination redirect/rewrite)
 * - publicaciones/etiqueta/[tag]/index.astro (tag filter listing)
 * - publicaciones/etiqueta/[tag]/page/[page].astro (paginated tag listing)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const paginationSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/page/[page].astro'),
    'utf8'
);

const tagIndexSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro'),
    'utf8'
);

const tagPaginationSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/etiqueta/[tag]/page/[page].astro'),
    'utf8'
);

describe('publicaciones/page/[page].astro — pagination redirect/rewrite', () => {
    describe('locale validation', () => {
        it('calls getLocaleFromParams', () => {
            expect(paginationSrc).toContain('getLocaleFromParams(Astro.params)');
        });

        it('redirects to /es/ on invalid locale', () => {
            expect(paginationSrc).toContain("Astro.redirect('/es/')");
        });
    });

    describe('page number validation', () => {
        it('parses page param as integer', () => {
            expect(paginationSrc).toContain('Number.parseInt');
        });

        it('redirects page 1 to canonical base URL (no /page/ segment)', () => {
            expect(paginationSrc).toContain('pageNum === 1');
            expect(paginationSrc).toContain('/publicaciones/');
        });

        it('redirects when page number is NaN', () => {
            expect(paginationSrc).toContain('Number.isNaN(pageNum)');
        });

        it('redirects when page number is less than 1', () => {
            expect(paginationSrc).toContain('pageNum < 1');
        });
    });

    describe('rewrite behaviour', () => {
        it('rewrites to index page with page query param', () => {
            expect(paginationSrc).toContain('Astro.rewrite');
            expect(paginationSrc).toContain('?page=');
        });
    });
});

describe('publicaciones/etiqueta/[tag]/index.astro — tag filter listing', () => {
    describe('layout and SEO', () => {
        it('uses BaseLayout', () => {
            expect(tagIndexSrc).toContain('BaseLayout');
        });

        it('uses SEOHead', () => {
            expect(tagIndexSrc).toContain('SEOHead');
            expect(tagIndexSrc).toContain('slot="head"');
        });

        it('builds canonical URL', () => {
            expect(tagIndexSrc).toContain('canonicalUrl');
            expect(tagIndexSrc).toContain('Astro.site');
        });
    });

    describe('imports and dependencies', () => {
        it('imports Breadcrumb', () => {
            expect(tagIndexSrc).toContain('Breadcrumb');
        });

        it('imports EmptyState', () => {
            expect(tagIndexSrc).toContain('EmptyState');
        });

        it('imports Pagination', () => {
            expect(tagIndexSrc).toContain('Pagination');
        });

        it('imports FeaturedArticleCard', () => {
            expect(tagIndexSrc).toContain('FeaturedArticleCard');
        });

        it('imports SecondaryArticleCard', () => {
            expect(tagIndexSrc).toContain('SecondaryArticleCard');
        });

        it('imports tagsApi from endpoints', () => {
            expect(tagIndexSrc).toContain('tagsApi');
            expect(tagIndexSrc).toContain('endpoints');
        });

        it('imports apiClient for direct post fetching', () => {
            expect(tagIndexSrc).toContain('apiClient');
        });

        it('imports toPostCardProps transform', () => {
            expect(tagIndexSrc).toContain('toPostCardProps');
        });
    });

    describe('locale and tag validation', () => {
        it('validates locale and redirects on failure', () => {
            expect(tagIndexSrc).toContain("Astro.redirect('/es/publicaciones/')");
        });

        it('validates tag param is a non-empty string', () => {
            expect(tagIndexSrc).toContain("typeof tag !== 'string'");
            expect(tagIndexSrc).toContain("tag.trim() === ''");
        });
    });

    describe('tag metadata fetch', () => {
        it('fetches tag by slug', () => {
            expect(tagIndexSrc).toContain('tagsApi.getBySlug({ slug: tagSlug })');
        });

        it('redirects when tag is not found', () => {
            expect(tagIndexSrc).toContain('!tagResult.ok');
        });
    });

    describe('posts fetch with tag filter', () => {
        it('calls apiClient.getList with tags param', () => {
            expect(tagIndexSrc).toContain('apiClient.getList');
            expect(tagIndexSrc).toContain('tags: tagData.id');
        });

        it('uses /api/v1/public/posts endpoint path', () => {
            expect(tagIndexSrc).toContain('/api/v1/public/posts');
        });
    });

    describe('posts grid and pagination', () => {
        it('handles API error with EmptyState', () => {
            expect(tagIndexSrc).toContain('apiError');
        });

        it('shows FeaturedArticleCard for first post', () => {
            expect(tagIndexSrc).toContain('postCards[0]');
        });

        it('shows SecondaryArticleCard for remaining posts', () => {
            expect(tagIndexSrc).toContain('postCards.slice(1)');
        });

        it('renders Pagination when multiple pages exist', () => {
            expect(tagIndexSrc).toContain('pagination.totalPages > 1');
        });
    });

    describe('semantic tokens — no hardcoded colors', () => {
        it('does not use bg-white', () => {
            expect(tagIndexSrc).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(tagIndexSrc).not.toContain('text-gray-');
        });

        it('uses semantic token text-foreground', () => {
            expect(tagIndexSrc).toContain('text-foreground');
        });

        it('uses semantic token text-muted-foreground', () => {
            expect(tagIndexSrc).toContain('text-muted-foreground');
        });
    });

    describe('breadcrumb', () => {
        it('renders 3-level breadcrumb including tag', () => {
            expect(tagIndexSrc).toContain("path: 'publicaciones'");
            expect(tagIndexSrc).toContain('publicaciones/etiqueta/');
        });
    });
});

describe('publicaciones/etiqueta/[tag]/page/[page].astro — paginated tag listing', () => {
    describe('locale validation', () => {
        it('calls getLocaleFromParams', () => {
            expect(tagPaginationSrc).toContain('getLocaleFromParams(Astro.params)');
        });

        it('redirects on invalid locale', () => {
            expect(tagPaginationSrc).toContain("Astro.redirect('/es/')");
        });
    });

    describe('tag validation', () => {
        it('validates tag param is present and non-empty', () => {
            expect(tagPaginationSrc).toContain("typeof tag !== 'string'");
            expect(tagPaginationSrc).toContain("tag.trim() === ''");
        });

        it('redirects to blog listing when tag is invalid', () => {
            expect(tagPaginationSrc).toContain('/publicaciones/');
        });
    });

    describe('page number validation', () => {
        it('parses page param as integer', () => {
            expect(tagPaginationSrc).toContain('Number.parseInt');
        });

        it('redirects page 1 to canonical base URL for the tag', () => {
            expect(tagPaginationSrc).toContain('pageNum === 1');
            expect(tagPaginationSrc).toContain('publicaciones/etiqueta/');
        });

        it('rejects NaN page numbers', () => {
            expect(tagPaginationSrc).toContain('Number.isNaN(pageNum)');
        });
    });

    describe('rewrite behaviour', () => {
        it('rewrites to tag index page with page query param', () => {
            expect(tagPaginationSrc).toContain('Astro.rewrite');
            expect(tagPaginationSrc).toContain('?page=');
        });

        it('includes tag slug in rewrite URL', () => {
            expect(tagPaginationSrc).toContain('tagSlug');
        });
    });
});
