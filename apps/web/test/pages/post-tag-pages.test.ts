/**
 * Tests for Post Tag pages.
 * Covers the tag index page (SSR) and the pagination route.
 * Verifies structure, imports, locale validation, tag validation, i18n, SEO, API integration, and pagination.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexPath = resolve(
    __dirname,
    '../../src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro'
);
const paginationPath = resolve(
    __dirname,
    '../../src/pages/[lang]/publicaciones/etiqueta/[tag]/page/[page].astro'
);

const indexContent = readFileSync(indexPath, 'utf8');
const paginationContent = readFileSync(paginationPath, 'utf8');

// ---------------------------------------------------------------------------
// Index page: /[lang]/publicaciones/etiqueta/[tag]/
// ---------------------------------------------------------------------------

describe('publicaciones/etiqueta/[tag]/index.astro', () => {
    describe('Rendering Strategy (SSR)', () => {
        it('should NOT export prerender (SSR page, no prerender = true)', () => {
            expect(indexContent).not.toContain('export const prerender = true');
        });

        it('should NOT export getStaticPaths (dynamic tags unknown at build time)', () => {
            expect(indexContent).not.toContain('export function getStaticPaths');
        });
    });

    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(indexContent).toContain(
                "import BaseLayout from '../../../../../layouts/BaseLayout.astro'"
            );
        });

        it('should import SEOHead', () => {
            expect(indexContent).toContain(
                "import SEOHead from '../../../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import Breadcrumb', () => {
            expect(indexContent).toContain(
                "import Breadcrumb from '../../../../../components/ui/Breadcrumb.astro'"
            );
        });

        it('should import Container', () => {
            expect(indexContent).toContain(
                "import Container from '../../../../../components/ui/Container.astro'"
            );
        });

        it('should import Section', () => {
            expect(indexContent).toContain(
                "import Section from '../../../../../components/ui/Section.astro'"
            );
        });

        it('should import EmptyState', () => {
            expect(indexContent).toContain(
                "import EmptyState from '../../../../../components/ui/EmptyState.astro'"
            );
        });

        it('should import Pagination', () => {
            expect(indexContent).toContain(
                "import Pagination from '../../../../../components/ui/Pagination.astro'"
            );
        });

        it('should import BlogPostCard', () => {
            expect(indexContent).toContain(
                "import BlogPostCard from '../../../../../components/blog/BlogPostCard.astro'"
            );
        });

        it('should import i18n utilities', () => {
            expect(indexContent).toContain(
                "import { getLocaleFromParams } from '../../../../../lib/page-helpers'"
            );
        });

        it('should import t from lib/i18n', () => {
            expect(indexContent).toContain("import { t } from '../../../../../lib/i18n'");
        });

        it('should import tagsApi', () => {
            expect(indexContent).toContain(
                "import { tagsApi } from '../../../../../lib/api/endpoints-protected'"
            );
        });

        it('should import apiClient', () => {
            expect(indexContent).toContain(
                "import { apiClient } from '../../../../../lib/api/client'"
            );
        });
    });

    describe('Locale Validation', () => {
        it('should extract locale with getLocaleFromParams', () => {
            expect(indexContent).toContain('getLocaleFromParams(Astro.params)');
            expect(indexContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ if locale is invalid', () => {
            expect(indexContent).toContain("return Astro.redirect('/es/');");
        });
    });

    describe('Tag Parameter Validation', () => {
        it('should validate that tag is a non-empty string', () => {
            expect(indexContent).toContain(
                "if (!tag || typeof tag !== 'string' || tag.trim() === '')"
            );
        });

        it('should redirect to publications listing on empty tag', () => {
            expect(indexContent).toContain('return Astro.redirect(`/${locale}/publicaciones/`);');
        });

        it('should trim the tag slug', () => {
            expect(indexContent).toContain('const tagSlug = tag.trim();');
        });
    });

    describe('Tag API Fetch', () => {
        it('should fetch tag metadata by slug', () => {
            expect(indexContent).toContain(
                'const tagResult = await tagsApi.getBySlug({ slug: tagSlug });'
            );
        });

        it('should redirect to publications listing if tag not found', () => {
            expect(indexContent).toContain('if (!tagResult.ok || !tagResult.data)');
            expect(indexContent).toContain('return Astro.redirect(`/${locale}/publicaciones/`);');
        });

        it('should extract tag data with id, name, and slug', () => {
            expect(indexContent).toContain(
                'const tagData = tagResult.data as { id: string; name: string; slug: string };'
            );
        });
    });

    describe('Posts API Fetch', () => {
        it('should extract page from URL search params with default of 1', () => {
            expect(indexContent).toContain(
                "const page = Number.parseInt(Astro.url.searchParams.get('page') || '1', 10);"
            );
        });

        it('should fetch posts using apiClient.getList', () => {
            expect(indexContent).toContain(
                'const postsResult = await apiClient.getList<Record<string, unknown>>({'
            );
        });

        it('should use the correct posts API path', () => {
            expect(indexContent).toContain("path: '/api/v1/public/posts'");
        });

        it('should filter posts by tag id', () => {
            expect(indexContent).toContain('tags: tagData.id');
        });

        it('should pass page and pageSize to API', () => {
            expect(indexContent).toContain('page, pageSize');
        });

        it('should extract posts from API response', () => {
            expect(indexContent).toContain(
                'const posts = postsResult.ok ? postsResult.data.items : []'
            );
        });

        it('should extract pagination from API response', () => {
            expect(indexContent).toContain(
                'const pagination = postsResult.ok ? postsResult.data.pagination : null'
            );
        });
    });

    describe('Localized Page Titles', () => {
        it('should use t() for page title with tag interpolation', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'blog', key: 'tagPage.title', params: { tag: tagName } })"
            );
        });
    });

    describe('Localized Meta Descriptions', () => {
        it('should use t() for meta description with tag interpolation', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'blog', key: 'tagPage.description', params: { tag: tagName } })"
            );
        });
    });

    describe('Localized Breadcrumb Labels', () => {
        it('should use t() for breadcrumb home', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'blog', key: 'tagPage.breadcrumb.home' })"
            );
        });

        it('should use t() for breadcrumb posts', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'blog', key: 'tagPage.breadcrumb.posts' })"
            );
        });

        it('should use t() for breadcrumb tag with tag interpolation', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'blog', key: 'tagPage.breadcrumb.tag', params: { tag: tagName } })"
            );
        });
    });

    describe('Localized Headings', () => {
        it('should use t() for heading with tag interpolation', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'blog', key: 'tagPage.heading', params: { tag: tagName } })"
            );
        });
    });

    describe('Localized Sub-Headings', () => {
        it('should use t() for sub-heading with tag interpolation', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'blog', key: 'tagPage.subHeading', params: { tag: tagName } })"
            );
        });
    });

    describe('Localized Empty State Messages', () => {
        it('should use t() for empty state message with tag interpolation', () => {
            expect(indexContent).toContain(
                "t({ locale, namespace: 'blog', key: 'tagPage.emptyState', params: { tag: tagName } })"
            );
        });
    });

    describe('SEO', () => {
        it('should build canonical URL from Astro.url.pathname', () => {
            expect(indexContent).toContain(
                'const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href;'
            );
        });

        it('should render SEOHead in head slot', () => {
            expect(indexContent).toContain('<SEOHead');
            expect(indexContent).toContain('slot="head"');
        });

        it('should pass title to SEOHead', () => {
            expect(indexContent).toContain('title={pageTitle}');
        });

        it('should pass description to SEOHead', () => {
            expect(indexContent).toContain('description={metaDescription}');
        });

        it('should pass canonical URL to SEOHead', () => {
            expect(indexContent).toContain('canonical={canonicalUrl}');
        });

        it('should pass locale directly to SEOHead', () => {
            expect(indexContent).toContain('locale={locale}');
        });

        it('should set page type to website', () => {
            expect(indexContent).toContain('type="website"');
        });
    });

    describe('Breadcrumb', () => {
        it('should define breadcrumbItems array', () => {
            expect(indexContent).toContain('const breadcrumbItems = [');
        });

        it('should include home breadcrumb link', () => {
            expect(indexContent).toContain('{ label: breadcrumbHome, href: `/${locale}/` }');
        });

        it('should include posts breadcrumb link', () => {
            expect(indexContent).toContain(
                '{ label: breadcrumbPosts, href: `/${locale}/publicaciones/` }'
            );
        });

        it('should include tag breadcrumb link', () => {
            expect(indexContent).toContain(
                '{ label: breadcrumbTag, href: `/${locale}/publicaciones/etiqueta/${tagSlug}/` }'
            );
        });

        it('should render Breadcrumb component with items', () => {
            expect(indexContent).toContain('<Breadcrumb items={breadcrumbItems}');
        });
    });

    describe('Posts Grid', () => {
        it('should render BlogPostCard components', () => {
            expect(indexContent).toContain('<BlogPostCard');
            expect(indexContent).toContain('toPostCardProps');
            expect(indexContent).toContain('locale={locale}');
        });

        it('should use responsive grid layout', () => {
            expect(indexContent).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should conditionally render posts or empty state', () => {
            expect(indexContent).toContain('posts.length > 0');
        });

        it('should add accessible role and aria-label to grid', () => {
            expect(indexContent).toContain('role="region"');
            expect(indexContent).toContain('aria-label={pageTitle}');
        });
    });

    describe('Empty State', () => {
        it('should render EmptyState component when no posts', () => {
            expect(indexContent).toContain('<EmptyState');
        });

        it('should pass localized message to EmptyState', () => {
            expect(indexContent).toContain('title={emptyStateMessage}');
            expect(indexContent).toContain('message={emptyStateMessage}');
        });
    });

    describe('Pagination', () => {
        it('should conditionally render Pagination when totalPages > 1', () => {
            expect(indexContent).toContain('pagination && pagination.totalPages > 1');
        });

        it('should render Pagination component', () => {
            expect(indexContent).toContain('<Pagination');
        });

        it('should pass currentPage prop', () => {
            expect(indexContent).toContain('currentPage={pagination.page as number}');
        });

        it('should pass totalPages prop', () => {
            expect(indexContent).toContain('totalPages={pagination.totalPages as number}');
        });

        it('should pass baseUrl with tag slug in path', () => {
            expect(indexContent).toContain(
                'baseUrl={`/${locale}/publicaciones/etiqueta/${tagSlug}`}'
            );
        });

        it('should pass locale prop', () => {
            expect(indexContent).toContain('locale={locale}');
        });
    });

    describe('Content Sections', () => {
        it('should have tag header article', () => {
            expect(indexContent).toContain('id="tag-header"');
        });

        it('should have posts grid article', () => {
            expect(indexContent).toContain('id="posts-grid"');
        });

        it('should have pagination article', () => {
            expect(indexContent).toContain('id="pagination"');
        });

        it('should display heading as h1', () => {
            expect(indexContent).toContain('{heading}');
            expect(indexContent).toContain('<h1');
            expect(indexContent).toContain('text-4xl font-bold');
            expect(indexContent).toContain('md:text-5xl');
        });

        it('should display sub-heading', () => {
            expect(indexContent).toContain('{subHeading}');
            expect(indexContent).toContain('text-xl leading-relaxed');
        });

        it('should use Container component', () => {
            expect(indexContent).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(indexContent).toContain('<Section>');
        });
    });

    describe('TypeScript Types', () => {
        it('should import toPostCardProps from transforms', () => {
            expect(indexContent).toContain('import { toPostCardProps } from');
            expect(indexContent).toContain('lib/api/transforms');
        });

        it('should import PaginatedResponse type', () => {
            expect(indexContent).toContain(
                "import type { PaginatedResponse } from '../../../../../lib/api/types'"
            );
        });
    });

    describe('JSDoc Documentation', () => {
        it('should document the page', () => {
            expect(indexContent).toContain('* Posts by Tag page.');
        });

        it('should document the route', () => {
            expect(indexContent).toContain('* @route /[lang]/publicaciones/etiqueta/[tag]/');
        });

        it('should document the rendering strategy', () => {
            expect(indexContent).toContain('* @rendering SSR');
        });
    });

    describe('File Size', () => {
        it('should be under 500 lines', () => {
            const lines = indexContent.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});

// ---------------------------------------------------------------------------
// Pagination route: /[lang]/publicaciones/etiqueta/[tag]/page/[page]/
// ---------------------------------------------------------------------------

describe('publicaciones/etiqueta/[tag]/page/[page].astro', () => {
    describe('Imports', () => {
        it('should import getLocaleFromParams from page-helpers', () => {
            expect(paginationContent).toContain('getLocaleFromParams');
            expect(paginationContent).toContain("from '../../../../../../lib/page-helpers'");
        });
    });

    describe('Locale Validation', () => {
        it('should extract tag and page from params', () => {
            expect(paginationContent).toContain('const { tag, page } = Astro.params;');
        });

        it('should validate locale with getLocaleFromParams', () => {
            expect(paginationContent).toContain('getLocaleFromParams(Astro.params)');
            expect(paginationContent).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(paginationContent).toContain("return Astro.redirect('/es/');");
        });
    });

    describe('Tag Parameter Validation', () => {
        it('should validate that tag is a non-empty string', () => {
            expect(paginationContent).toContain(
                "if (!tag || typeof tag !== 'string' || tag.trim() === '')"
            );
        });

        it('should redirect to publications listing on empty tag', () => {
            expect(paginationContent).toContain(
                'return Astro.redirect(`/${locale}/publicaciones/`);'
            );
        });

        it('should trim the tag slug', () => {
            expect(paginationContent).toContain('const tagSlug = tag.trim();');
        });
    });

    describe('Page Number Validation', () => {
        it('should parse page number as integer', () => {
            expect(paginationContent).toContain(
                "const pageNum = Number.parseInt(page || '1', 10);"
            );
        });

        it('should redirect on invalid page number (NaN or < 1)', () => {
            expect(paginationContent).toContain('if (Number.isNaN(pageNum) || pageNum < 1)');
            expect(paginationContent).toContain(
                'return Astro.redirect(`/${locale}/publicaciones/etiqueta/${tagSlug}/`);'
            );
        });
    });

    describe('Page 1 Canonical Redirect', () => {
        it('should redirect page 1 to the canonical base URL', () => {
            expect(paginationContent).toContain('if (pageNum === 1)');
            expect(paginationContent).toContain(
                'return Astro.redirect(`/${locale}/publicaciones/etiqueta/${tagSlug}/`);'
            );
        });
    });

    describe('Rewrite to Index With Query Param', () => {
        it('should rewrite to the tag index page with page query parameter', () => {
            expect(paginationContent).toContain(
                'return Astro.rewrite(`/${locale}/publicaciones/etiqueta/${tagSlug}/?page=${pageNum}`);'
            );
        });
    });

    describe('JSDoc Documentation', () => {
        it('should document the paginated route', () => {
            expect(paginationContent).toContain(
                '* Paginated posts-by-tag route using URL segments.'
            );
        });

        it('should document the route path', () => {
            expect(paginationContent).toContain(
                '* @route /[lang]/publicaciones/etiqueta/[tag]/page/[page]/'
            );
        });

        it('should document the rendering strategy', () => {
            expect(paginationContent).toContain('* @rendering SSR');
        });
    });

    describe('File Size', () => {
        it('should be under 500 lines', () => {
            const lines = paginationContent.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});
