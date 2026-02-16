/**
 * Test suite for the homepage ([lang]/index.astro)
 * Tests component imports, locale validation, SEO, Server Islands, and content structure
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/index.astro');
const content = readFileSync(pagePath, 'utf8');

describe('[lang]/index.astro - Homepage', () => {
    describe('Component Imports', () => {
        it('should import BaseLayout', () => {
            expect(content).toContain("import BaseLayout from '../../layouts/BaseLayout.astro'");
        });

        it('should import HeroSection', () => {
            expect(content).toContain(
                "import HeroSection from '../../components/content/HeroSection.astro'"
            );
        });

        it('should import FeaturedSection', () => {
            expect(content).toContain(
                "import FeaturedSection from '../../components/content/FeaturedSection.astro'"
            );
        });

        it('should import FeaturedAccommodations Server Island', () => {
            expect(content).toContain(
                "import FeaturedAccommodations from '../../components/content/FeaturedAccommodations.astro'"
            );
        });

        it('should import FeaturedDestinations Server Island', () => {
            expect(content).toContain(
                "import FeaturedDestinations from '../../components/content/FeaturedDestinations.astro'"
            );
        });

        it('should import FeaturedEvents Server Island', () => {
            expect(content).toContain(
                "import FeaturedEvents from '../../components/content/FeaturedEvents.astro'"
            );
        });

        it('should import FeaturedPosts Server Island', () => {
            expect(content).toContain(
                "import FeaturedPosts from '../../components/content/FeaturedPosts.astro'"
            );
        });

        it('should import skeleton components for fallbacks', () => {
            expect(content).toContain('import AccommodationCardSkeleton from');
            expect(content).toContain('import DestinationCardSkeleton from');
            expect(content).toContain('import EventCardSkeleton from');
            expect(content).toContain('import BlogPostCardSkeleton from');
        });

        it('should import SearchBar React component', () => {
            expect(content).toContain(
                "import { SearchBar } from '../../components/search/SearchBar.client'"
            );
        });

        it('should import Container', () => {
            expect(content).toContain(
                "import Container from '../../components/ui/Container.astro'"
            );
        });

        it('should import i18n utilities', () => {
            expect(content).toContain(
                "import { isValidLocale, type SupportedLocale } from '../../lib/i18n'"
            );
        });
    });

    describe('Rendering Strategy', () => {
        it('should be a prerendered (SSG) page', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should define static paths for all locales', () => {
            expect(content).toContain('export function getStaticPaths()');
            expect(content).toContain("{ params: { lang: 'es' } }");
            expect(content).toContain("{ params: { lang: 'en' } }");
            expect(content).toContain("{ params: { lang: 'pt' } }");
        });
    });

    describe('Locale Validation', () => {
        it('should validate locale parameter', () => {
            expect(content).toContain('const { lang } = Astro.params');
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect invalid locales to Spanish', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should cast validated locale to SupportedLocale', () => {
            expect(content).toContain('const locale = lang as SupportedLocale');
        });
    });

    describe('Localized Content', () => {
        it('should have localized text for Spanish', () => {
            expect(content).toContain('es: {');
            expect(content).toContain("heroTitle: 'Descubrí el Litoral argentino'");
        });

        it('should have localized text for English', () => {
            expect(content).toContain('en: {');
            expect(content).toContain("heroTitle: 'Discover the Argentine Litoral'");
        });

        it('should have localized text for Portuguese', () => {
            expect(content).toContain('pt: {');
            expect(content).toContain("heroTitle: 'Descubra o Litoral argentino'");
        });

        it('should define all required text keys', () => {
            expect(content).toContain('heroTitle: string');
            expect(content).toContain('heroSubtitle: string');
            expect(content).toContain('featuredAccommodations: string');
            expect(content).toContain('featuredDestinations: string');
            expect(content).toContain('upcomingEvents: string');
            expect(content).toContain('latestBlog: string');
            expect(content).toContain('viewAll: string');
            expect(content).toContain('pageTitle: string');
            expect(content).toContain('pageDescription: string');
        });
    });

    describe('Hero Section', () => {
        it('should render HeroSection component', () => {
            expect(content).toContain('<HeroSection');
        });

        it('should pass image prop to HeroSection', () => {
            expect(content).toContain('image="/images/hero-litoral.jpg"');
        });

        it('should pass localized title to HeroSection', () => {
            expect(content).toContain('title={t.heroTitle}');
        });

        it('should pass localized subtitle to HeroSection', () => {
            expect(content).toContain('subtitle={t.heroSubtitle}');
        });
    });

    describe('SearchBar', () => {
        it('should render SearchBar component', () => {
            expect(content).toContain('<SearchBar');
        });

        it('should use client:load directive for SearchBar', () => {
            expect(content).toContain('client:load');
        });

        it('should pass locale prop to SearchBar', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should position SearchBar in Container with negative margin', () => {
            expect(content).toContain('<div class="relative z-20 -mt-8">');
            expect(content).toContain('<Container>');
        });
    });

    describe('Server Islands (Featured Sections)', () => {
        it('should use server:defer for FeaturedAccommodations', () => {
            expect(content).toContain('<FeaturedAccommodations server:defer');
        });

        it('should use server:defer for FeaturedDestinations', () => {
            expect(content).toContain('<FeaturedDestinations server:defer');
        });

        it('should use server:defer for FeaturedEvents', () => {
            expect(content).toContain('<FeaturedEvents server:defer');
        });

        it('should use server:defer for FeaturedPosts', () => {
            expect(content).toContain('<FeaturedPosts server:defer');
        });

        it('should have skeleton fallbacks for each Server Island', () => {
            expect(content).toContain('slot="fallback"');
            expect(content).toContain('<AccommodationCardSkeleton');
            expect(content).toContain('<DestinationCardSkeleton');
            expect(content).toContain('<EventCardSkeleton');
            expect(content).toContain('<BlogPostCardSkeleton');
        });
    });

    describe('Featured Sections', () => {
        it('should have featured accommodations section', () => {
            expect(content).toContain('title={t.featuredAccommodations}');
            expect(content).toContain('viewAllHref={`/${locale}/alojamientos/`}');
        });

        it('should have featured destinations section', () => {
            expect(content).toContain('title={t.featuredDestinations}');
            expect(content).toContain('viewAllHref={`/${locale}/destinos/`}');
        });

        it('should have featured events section', () => {
            expect(content).toContain('title={t.upcomingEvents}');
            expect(content).toContain('viewAllHref={`/${locale}/eventos/`}');
        });

        it('should have featured blog posts section', () => {
            expect(content).toContain('title={t.latestBlog}');
            expect(content).toContain('viewAllHref={`/${locale}/publicaciones/`}');
        });

        it('should pass viewAllLabel to all featured sections', () => {
            expect(content).toMatch(/viewAllLabel=\{t\.viewAll\}/g);
        });
    });

    describe('SEO and Meta Tags', () => {
        it('should pass page title to BaseLayout', () => {
            expect(content).toContain('title={t.pageTitle}');
        });

        it('should pass page description to BaseLayout', () => {
            expect(content).toContain('description={t.pageDescription}');
        });

        it('should pass locale to BaseLayout', () => {
            expect(content).toContain('locale={locale}');
        });
    });

    describe('Code Quality', () => {
        it('should have JSDoc comments', () => {
            expect(content).toContain('/**');
            expect(content).toContain('* Localized homepage');
        });

        it('should not use any type', () => {
            expect(content).not.toContain(': any');
        });

        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });

        it('should not contain mock data', () => {
            expect(content).not.toContain('mockAccommodations');
            expect(content).not.toContain('mockDestinations');
            expect(content).not.toContain('mockEvents');
            expect(content).not.toContain('mockBlogPosts');
        });

        it('should not contain TODO comments for API integration', () => {
            expect(content).not.toContain('TODO: Replace with API');
        });
    });
});
