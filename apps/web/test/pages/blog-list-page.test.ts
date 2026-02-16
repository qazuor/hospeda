/**
 * Tests for Blog List page (Publicaciones).
 * Verifies page structure, SEO elements, localization, and content sections.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const blogListPath = resolve(__dirname, '../../src/pages/[lang]/publicaciones/index.astro');
const content = readFileSync(blogListPath, 'utf8');

describe('publicaciones/index.astro', () => {
    describe('Page structure', () => {
        it('should use BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../../layouts/BaseLayout.astro'");
            expect(content).toContain('<BaseLayout');
        });

        it('should use SEOHead component', () => {
            expect(content).toContain(
                "import SEOHead from '../../../components/seo/SEOHead.astro'"
            );
            expect(content).toContain('<SEOHead');
        });

        it('should use Breadcrumb component', () => {
            expect(content).toContain(
                "import Breadcrumb from '../../../components/ui/Breadcrumb.astro'"
            );
            expect(content).toContain('<Breadcrumb items={breadcrumbItems}');
        });

        it('should use Container component', () => {
            expect(content).toContain(
                "import Container from '../../../components/ui/Container.astro'"
            );
            expect(content).toContain('<Container>');
        });

        it('should use Section component', () => {
            expect(content).toContain("import Section from '../../../components/ui/Section.astro'");
            expect(content).toContain('<Section>');
        });

        it('should import postsApi', () => {
            expect(content).toContain("import { postsApi } from '../../../lib/api/endpoints'");
        });

        it('should import EmptyState', () => {
            expect(content).toContain(
                "import EmptyState from '../../../components/ui/EmptyState.astro'"
            );
        });

        it('should import BlogPostCard', () => {
            expect(content).toContain(
                "import BlogPostCard from '../../../components/blog/BlogPostCard.astro'"
            );
        });
    });

    describe('Locale validation', () => {
        it('should validate locale parameter', () => {
            expect(content).toContain('const { lang } = Astro.params');
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should import locale helpers', () => {
            expect(content).toContain('isValidLocale');
            expect(content).toContain('type SupportedLocale');
        });
    });

    describe('Localization', () => {
        it('should have localized titles for all supported locales', () => {
            expect(content).toContain("es: 'Blog'");
            expect(content).toContain("en: 'Blog'");
            expect(content).toContain("pt: 'Blog'");
        });

        it('should have localized meta descriptions', () => {
            expect(content).toContain('const descriptions: Record<SupportedLocale, string>');
            expect(content).toContain(
                'consejos de viaje y novedades sobre turismo en el Litoral argentino'
            );
        });

        it('should have localized home breadcrumb labels', () => {
            expect(content).toContain('const homeLabels: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Inicio'");
            expect(content).toContain("en: 'Home'");
            expect(content).toContain("pt: 'Início'");
        });

        it('should have localized hero headings', () => {
            expect(content).toContain('const heroHeadings: Record<SupportedLocale, string>');
            expect(content).toContain("es: 'Blog de Hospeda'");
            expect(content).toContain("en: 'Hospeda Blog'");
            expect(content).toContain("pt: 'Blog da Hospeda'");
        });

        it('should have localized category labels', () => {
            expect(content).toContain(
                'const categoryLabels: Record<SupportedLocale, Record<string, string>>'
            );
            expect(content).toContain("all: 'Todos'");
            expect(content).toContain("destinations: 'Destinos'");
            expect(content).toContain("accommodations: 'Alojamientos'");
            expect(content).toContain("events: 'Eventos'");
            expect(content).toContain("gastronomy: 'Gastronomía'");
            expect(content).toContain("tips: 'Consejos'");
        });

        it('should have localized pagination labels', () => {
            expect(content).toContain(
                'const paginationLabels: Record<SupportedLocale, { previous: string; next: string }>'
            );
            expect(content).toContain("previous: 'Anterior'");
            expect(content).toContain("next: 'Siguiente'");
        });
    });

    describe('SEO elements', () => {
        it('should generate canonical URL', () => {
            expect(content).toContain('const canonicalUrl = new URL(Astro.url.pathname');
            expect(content).toContain('canonical={canonicalUrl}');
        });

        it('should pass title and description to SEOHead', () => {
            expect(content).toContain('title={titles[locale]}');
            expect(content).toContain('description={descriptions[locale]}');
        });

        it('should set page type to website', () => {
            expect(content).toContain('type="website"');
        });
    });

    describe('Breadcrumb navigation', () => {
        it('should create breadcrumb items array', () => {
            expect(content).toContain('const breadcrumbItems = [');
        });

        it('should have home breadcrumb link', () => {
            expect(content).toContain('{ label: homeLabels[locale], href: `/${locale}/`');
        });

        it('should have blog page breadcrumb', () => {
            expect(content).toContain('{ label: titles[locale], href: `/${locale}/publicaciones/`');
        });
    });

    describe('Content sections', () => {
        it('should have hero section', () => {
            expect(content).toContain('id="hero"');
            expect(content).toContain('{heroHeadings[locale]}');
            expect(content).toContain('{heroDescriptions[locale]}');
        });

        it('should have featured post section', () => {
            expect(content).toContain('id="featured-post"');
            expect(content).toContain('{featuredTitles[locale]}');
        });

        it('should have category filter section', () => {
            expect(content).toContain('id="category-filter"');
            expect(content).toContain('aria-label="Category filter"');
        });

        it('should have posts grid section', () => {
            expect(content).toContain('id="posts-grid"');
            expect(content).toContain('aria-label="Blog posts"');
        });

        it('should have pagination component', () => {
            expect(content).toContain('<Pagination');
        });
    });

    describe('Hero section', () => {
        it('should have main heading', () => {
            expect(content).toContain('<h1');
            expect(content).toContain('text-4xl font-bold');
            expect(content).toContain('md:text-5xl');
        });

        it('should have hero description', () => {
            expect(content).toContain('text-xl leading-relaxed');
        });
    });

    describe('Featured post area', () => {
        it('should have featured post container', () => {
            expect(content).toContain('rounded-lg border border-border');
            expect(content).toContain('hover:shadow-md');
        });

        it('should conditionally render featured post', () => {
            expect(content).toContain('featuredPost &&');
        });

        it('should have featured post image', () => {
            expect(content).toContain('aspect-video');
            expect(content).toContain('featuredImage');
        });

        it('should have category badge', () => {
            expect(content).toContain('rounded-full bg-primary/10');
        });

        it('should have post title', () => {
            expect(content).toContain('text-2xl font-bold');
        });

        it('should have post summary', () => {
            expect(content).toContain('line-clamp-3');
            expect(content).toContain('summary');
        });

        it('should have post date', () => {
            expect(content).toContain('<time');
            expect(content).toContain('datetime=');
        });
    });

    describe('Category filter', () => {
        it('should have category navigation', () => {
            expect(content).toContain('<nav aria-label="Category filter"');
        });

        it('should have all categories link', () => {
            expect(content).toContain('{categoryLabels[locale].all}');
            expect(content).toContain("aria-current={!category ? 'page' : undefined}");
        });

        it('should have destinations category link', () => {
            expect(content).toContain('{categoryLabels[locale].destinations}');
            expect(content).toContain('categoria=destinos');
        });

        it('should have accommodations category link', () => {
            expect(content).toContain('{categoryLabels[locale].accommodations}');
            expect(content).toContain('categoria=alojamientos');
        });

        it('should have events category link', () => {
            expect(content).toContain('{categoryLabels[locale].events}');
            expect(content).toContain('categoria=eventos');
        });

        it('should have gastronomy category link', () => {
            expect(content).toContain('{categoryLabels[locale].gastronomy}');
            expect(content).toContain('categoria=gastronomia');
        });

        it('should have tips category link', () => {
            expect(content).toContain('{categoryLabels[locale].tips}');
            expect(content).toContain('categoria=consejos');
        });
    });

    describe('Posts grid', () => {
        it('should have grid container', () => {
            expect(content).toContain('grid gap-6 sm:grid-cols-2 lg:grid-cols-3');
        });

        it('should render BlogPostCard for each post', () => {
            expect(content).toContain('posts.map((post) =>');
            expect(content).toContain('<BlogPostCard');
        });

        it('should pass post and locale to BlogPostCard', () => {
            expect(content).toContain('post={post');
            expect(content).toContain('locale={locale}');
        });

        it('should show EmptyState when no posts', () => {
            expect(content).toContain('posts.length > 0');
            expect(content).toContain('<EmptyState');
        });

        it('should have empty state text', () => {
            expect(content).toContain('{emptyStateTexts[locale]}');
        });
    });

    describe('Pagination', () => {
        it('should import Pagination component', () => {
            expect(content).toContain(
                "import Pagination from '../../../components/ui/Pagination.astro'"
            );
        });

        it('should conditionally render Pagination component', () => {
            expect(content).toContain('{pagination && (');
            expect(content).toContain('<Pagination');
        });

        it('should pass currentPage from pagination data', () => {
            expect(content).toContain('currentPage={pagination.page}');
        });

        it('should pass totalPages from pagination data', () => {
            expect(content).toContain('totalPages={pagination.totalPages}');
        });

        it('should extract pagination from API response', () => {
            expect(content).toContain('pagination.page');
            expect(content).toContain('pagination.totalPages');
        });
    });

    describe('API Integration', () => {
        it('should fetch posts from API', () => {
            expect(content).toContain('const apiResult = await postsApi.list');
        });

        it('should check apiResult.ok before using data', () => {
            expect(content).toContain('apiResult.ok');
        });

        it('should extract posts from API response', () => {
            expect(content).toContain('const posts = apiResult.ok ? apiResult.data.items : []');
        });

        it('should extract pagination from API response', () => {
            expect(content).toContain(
                'const pagination = apiResult.ok ? apiResult.data.pagination'
            );
        });

        it('should fetch featured post', () => {
            expect(content).toContain('const featuredResult = await postsApi.getFeatured()');
        });

        it('should pass query parameters to API', () => {
            expect(content).toContain('page, pageSize');
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            expect(content).toContain('aria-label="Category filter"');
            expect(content).toContain('aria-label="Blog posts"');
        });

        it('should have aria-current for active category', () => {
            expect(content).toContain("aria-current={!category ? 'page' : undefined}");
        });

        it('should use Pagination component for accessible page navigation', () => {
            expect(content).toContain('<Pagination');
        });
    });

    describe('Styling', () => {
        it('should have responsive grid layouts', () => {
            expect(content).toContain('sm:grid-cols-2');
            expect(content).toContain('lg:grid-cols-3');
            expect(content).toContain('md:grid-cols-2');
        });

        it('should have proper spacing classes', () => {
            expect(content).toContain('mb-12');
            expect(content).toContain('mb-16');
            expect(content).toContain('gap-6');
            expect(content).toContain('gap-8');
        });

        it('should have transition effects', () => {
            expect(content).toContain('transition-shadow');
            expect(content).toContain('transition-colors');
            expect(content).toContain('hover:shadow-md');
            expect(content).toContain('hover:bg-primary-dark');
        });

        it('should have focus styles', () => {
            expect(content).toContain('focus:outline-none');
            expect(content).toContain('focus:ring-2');
            expect(content).toContain('focus:ring-primary');
        });
    });
});
