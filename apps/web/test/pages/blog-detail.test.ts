/**
 * @file blog-detail.test.ts
 * @description Source-content tests for publicaciones/[slug].astro.
 * Validates structure, TipTap rendering, author metadata, tags, share
 * buttons, JSON-LD, related posts, and semantic tokens.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/[slug].astro'),
    'utf8'
);

describe('publicaciones/[slug].astro', () => {
    describe('rendering strategy', () => {
        it('should use SSR (no prerender export)', () => {
            expect(src).not.toContain('export const prerender = true');
        });

        it('should use getLocaleFromParams for runtime locale resolution', () => {
            expect(src).toContain('getLocaleFromParams');
        });

        it('should fetch post directly via API on every request', () => {
            expect(src).toContain('postsApi.getBySlug');
        });

        it('should redirect to listing when post is not found', () => {
            expect(src).toContain('publicaciones');
            expect(src).toContain('Astro.redirect');
        });
    });

    describe('layout and SEO', () => {
        it('uses BaseLayout', () => {
            expect(src).toContain('BaseLayout');
        });

        it('uses SEOHead with article type', () => {
            expect(src).toContain('SEOHead');
            expect(src).toContain('type="article"');
        });

        it('uses ArticleJsonLd for structured data', () => {
            expect(src).toContain('ArticleJsonLd');
        });

        it('passes headline to ArticleJsonLd', () => {
            expect(src).toContain('headline={post.title}');
        });

        it('passes datePublished to ArticleJsonLd', () => {
            expect(src).toContain('datePublished=');
        });

        it('passes dateModified to ArticleJsonLd', () => {
            expect(src).toContain('dateModified=');
        });

        it('passes author to ArticleJsonLd', () => {
            expect(src).toContain('author={');
        });

        it('has canonical URL built from Astro.site', () => {
            expect(src).toContain('Astro.site');
            expect(src).toContain('canonicalUrl');
        });
    });

    describe('imports and dependencies', () => {
        it('imports postsApi from endpoints', () => {
            expect(src).toContain('postsApi');
            expect(src).toContain("from '../../../lib/api/endpoints'");
        });

        it('imports renderTiptapContent', () => {
            expect(src).toContain('renderTiptapContent');
            expect(src).toContain("from '../../../lib/tiptap-renderer'");
        });

        it('imports sanitizeHtml', () => {
            expect(src).toContain('sanitizeHtml');
            expect(src).toContain("from '../../../lib/sanitize-html'");
        });

        it('imports formatDate and toBcp47Locale from @repo/i18n', () => {
            expect(src).toContain('formatDate');
            expect(src).toContain('toBcp47Locale');
            expect(src).toContain("from '@repo/i18n'");
        });

        it('imports icons from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('CalendarIcon');
            expect(src).toContain('ClockIcon');
            expect(src).toContain('UserIcon');
            expect(src).toContain('TagIcon');
            expect(src).toContain('ShareIcon');
        });

        it('imports ShareButtons as React island', () => {
            expect(src).toContain('ShareButtons');
            expect(src).toContain('.client');
        });

        it('imports SecondaryArticleCard', () => {
            expect(src).toContain('SecondaryArticleCard');
        });

        it('imports Badge', () => {
            expect(src).toContain('Badge');
        });
    });

    describe('post data loading', () => {
        it('fetches post via SSR API call on every request', () => {
            expect(src).toContain('postsApi.getBySlug');
        });

        it('uses slug from Astro.params', () => {
            expect(src).toContain('Astro.params');
            expect(src).toContain('slug');
        });

        it('redirects to listing when post is not found', () => {
            expect(src).toContain(
                "buildUrl({ locale: locale as SupportedLocale, path: 'publicaciones' })"
            );
        });
    });

    describe('TipTap content rendering', () => {
        it('calls renderTiptapContent with post.content', () => {
            expect(src).toContain('renderTiptapContent({ content: post.content');
        });

        it('sanitizes rendered HTML', () => {
            expect(src).toContain('sanitizeHtml({');
        });

        it('uses set:html to render sanitized content', () => {
            expect(src).toContain('set:html={renderedContent}');
        });
    });

    describe('article metadata', () => {
        it('renders author avatar image', () => {
            expect(src).toContain('authorAvatar');
        });

        it('falls back to placeholder avatar when author has no avatar', () => {
            expect(src).toContain('/images/placeholder-avatar.svg');
        });

        it('renders anonymous fallback for authorName', () => {
            expect(src).toContain("'Anonymous'");
        });

        it('renders publish date in a <time> element', () => {
            expect(src).toContain('<time');
            expect(src).toContain('datetime=');
        });

        it('renders reading time', () => {
            expect(src).toContain('readingTime');
        });

        it('renders category badge', () => {
            expect(src).toContain('<Badge');
        });
    });

    describe('tags section', () => {
        it('renders tags section only when tags exist', () => {
            expect(src).toContain('tags.length > 0');
        });

        it('renders each tag as a Badge', () => {
            expect(src).toContain('tags.map((tag) =>');
        });
    });

    describe('share buttons', () => {
        it('renders ShareButtons island with client:visible', () => {
            expect(src).toContain('client:visible');
            expect(src).toContain('ShareButtons');
        });

        it('passes canonical URL to ShareButtons', () => {
            expect(src).toContain('url={canonicalUrl}');
        });

        it('passes post title to ShareButtons', () => {
            expect(src).toContain('title={post.title}');
        });
    });

    describe('related posts section', () => {
        it('fetches related posts excluding current post', () => {
            expect(src).toContain('filter((p) => p.id !== post');
        });

        it('limits related posts to 3', () => {
            expect(src).toContain('.slice(0, 3)');
        });

        it('renders related posts section with aria-labelledby', () => {
            expect(src).toContain('aria-labelledby="related-posts-heading"');
        });

        it('renders SecondaryArticleCard for each related post', () => {
            expect(src).toContain('SecondaryArticleCard');
        });

        it('renders EmptyState when there are no related posts', () => {
            expect(src).toContain('EmptyState');
        });
    });

    describe('view transitions', () => {
        it('uses transition:name for hero image morphing', () => {
            expect(src).toContain('transition:name=');
        });
    });

    describe('semantic tokens — no hardcoded colors', () => {
        it('does not use bg-white', () => {
            expect(src).not.toContain('bg-white');
        });

        it('does not use text-gray-', () => {
            expect(src).not.toContain('text-gray-');
        });

        it('uses semantic token text-foreground', () => {
            expect(src).toContain('text-foreground');
        });

        it('uses semantic token text-muted-foreground', () => {
            expect(src).toContain('text-muted-foreground');
        });

        it('uses semantic token border-border', () => {
            expect(src).toContain('border-border');
        });
    });

    describe('breadcrumb', () => {
        it('renders Breadcrumb', () => {
            expect(src).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('includes blog label in breadcrumb items', () => {
            expect(src).toContain("path: 'publicaciones'");
        });
    });
});
