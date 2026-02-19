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
        });

        it('should have localized text for English', () => {
            expect(content).toContain('en: {');
        });

        it('should have localized text for Portuguese', () => {
            expect(content).toContain('pt: {');
        });

        it('should define hero text keys', () => {
            expect(content).toContain('heroAccentSubtitle: string');
            expect(content).toContain('heroHeadline: string');
            expect(content).toContain('heroSubheadline: string');
        });

        it('should define search label keys', () => {
            expect(content).toContain('searchTypePlaceholder: string');
            expect(content).toContain('searchDestinationPlaceholder: string');
            expect(content).toContain('searchCheckInPlaceholder: string');
            expect(content).toContain('searchCheckOutPlaceholder: string');
            expect(content).toContain('searchCtaLabel: string');
            expect(content).toContain('searchAriaLabel: string');
        });

        it('should define carousel label keys', () => {
            expect(content).toContain('carouselAriaLabel: string');
            expect(content).toContain('carouselSlideNavLegend: string');
            expect(content).toContain('carouselDotAriaLabel: string');
            expect(content).toContain('carouselLiveRegionText: string');
        });

        it('should define section and page keys', () => {
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

        it('should pass slides prop as array', () => {
            expect(content).toContain('slides={heroSlides}');
        });

        it('should define hero slides with image paths', () => {
            expect(content).toContain("src: '/images/hero/slide-01.svg'");
            expect(content).toContain("src: '/images/hero/slide-02.svg'");
            expect(content).toContain("src: '/images/hero/slide-03.svg'");
        });

        it('should pass localized hero text props', () => {
            expect(content).toContain('accentSubtitle={t.heroAccentSubtitle}');
            expect(content).toContain('headline={t.heroHeadline}');
            expect(content).toContain('subheadline={t.heroSubheadline}');
        });

        it('should pass searchLabels object', () => {
            expect(content).toContain('searchLabels={');
            expect(content).toContain('typePlaceholder: t.searchTypePlaceholder');
            expect(content).toContain('ctaLabel: t.searchCtaLabel');
        });

        it('should pass carouselLabels object', () => {
            expect(content).toContain('carouselLabels={');
            expect(content).toContain('carouselAriaLabel: t.carouselAriaLabel');
            expect(content).toContain('liveRegionText: t.carouselLiveRegionText');
        });

        it('should pass locale and apiBaseUrl to HeroSection', () => {
            expect(content).toContain('locale={locale}');
            expect(content).toContain('apiBaseUrl={apiBaseUrl}');
        });

        it('should pass firstSectionFill for wave color', () => {
            expect(content).toContain('firstSectionFill="#F9F4EE"');
        });

        it('should define apiBaseUrl from env variable', () => {
            expect(content).toContain('import.meta.env.PUBLIC_API_URL');
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

        it('should have featured destinations section with warm background', () => {
            expect(content).toContain('title={t.featuredDestinations}');
            expect(content).toContain('viewAllHref={`/${locale}/destinos/`}');
            // Destinations FeaturedSection should have warm background
            const destSection = content.match(
                /<FeaturedSection[^>]*title=\{t\.featuredDestinations\}[^>]*/
            );
            expect(destSection).not.toBeNull();
            expect(destSection![0]).toContain('bg-bg-warm');
        });

        it('should have featured events section', () => {
            expect(content).toContain('title={t.upcomingEvents}');
            expect(content).toContain('viewAllHref={`/${locale}/eventos/`}');
        });

        it('should have featured blog posts section with gray background', () => {
            expect(content).toContain('title={t.latestBlog}');
            expect(content).toContain('viewAllHref={`/${locale}/publicaciones/`}');
            // Posts FeaturedSection should have gray background
            const postsSection = content.match(/<FeaturedSection[^>]*title=\{t\.latestBlog\}[^>]*/);
            expect(postsSection).not.toBeNull();
            expect(postsSection![0]).toContain('bg-surface-alt');
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

    describe('New Section Imports (SPEC-013)', () => {
        it('should import StatisticsSection', () => {
            expect(content).toContain(
                "import StatisticsSection from '../../components/content/StatisticsSection.astro'"
            );
        });

        it('should import CategoryIconsSection', () => {
            expect(content).toContain(
                "import CategoryIconsSection from '../../components/content/CategoryIconsSection.astro'"
            );
        });

        it('should import TestimonialsSection', () => {
            expect(content).toContain(
                "import TestimonialsSection from '../../components/content/TestimonialsSection.astro'"
            );
        });

        it('should import NewsletterSection', () => {
            expect(content).toContain(
                "import NewsletterSection from '../../components/content/NewsletterSection.astro'"
            );
        });

        it('should import OwnerCTASection', () => {
            expect(content).toContain(
                "import OwnerCTASection from '../../components/content/OwnerCTASection.astro'"
            );
        });
    });

    describe('Section Render Order (SPEC-013)', () => {
        it('should render StatisticsSection after FeaturedDestinations', () => {
            const destIdx = content.indexOf('<FeaturedDestinations');
            const statsIdx = content.indexOf('<StatisticsSection');
            expect(destIdx).toBeGreaterThan(-1);
            expect(statsIdx).toBeGreaterThan(-1);
            expect(statsIdx).toBeGreaterThan(destIdx);
        });

        it('should render CategoryIconsSection after FeaturedEvents', () => {
            const eventsIdx = content.indexOf('<FeaturedEvents');
            const catIdx = content.indexOf('<CategoryIconsSection');
            expect(eventsIdx).toBeGreaterThan(-1);
            expect(catIdx).toBeGreaterThan(-1);
            expect(catIdx).toBeGreaterThan(eventsIdx);
        });

        it('should render TestimonialsSection after FeaturedPosts', () => {
            const postsIdx = content.indexOf('<FeaturedPosts');
            const testIdx = content.indexOf('<TestimonialsSection');
            expect(postsIdx).toBeGreaterThan(-1);
            expect(testIdx).toBeGreaterThan(-1);
            expect(testIdx).toBeGreaterThan(postsIdx);
        });

        it('should render NewsletterSection after TestimonialsSection', () => {
            const testIdx = content.indexOf('<TestimonialsSection');
            const newsIdx = content.indexOf('<NewsletterSection');
            expect(testIdx).toBeGreaterThan(-1);
            expect(newsIdx).toBeGreaterThan(-1);
            expect(newsIdx).toBeGreaterThan(testIdx);
        });

        it('should render OwnerCTASection after NewsletterSection', () => {
            const newsIdx = content.indexOf('<NewsletterSection');
            const ownerIdx = content.indexOf('<OwnerCTASection');
            expect(newsIdx).toBeGreaterThan(-1);
            expect(ownerIdx).toBeGreaterThan(-1);
            expect(ownerIdx).toBeGreaterThan(newsIdx);
        });

        it('should follow the complete 11-position order', () => {
            const positions = [
                content.indexOf('<HeroSection'),
                content.indexOf('<FeaturedAccommodations'),
                content.indexOf('<FeaturedDestinations'),
                content.indexOf('<StatisticsSection'),
                content.indexOf('<FeaturedEvents'),
                content.indexOf('<CategoryIconsSection'),
                content.indexOf('<FeaturedPosts'),
                content.indexOf('<TestimonialsSection'),
                content.indexOf('<NewsletterSection'),
                content.indexOf('<OwnerCTASection')
            ];
            for (const pos of positions) {
                expect(pos).toBeGreaterThan(-1);
            }
            for (let i = 1; i < positions.length; i++) {
                expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
            }
        });
    });

    describe('Testimonials Data (SPEC-013)', () => {
        it('should define hardcoded testimonials array', () => {
            expect(content).toContain('TESTIMONIALS');
        });

        it('should pass testimonials to TestimonialsSection', () => {
            expect(content).toContain('testimonials={');
        });
    });

    describe('New Section Props (SPEC-013)', () => {
        it('should pass locale to StatisticsSection', () => {
            const match = content.match(/<StatisticsSection[^>]*locale/);
            expect(match).not.toBeNull();
        });

        it('should pass locale to CategoryIconsSection', () => {
            const match = content.match(/<CategoryIconsSection[^>]*locale/);
            expect(match).not.toBeNull();
        });

        it('should pass locale to TestimonialsSection', () => {
            const match = content.match(/<TestimonialsSection[^>]*locale/);
            expect(match).not.toBeNull();
        });

        it('should pass locale to NewsletterSection', () => {
            const match = content.match(/<NewsletterSection[^>]*locale/);
            expect(match).not.toBeNull();
        });

        it('should pass locale to OwnerCTASection', () => {
            const match = content.match(/<OwnerCTASection[^>]*locale/);
            expect(match).not.toBeNull();
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
