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
            expect(content).toContain('import BaseLayout');
            expect(content).toContain('BaseLayout.astro');
        });

        it('should import HeroSection', () => {
            expect(content).toContain('import HeroSection');
            expect(content).toContain('HeroSection.astro');
        });

        it('should import FeaturedSection', () => {
            expect(content).toContain('import FeaturedSection');
            expect(content).toContain('FeaturedSection.astro');
        });

        it('should import FeaturedAccommodations Server Island', () => {
            expect(content).toContain('import FeaturedAccommodations');
            expect(content).toContain('FeaturedAccommodations.astro');
        });

        it('should import FeaturedDestinations Server Island', () => {
            expect(content).toContain('import FeaturedDestinations');
            expect(content).toContain('FeaturedDestinations.astro');
        });

        it('should import FeaturedEvents Server Island', () => {
            expect(content).toContain('import FeaturedEvents');
            expect(content).toContain('FeaturedEvents.astro');
        });

        it('should import FeaturedPosts Server Island', () => {
            expect(content).toContain('import FeaturedPosts');
            expect(content).toContain('FeaturedPosts.astro');
        });

        it('should import CategoryIconsSection', () => {
            expect(content).toContain('import CategoryIconsSection');
            expect(content).toContain('CategoryIconsSection.astro');
        });

        it('should import TestimonialsSection', () => {
            expect(content).toContain('import TestimonialsSection');
            expect(content).toContain('TestimonialsSection.astro');
        });

        it('should import OwnerCTASection', () => {
            expect(content).toContain('import OwnerCTASection');
            expect(content).toContain('OwnerCTASection.astro');
        });

        it('should import skeleton components for Server Island fallbacks', () => {
            expect(content).toContain('import AccommodationCardSkeleton from');
            expect(content).toContain('import DestinationCardSkeleton from');
            expect(content).toContain('import EventCardSkeleton from');
            expect(content).toContain('import BlogPostCardSkeleton from');
        });

        it('should import i18n utilities', () => {
            expect(content).toContain('getLocaleFromParams');
        });

        it('should import AccommodationTypeEnum from @repo/schemas', () => {
            expect(content).toContain('AccommodationTypeEnum');
            expect(content).toContain('@repo/schemas');
        });

        it('should import HeroSearchBarLabels type', () => {
            expect(content).toContain('HeroSearchBarLabels');
        });
    });

    describe('SSG prerender with locale static paths', () => {
        it('should export prerender = true for SSG', () => {
            expect(content).toContain('export const prerender = true');
        });

        it('should define getStaticPaths function via re-export', () => {
            expect(content).toContain('getStaticLocalePaths as getStaticPaths');
        });

        it('should generate static path for Spanish locale', () => {
            expect(content).toContain('getStaticLocalePaths');
        });

        it('should generate static path for English locale', () => {
            expect(content).toContain('getStaticLocalePaths');
        });

        it('should generate static path for Portuguese locale', () => {
            expect(content).toContain('getStaticLocalePaths');
        });
    });

    describe('Locale validation', () => {
        it('should use getLocaleFromParams for locale validation', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
        });

        it('should validate locale with getLocaleFromParams guard', () => {
            expect(content).toContain('if (!locale)');
        });

        it('should redirect invalid locales to Spanish root', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });

        it('should get validated locale from getLocaleFromParams', () => {
            expect(content).toContain('const locale = getLocaleFromParams(Astro.params)');
        });
    });

    describe('i18n text keys', () => {
        it('should build searchLabels from i18n keys', () => {
            expect(content).toContain("key: 'searchBar.typePlaceholder'");
            expect(content).toContain("key: 'searchBar.ctaLabel'");
        });

        it('should call i18nT for heroAccentSubtitle', () => {
            expect(content).toContain("key: 'heroCarousel.accentSubtitle'");
        });

        it('should call i18nT for heroHeadline', () => {
            expect(content).toContain("key: 'heroCarousel.headline'");
        });

        it('should call i18nT for heroSubheadline', () => {
            expect(content).toContain("key: 'heroCarousel.subheadline'");
        });

        it('should define searchLabels with HeroSearchBarLabels type', () => {
            expect(content).toContain('HeroSearchBarLabels');
        });

        it('should call i18nT for featuredAccommodations', () => {
            expect(content).toContain("key: 'sections.featuredAccommodations'");
        });

        it('should call i18nT for featuredDestinations', () => {
            expect(content).toContain("key: 'sections.featuredDestinations'");
        });

        it('should call i18nT for upcomingEvents', () => {
            expect(content).toContain("key: 'sections.upcomingEvents'");
        });

        it('should call i18nT for latestBlog', () => {
            expect(content).toContain("key: 'sections.latestBlog'");
        });

        it('should call i18nT for viewAll', () => {
            expect(content).toContain("key: 'sections.viewAll'");
        });

        it('should call i18nT for pageTitle', () => {
            expect(content).toContain("key: 'page.title'");
        });

        it('should call i18nT for pageDescription', () => {
            expect(content).toContain("key: 'page.description'");
        });
    });

    describe('Search bar labels in i18n', () => {
        it('should build typeLabels from AccommodationTypeEnum', () => {
            expect(content).toContain('AccommodationTypeEnum');
            expect(content).toContain('typeLabels');
        });

        it('should use i18n keys for search bar fields', () => {
            expect(content).toContain("key: 'searchBar.datesPlaceholder'");
            expect(content).toContain("key: 'searchBar.guestsPlaceholder'");
            expect(content).toContain("key: 'searchBar.adultsLabel'");
            expect(content).toContain("key: 'searchBar.childrenLabel'");
            expect(content).toContain("key: 'searchBar.closePanelAriaLabel'");
        });

        it('should use i18n key for guestsSummary', () => {
            expect(content).toContain("key: 'searchBar.guestsSummary'");
        });
    });

    describe('HeroSection props', () => {
        it('should render HeroSection component', () => {
            expect(content).toContain('<HeroSection');
        });

        it('should pass accentSubtitle variable', () => {
            expect(content).toContain('accentSubtitle={heroAccentSubtitle}');
        });

        it('should pass headline variable', () => {
            expect(content).toContain('headline={heroHeadline}');
        });

        it('should pass subheadline variable', () => {
            expect(content).toContain('subheadline={heroSubheadline}');
        });

        it('should pass searchLabels directly', () => {
            expect(content).toContain('searchLabels={searchLabels}');
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

        it('should pass statsLabels as inline object', () => {
            expect(content).toContain(
                'statsLabels={{ destinations: statsDestinations, accommodations: statsAccommodations }}'
            );
        });

        it('should pass counterItems', () => {
            expect(content).toContain('counterItems={counterItems}');
        });

        it('should pass rotatingPhrases', () => {
            expect(content).toContain('rotatingPhrases={rotatingPhrases}');
        });

        it('should NOT pass socialProofText (removed)', () => {
            expect(content).not.toContain('socialProofText=');
        });

        it('should define apiBaseUrl from getApiUrl helper', () => {
            expect(content).toContain('getApiUrl()');
        });
    });

    describe('Stats labels', () => {
        it('should pass statsLabels as inline object in HeroSection props', () => {
            expect(content).toContain(
                'statsLabels={{ destinations: statsDestinations, accommodations: statsAccommodations }}'
            );
        });

        it('should NOT have categoryBadges data (removed)', () => {
            expect(content).not.toContain('const categoryBadges:');
        });
    });

    describe('Counter items', () => {
        it('should define counterItems via i18n', () => {
            expect(content).toContain('const counterItems =');
        });

        it('should include 22 destinations and 150+ accommodations', () => {
            expect(content).toContain('value: 22');
            expect(content).toContain('value: 150');
        });

        it('should use i18nT for counter destination label', () => {
            expect(content).toContain("key: 'counter.destinations.label'");
        });

        it('should use i18nT for counter accommodation label', () => {
            expect(content).toContain("key: 'counter.accommodations.label'");
        });
    });

    describe('Rotating phrases', () => {
        it('should define rotatingPhrases via i18n', () => {
            expect(content).toContain('const rotatingPhrases =');
        });

        it('should use i18nT for each unique phrase category', () => {
            expect(content).toContain("key: 'heroCarousel.phrases.river'");
            expect(content).toContain("key: 'heroCarousel.phrases.beach'");
            expect(content).toContain("key: 'heroCarousel.phrases.islands'");
        });

        it('should build the 22-phrase array referencing phrase variables', () => {
            expect(content).toContain('phraseRiver, phraseRiver, phraseRiver');
            expect(content).toContain('phraseBeach, phraseBeach');
        });
    });

    describe('BaseLayout with isHero prop', () => {
        it('should render BaseLayout as root layout', () => {
            expect(content).toContain('<BaseLayout');
        });

        it('should pass isHero prop to BaseLayout', () => {
            expect(content).toContain('isHero');
        });

        it('should pass page title variable to BaseLayout', () => {
            expect(content).toContain('title={pageTitle}');
        });

        it('should pass page description variable to BaseLayout', () => {
            expect(content).toContain('description={pageDescription}');
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

    describe('Section render order (8 positions)', () => {
        it('should follow the complete 8-position order', () => {
            const positions = [
                content.indexOf('<HeroSection'),
                content.indexOf('<FeaturedAccommodations'),
                content.indexOf('<FeaturedDestinations'),
                content.indexOf('<FeaturedEvents'),
                content.indexOf('<CategoryIconsSection'),
                content.indexOf('<FeaturedPosts'),
                content.indexOf('<TestimonialsSection'),
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
            expect(content).toContain('id: "testimonial-');
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
