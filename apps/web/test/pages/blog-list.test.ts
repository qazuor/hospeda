/**
 * @file blog-list.test.ts
 * @description Source-content tests for publicaciones/index.astro.
 * Validates structure, imports, semantic tokens, i18n, API patterns, and
 * query-param handling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/index.astro'),
    'utf8'
);

describe('publicaciones/index.astro', () => {
    describe('layout and SEO', () => {
        it('uses BaseLayout', () => {
            expect(src).toContain('BaseLayout');
        });

        it('uses SEOHead with correct slot', () => {
            expect(src).toContain('SEOHead');
            expect(src).toContain('slot="head"');
        });

        it('passes locale to BaseLayout', () => {
            expect(src).toContain('locale={locale}');
        });

        it('builds canonical URL from Astro.site', () => {
            expect(src).toContain('Astro.site');
            expect(src).toContain('canonicalUrl');
        });
    });

    describe('imports and dependencies', () => {
        it('imports Breadcrumb', () => {
            expect(src).toContain('import Breadcrumb from');
        });

        it('imports EmptyState', () => {
            expect(src).toContain('import EmptyState from');
        });

        it('imports Pagination', () => {
            expect(src).toContain('import Pagination from');
        });

        it('imports FeaturedArticleCard', () => {
            expect(src).toContain('FeaturedArticleCard');
        });

        it('imports SecondaryArticleCard', () => {
            expect(src).toContain('SecondaryArticleCard');
        });

        it('imports postsApi from endpoints', () => {
            expect(src).toContain('postsApi');
            expect(src).toContain("from '../../../lib/api/endpoints'");
        });

        it('imports createT from i18n', () => {
            expect(src).toContain('createT');
            expect(src).toContain("from '../../../lib/i18n'");
        });

        it('imports getLocaleFromParams', () => {
            expect(src).toContain('getLocaleFromParams');
        });

        it('imports buildUrl and buildUrlWithParams', () => {
            expect(src).toContain('buildUrl');
            expect(src).toContain('buildUrlWithParams');
        });

        it('imports toPostCardProps transform', () => {
            expect(src).toContain('toPostCardProps');
        });
    });

    describe('locale validation and redirect', () => {
        it('calls getLocaleFromParams', () => {
            expect(src).toContain('getLocaleFromParams(Astro.params)');
        });

        it('redirects on invalid locale', () => {
            expect(src).toContain("Astro.redirect('/es/publicaciones/')");
        });
    });

    describe('API calls', () => {
        it('fetches posts with postsApi.list', () => {
            expect(src).toContain('postsApi.list');
        });

        it('fetches featured post with postsApi.getFeatured', () => {
            expect(src).toContain('postsApi.getFeatured()');
        });

        it('runs API calls in parallel with Promise.all', () => {
            expect(src).toContain('Promise.all');
        });
    });

    describe('query params', () => {
        it('reads page from URL search params', () => {
            expect(src).toContain("searchParams.get('page')");
        });

        it('reads q (search query) from URL search params', () => {
            expect(src).toContain("searchParams.get('q')");
        });

        it('reads categoria from URL search params', () => {
            expect(src).toContain("searchParams.get('categoria')");
        });

        it('reads sortBy from URL search params', () => {
            expect(src).toContain("searchParams.get('sortBy')");
        });

        it('enforces minimum page of 1', () => {
            expect(src).toContain('Math.max(1,');
        });
    });

    describe('category filter', () => {
        it('defines a categories array', () => {
            expect(src).toContain('categories');
        });

        it('includes all category slugs', () => {
            expect(src).toContain("'destinos'");
            expect(src).toContain("'alojamientos'");
            expect(src).toContain("'eventos'");
            expect(src).toContain("'gastronomia'");
            expect(src).toContain("'consejos'");
        });

        it('renders category filter nav with aria-label', () => {
            expect(src).toContain('aria-label');
        });

        it('uses buildCategoryUrl helper', () => {
            expect(src).toContain('buildCategoryUrl');
        });

        it('marks active category with aria-current', () => {
            expect(src).toContain('aria-current');
        });
    });

    describe('featured post section', () => {
        it('renders featured section only when featuredPost exists', () => {
            expect(src).toContain('featuredPost &&');
        });

        it('uses aria-labelledby on featured section', () => {
            expect(src).toContain('aria-labelledby="featured-post-heading"');
        });

        it('renders FeaturedArticleCard for featured post', () => {
            expect(src).toContain('<FeaturedArticleCard article={featuredPost}');
        });
    });

    describe('posts grid section', () => {
        it('uses aria-labelledby on posts section', () => {
            expect(src).toContain('aria-labelledby="posts-section-heading"');
        });

        it('handles API error with EmptyState', () => {
            expect(src).toContain('apiError');
            expect(src).toContain('EmptyState');
        });

        it('renders FeaturedArticleCard for first post', () => {
            expect(src).toContain('postCards[0]');
        });

        it('renders remaining posts as SecondaryArticleCard', () => {
            expect(src).toContain('SecondaryArticleCard');
            expect(src).toContain('postCards.slice(1)');
        });
    });

    describe('pagination', () => {
        it('renders Pagination component conditionally', () => {
            expect(src).toContain('pagination && pagination.totalPages > 1');
        });

        it('passes currentPage to Pagination', () => {
            expect(src).toContain('currentPage={pagination.page}');
        });

        it('passes totalPages to Pagination', () => {
            expect(src).toContain('totalPages={pagination.totalPages}');
        });

        it('preserves categoria param in paginationParams', () => {
            expect(src).toContain("paginationParams.set('categoria', category)");
        });
    });

    describe('semantic tokens — no hardcoded colors', () => {
        it('does not use bg-white', () => {
            expect(src).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(src).not.toContain('text-gray-');
        });

        it('does not use bg-blue-', () => {
            expect(src).not.toContain('bg-blue-');
        });

        it('uses semantic token text-foreground', () => {
            expect(src).toContain('text-foreground');
        });

        it('uses semantic token text-muted-foreground', () => {
            expect(src).toContain('text-muted-foreground');
        });
    });

    describe('breadcrumb', () => {
        it('renders Breadcrumb with items', () => {
            expect(src).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('includes HOME_BREADCRUMB in breadcrumb', () => {
            expect(src).toContain('HOME_BREADCRUMB');
        });
    });
});
