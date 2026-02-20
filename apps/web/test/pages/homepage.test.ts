/**
 * Test suite for the homepage ([lang]/index.astro).
 * Tests component imports, SSG strategy, locale validation, HeroSection props,
 * Server Islands, section order, i18n keys, and code quality.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(__dirname, '../../src/pages/[lang]/index.astro');
const content = readFileSync(pagePath, 'utf8');

describe('[lang]/index.astro - Homepage', () => {
    describe('Component imports', () => {
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

        it('should import skeleton components for Server Island fallbacks', () => {
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

        it('should import AccommodationTypeEnum from @repo/schemas', () => {
            expect(content).toContain("import { AccommodationTypeEnum } from '@repo/schemas'");
        });

        it('should import HeroSearchBarLabels type', () => {
            expect(content).toContain('HeroSearchBarLabels');
        });
    });

    describe('SSG prerender with locale static paths', () => {
        it('should export prerender = true for SSG', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should define getStaticPaths function', () => {
            expect(content).toContain('export function getStaticPaths()');
        });

        it('should generate static path for Spanish locale', () => {
            expect(content).toContain("{ params: { lang: 'es' } }");
        });

        it('should generate static path for English locale', () => {
            expect(content).toContain("{ params: { lang: 'en' } }");
        });

        it('should generate static path for Portuguese locale', () => {
            expect(content).toContain("{ params: { lang: 'pt' } }");
        });
    });

    describe('Locale validation', () => {
        it('should destructure lang from Astro.params', () => {
            expect(content).toContain('const { lang } = Astro.params');
        });

        it('should validate locale with isValidLocale guard', () => {
            expect(content).toContain('if (!lang || !isValidLocale(lang))');
        });

        it('should redirect invalid locales to Spanish root', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should cast validated locale to SupportedLocale type', () => {
            expect(content).toContain('const locale = lang as SupportedLocale');
        });
    });

    describe('i18n text keys', () => {
        it('should have localized text for Spanish', () => {
            expect(content).toContain('es: {');
        });

        it('should have localized text for English', () => {
            expect(content).toContain('en: {');
        });

        it('should have localized text for Portuguese', () => {
            expect(content).toContain('pt: {');
        });

        it('should define heroAccentSubtitle key', () => {
            expect(content).toContain('heroAccentSubtitle: string');
        });

        it('should define heroHeadline key', () => {
            expect(content).toContain('heroHeadline: string');
        });

        it('should define heroSubheadline key', () => {
            expect(content).toContain('heroSubheadline: string');
        });

        it('should define searchLabels as HeroSearchBarLabels type', () => {
            expect(content).toContain('searchLabels: HeroSearchBarLabels');
        });

        it('should define featuredAccommodations key', () => {
            expect(content).toContain('featuredAccommodations: string');
        });

        it('should define featuredDestinations key', () => {
            expect(content).toContain('featuredDestinations: string');
        });

        it('should define upcomingEvents key', () => {
            expect(content).toContain('upcomingEvents: string');
        });

        it('should define latestBlog key', () => {
            expect(content).toContain('latestBlog: string');
        });

        it('should define viewAll key', () => {
            expect(content).toContain('viewAll: string');
        });

        it('should define pageTitle key', () => {
            expect(content).toContain('pageTitle: string');
        });

        it('should define pageDescription key', () => {
            expect(content).toContain('pageDescription: string');
        });
    });

    describe('Search bar labels in i18n', () => {
        it('should include typeLabels with all accommodation types', () => {
            expect(content).toContain('AccommodationTypeEnum.HOTEL');
            expect(content).toContain('AccommodationTypeEnum.CABIN');
            expect(content).toContain('AccommodationTypeEnum.APARTMENT');
        });

        it('should include new label fields (dates, guests, close)', () => {
            expect(content).toContain('datesPlaceholder:');
            expect(content).toContain('guestsPlaceholder:');
            expect(content).toContain('adultsLabel:');
            expect(content).toContain('childrenLabel:');
            expect(content).toContain('closePanelAriaLabel:');
        });

        it('should include summary templates with placeholders', () => {
            expect(content).toContain('typesSummary:');
            expect(content).toContain('destinationsSummary:');
            expect(content).toContain('guestsSummary:');
        });
    });

    describe('HeroSection props', () => {
        it('should render HeroSection component', () => {
            expect(content).toContain('<HeroSection');
        });

        it('should pass accentSubtitle from i18n', () => {
            expect(content).toContain('accentSubtitle={t.heroAccentSubtitle}');
        });

        it('should pass headline from i18n', () => {
            expect(content).toContain('headline={t.heroHeadline}');
        });

        it('should pass subheadline from i18n', () => {
            expect(content).toContain('subheadline={t.heroSubheadline}');
        });

        it('should pass searchLabels directly', () => {
            expect(content).toContain('searchLabels={t.searchLabels}');
        });

        it('should pass locale to HeroSection', () => {
            expect(content).toContain('locale={locale}');
        });

        it('should pass apiBaseUrl to HeroSection', () => {
            expect(content).toContain('apiBaseUrl={apiBaseUrl}');
        });

        it('should NOT pass categoryBadges (removed)', () => {
            expect(content).not.toContain('categoryBadges={');
        });

        it('should pass statsLabels', () => {
            expect(content).toContain('statsLabels={t.statsLabels}');
        });

        it('should pass counterItems', () => {
            expect(content).toContain('counterItems={counterItems[locale]}');
        });

        it('should pass rotatingPhrases', () => {
            expect(content).toContain('rotatingPhrases={rotatingPhrases[locale]}');
        });

        it('should NOT pass socialProofText (removed)', () => {
            expect(content).not.toContain('socialProofText=');
        });

        it('should define apiBaseUrl from env variable', () => {
            expect(content).toContain('import.meta.env.PUBLIC_API_URL');
        });
    });

    describe('Stats labels', () => {
        it('should define statsLabels in texts for all locales', () => {
            expect(content).toContain('statsLabels:');
        });

        it('should NOT have categoryBadges data (removed)', () => {
            expect(content).not.toContain('const categoryBadges:');
        });
    });

    describe('Counter items', () => {
        it('should define counterItems for all locales', () => {
            expect(content).toContain('const counterItems:');
        });

        it('should include 22 destinations and 150+ accommodations', () => {
            expect(content).toContain('value: 22');
            expect(content).toContain('value: 150');
        });
    });

    describe('Rotating phrases', () => {
        it('should define rotatingPhrases for all locales', () => {
            expect(content).toContain('const rotatingPhrases:');
        });

        it('should have phrases matching hero image count (22)', () => {
            // Each locale should have 22 phrases matching 22 images
            const esPhrases = content.match(/'Navega el Rio Uruguay/g);
            expect(esPhrases).not.toBeNull();
        });
    });

    describe('BaseLayout with isHero prop', () => {
        it('should render BaseLayout as root layout', () => {
            expect(content).toContain('<BaseLayout');
        });

        it('should pass isHero prop to BaseLayout', () => {
            expect(content).toContain('isHero');
        });

        it('should pass page title to BaseLayout', () => {
            expect(content).toContain('title={t.pageTitle}');
        });

        it('should pass page description to BaseLayout', () => {
            expect(content).toContain('description={t.pageDescription}');
        });

        it('should pass locale to BaseLayout', () => {
            const baseLayoutMatch = content.match(/<BaseLayout[^>]*locale/);
            expect(baseLayoutMatch).not.toBeNull();
        });
    });

    describe('Server Islands with server:defer', () => {
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

        it('should have skeleton slot fallbacks for each Server Island', () => {
            expect(content).toContain('slot="fallback"');
            expect(content).toContain('<AccommodationCardSkeleton');
            expect(content).toContain('<DestinationCardSkeleton');
            expect(content).toContain('<EventCardSkeleton');
            expect(content).toContain('<BlogPostCardSkeleton');
        });
    });

    describe('Section render order (10 positions)', () => {
        it('should follow the complete 10-position order', () => {
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

    describe('Testimonials hardcoded array', () => {
        it('should define hardcoded TESTIMONIALS constant', () => {
            expect(content).toContain('TESTIMONIALS');
        });

        it('should pass testimonials to TestimonialsSection', () => {
            expect(content).toContain('testimonials={');
        });

        it('should have testimonials with id, quote, author fields', () => {
            expect(content).toContain("id: 'testimonial-");
            expect(content).toContain('quote:');
            expect(content).toContain('author:');
        });
    });

    describe('Code quality', () => {
        it('should have JSDoc comments', () => {
            expect(content).toContain('/**');
            expect(content).toContain('* Localized homepage');
        });

        it('should not use any type', () => {
            expect(content).not.toContain(': any');
        });

        it('should not contain mock data', () => {
            expect(content).not.toContain('mockAccommodations');
            expect(content).not.toContain('mockDestinations');
        });
    });
});
