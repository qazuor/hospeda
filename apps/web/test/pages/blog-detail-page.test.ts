/**
 * Tests for blog post detail page structure.
 * Validates component imports, locale handling, content rendering, and SEO.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/publicaciones/[slug].astro');
const content = readFileSync(pagePath, 'utf8');

describe('Blog Detail Page ([slug].astro)', () => {
    describe('Imports', () => {
        it('should import BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
        });

        it('should import Container', () => {
            expect(content).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
        });

        it('should import Section', () => {
            expect(content).toContain("import Section from '../../../components/ui/Section.astro'");
        });

        it('should import Badge', () => {
            expect(content).toContain("import Badge from '../../../components/ui/Badge.astro'");
        });

        it('should import Breadcrumb', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
        });

        it('should import SEOHead', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
        });

        it('should import ArticleJsonLd', () => {
            expect(content).toContain(
                "import ArticleJsonLd from '../../../components/seo/ArticleJsonLd.astro'"
            );
        });

        it('should import ShareButtons', () => {
            expect(content).toContain(
                "import { ShareButtons } from '../../../components/ui/ShareButtons.client.tsx'"
            );
        });

        it('should import BlogPostCard', () => {
            expect(content).toContain(
                "import BlogPostCard from '../../../components/blog/BlogPostCard.astro'"
            );
        });

        it('should import i18n utilities from page-helpers', () => {
            expect(content).toContain("from '../../../lib/page-helpers'");
            expect(content).toContain('getLocaleFromParams');
        });

        it('should import t from i18n lib', () => {
            expect(content).toContain("import { t as i18nT } from '../../../lib/i18n'");
        });

        it('should import renderTiptapContent', () => {
            expect(content).toContain(
                "import { renderTiptapContent } from '../../../lib/tiptap-renderer'"
            );
        });

        it('should import postsApi', () => {
            expect(content).toContain("import { postsApi } from '../../../lib/api/endpoints'");
        });
    });

    describe('Locale Validation', () => {
        it('should validate locale parameter', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
            expect(content).toContain('if (!locale)');
        });

        it('should redirect invalid locales to Spanish', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should extract slug from params', () => {
            expect(content).toContain('const { slug } = Astro.params');
        });
    });

    describe('TipTap Content Rendering', () => {
        it('should call renderTiptapContent wrapped in sanitizeHtml', () => {
            expect(content).toContain(
                'const renderedContent = sanitizeHtml({ html: renderTiptapContent({ content:'
            );
        });

        it('should render content with set:html', () => {
            expect(content).toContain('set:html={renderedContent}');
        });
    });

    describe('Breadcrumb Navigation', () => {
        it('should have breadcrumbItems array', () => {
            expect(content).toContain('const breadcrumbItems');
        });

        it('should include home label in breadcrumb', () => {
            expect(content).toContain('{ label: homeLabel');
        });

        it('should include blog label in breadcrumb', () => {
            expect(content).toContain('{ label: blogLabel');
        });

        it('should include category in breadcrumb', () => {
            expect(content).toContain('post.category');
        });

        it('should render Breadcrumb component', () => {
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });
    });

    describe('Article Structure', () => {
        it('should have article tag', () => {
            expect(content).toContain('<article');
        });

        it('should have featured image', () => {
            expect(content).toContain('src={post.coverImage');
            expect(content).toContain('alt={post.title}');
            expect(content).toContain('aspect-video');
        });

        it('should display category badge', () => {
            expect(content).toContain('<Badge label={post.category');
        });

        it('should have h1 title', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('{post.title}');
        });

        it('should display author avatar', () => {
            expect(content).toContain('src={post.author?.avatar');
            expect(content).toContain('alt={post.author?.name');
            expect(content).toContain('rounded-full');
        });

        it('should display author name', () => {
            expect(content).toContain('{post.author?.name');
        });

        it('should display formatted date', () => {
            expect(content).toContain('{formattedDate}');
        });

        it('should display reading time', () => {
            expect(content).toContain('{post.readingTime');
            expect(content).toContain('{readingTimeLabel}');
        });

        it('should have prose typography for content', () => {
            expect(content).toContain('prose prose-lg');
        });
    });

    describe('Tags Section', () => {
        it('should have tags section heading', () => {
            expect(content).toContain('{tagsLabel}');
        });

        it('should render tags with Badge components', () => {
            expect(content).toContain('(post.tags || []).map((tag: string)');
            expect(content).toContain('<Badge label={tag}');
            expect(content).toContain('variant="outline"');
        });

        it('should have tags container with flex wrap', () => {
            expect(content).toContain('flex flex-wrap gap-2');
        });
    });

    describe('Share Section', () => {
        it('should have share section heading', () => {
            expect(content).toContain('{shareLabel}');
        });

        it('should render ShareButtons with client:visible', () => {
            expect(content).toContain('<ShareButtons client:visible');
        });

        it('should pass url to ShareButtons', () => {
            expect(content).toContain('url={canonicalUrl}');
        });

        it('should pass title to ShareButtons', () => {
            expect(content).toContain('title={post.title}');
        });
    });

    describe('SEO Components', () => {
        it('should render SEOHead in head slot', () => {
            expect(content).toContain('<SEOHead');
            expect(content).toContain('slot="head"');
        });

        it('should pass title to SEOHead', () => {
            expect(content).toContain('title={post.title}');
        });

        it('should pass description to SEOHead', () => {
            expect(content).toContain('description={post.excerpt');
        });

        it('should set SEOHead type to article', () => {
            expect(content).toContain('type="article"');
        });

        it('should render ArticleJsonLd in head slot', () => {
            expect(content).toContain('<ArticleJsonLd');
            expect(content).toContain('slot="head"');
        });

        it('should pass headline to ArticleJsonLd', () => {
            expect(content).toContain('headline={post.title}');
        });

        it('should pass url to ArticleJsonLd', () => {
            expect(content).toContain('url={canonicalUrl}');
        });

        it('should pass datePublished to ArticleJsonLd', () => {
            expect(content).toContain('datePublished={post.publishedAt');
        });

        it('should pass author to ArticleJsonLd', () => {
            expect(content).toContain('author={{ name: post.author?.name');
        });
    });

    describe('Related Posts Section', () => {
        it('should render Section with relatedPostsLabel', () => {
            expect(content).toContain('<Section title={relatedPostsLabel}');
        });

        it('should have responsive grid', () => {
            expect(content).toContain('grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should render BlogPostCard for related posts', () => {
            expect(content).toContain('relatedPosts.map((rp) =>');
            expect(content).toContain('<BlogPostCard {...rp}');
        });

        it('should pass locale to BlogPostCard', () => {
            expect(content).toContain('locale={locale}');
        });
    });

    describe('Localization', () => {
        it('should use i18n t function for blog label', () => {
            expect(content).toContain("i18nT({ locale, namespace: 'blog', key: 'detail.blog' })");
        });

        it('should use i18n t function for relatedPosts label', () => {
            expect(content).toContain(
                "i18nT({ locale, namespace: 'blog', key: 'detail.relatedPosts' })"
            );
        });

        it('should use i18n t function for share label', () => {
            expect(content).toContain("i18nT({ locale, namespace: 'blog', key: 'detail.share' })");
        });

        it('should use i18n t function for tags label', () => {
            expect(content).toContain("i18nT({ locale, namespace: 'blog', key: 'detail.tags' })");
        });

        it('should use i18n t function for readingTime label', () => {
            expect(content).toContain(
                "i18nT({ locale, namespace: 'blog', key: 'detail.readingTime' })"
            );
        });

        it('should use i18n t function for home label', () => {
            expect(content).toContain("i18nT({ locale, namespace: 'blog', key: 'detail.home' })");
        });

        it('should format date according to locale using formatDate from @repo/i18n', () => {
            expect(content).toContain('formatDate');
            expect(content).toContain("from '@repo/i18n'");
            expect(content).toContain('formatDate({');
        });
    });

    describe('Page Structure', () => {
        it('should use BaseLayout', () => {
            expect(content).toContain('<BaseLayout');
        });

        it('should use Container', () => {
            expect(content).toContain('<Container>');
        });

        it('should have max-width constraint for article', () => {
            expect(content).toContain('max-w-3xl');
        });
    });

    describe('API Integration', () => {
        it('should define getStaticPaths function', () => {
            expect(content).toContain('export async function getStaticPaths()');
        });

        it('should call postsApi.list in getStaticPaths', () => {
            expect(content).toContain('fetchAllPages');
            expect(content).toContain('postsApi.list');
        });

        it('should check result.ok before using data', () => {
            expect(content).toContain('result.ok');
        });

        it('should fetch post from props or API', () => {
            expect(content).toContain('let post = Astro.props.post');
        });

        it('should fetch related posts from API', () => {
            expect(content).toContain('const relResult = await postsApi.list');
        });

        it('should redirect to list page if post not found', () => {
            expect(content).toContain('return Astro.redirect(`/${locale}/publicaciones/`)');
        });

        it('should enable prerender', () => {
            expect(content).toContain('export const prerender = true');
        });
    });

    describe('Rendering Strategy', () => {
        it('should use SSG with prerender', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should generate static paths for all locales', () => {
            expect(content).toContain('const locales = SUPPORTED_LOCALES');
        });
    });
});
