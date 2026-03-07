/**
 * @file homepage-sections.test.ts
 * @description Tests for all 8 homepage section Astro components.
 * Validates Props interfaces, semantic token usage, i18n patterns,
 * accessibility attributes, and structural conventions.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../../src/components/sections');

const heroContent = readFileSync(resolve(srcDir, 'HeroSection.astro'), 'utf8');
const accommodationsContent = readFileSync(resolve(srcDir, 'AccommodationsSection.astro'), 'utf8');
const destinationsContent = readFileSync(resolve(srcDir, 'DestinationsSection.astro'), 'utf8');
const eventsContent = readFileSync(resolve(srcDir, 'EventsSection.astro'), 'utf8');
const postsContent = readFileSync(resolve(srcDir, 'PostsSection.astro'), 'utf8');
const listPropertyContent = readFileSync(resolve(srcDir, 'ListPropertySection.astro'), 'utf8');
const reviewsContent = readFileSync(resolve(srcDir, 'ReviewsSection.astro'), 'utf8');
const statsContent = readFileSync(resolve(srcDir, 'StatsSection.astro'), 'utf8');

// ---------------------------------------------------------------------------
// HeroSection
// ---------------------------------------------------------------------------
describe('HeroSection.astro', () => {
    it('should define a Props interface', () => {
        expect(heroContent).toContain('interface Props');
    });

    it('should declare locale prop as readonly', () => {
        expect(heroContent).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(heroContent).toContain('createT(');
    });

    it('should render translation calls with t(', () => {
        expect(heroContent).toContain("t('home.hero.");
    });

    it('should use semantic hero color tokens, not hardcoded palette values', () => {
        expect(heroContent).toContain('text-hero-text');
        expect(heroContent).toContain('text-hero-text-secondary');
        // Must not use arbitrary tailwind palette colors for text
        expect(heroContent).not.toContain('text-white ');
        expect(heroContent).not.toContain('text-gray-');
    });

    it('should use semantic overlay token', () => {
        expect(heroContent).toContain('hero-overlay');
    });

    it('should have a scroll-down anchor with aria-label', () => {
        expect(heroContent).toContain('aria-label');
        expect(heroContent).toContain('href="#alojamientos"');
    });

    it('should mark the SVG scroll icon as aria-hidden', () => {
        expect(heroContent).toContain('aria-hidden="true"');
    });

    it('should use a semantic section element', () => {
        expect(heroContent).toContain('<section');
    });

    it('should import SupportedLocale type only (not as value)', () => {
        expect(heroContent).toContain('import type { SupportedLocale }');
    });
});

// ---------------------------------------------------------------------------
// AccommodationsSection
// ---------------------------------------------------------------------------
describe('AccommodationsSection.astro', () => {
    it('should define a Props interface', () => {
        expect(accommodationsContent).toContain('interface Props');
    });

    it('should declare locale prop as readonly', () => {
        expect(accommodationsContent).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(accommodationsContent).toContain('createT(');
    });

    it('should render translation calls for section copy', () => {
        expect(accommodationsContent).toContain("t('home.categories.");
        expect(accommodationsContent).toContain("t('home.featuredAccommodations.");
    });

    it('should use semantic color token bg-hospeda-sky-light for background', () => {
        expect(accommodationsContent).toContain('bg-hospeda-sky-light');
    });

    it('should use semantic border token', () => {
        expect(accommodationsContent).toContain('bg-border');
    });

    it('should use semantic muted-foreground token', () => {
        expect(accommodationsContent).toContain('text-muted-foreground');
    });

    it('should have a section element with an id', () => {
        expect(accommodationsContent).toMatch(/id="accommodations"/);
    });

    it('should compose AccommodationCard and SectionHeader shared components', () => {
        expect(accommodationsContent).toContain('AccommodationCard');
        expect(accommodationsContent).toContain('SectionHeader');
    });

    it('should include a CTA button via GradientButton', () => {
        expect(accommodationsContent).toContain('GradientButton');
    });
});

// ---------------------------------------------------------------------------
// DestinationsSection
// ---------------------------------------------------------------------------
describe('DestinationsSection.astro', () => {
    it('should define a Props interface', () => {
        expect(destinationsContent).toContain('interface Props');
    });

    it('should declare locale prop as readonly', () => {
        expect(destinationsContent).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(destinationsContent).toContain('createT(');
    });

    it('should render translation calls for destination copy', () => {
        expect(destinationsContent).toContain("t('home.featuredDestinations.");
    });

    it('should use semantic bg-secondary for section background', () => {
        expect(destinationsContent).toContain('bg-secondary');
    });

    it('should use a semantic forest color for tagline', () => {
        expect(destinationsContent).toContain('text-hospeda-forest');
    });

    it('should have a section element with an id', () => {
        expect(destinationsContent).toMatch(/id="destinations"/);
    });

    it('should compose DestinationCard and SectionHeader', () => {
        expect(destinationsContent).toContain('DestinationCard');
        expect(destinationsContent).toContain('SectionHeader');
    });

    it('should include a CTA button via GradientButton', () => {
        expect(destinationsContent).toContain('GradientButton');
    });
});

// ---------------------------------------------------------------------------
// EventsSection
// ---------------------------------------------------------------------------
describe('EventsSection.astro', () => {
    it('should define a Props interface', () => {
        expect(eventsContent).toContain('interface Props');
    });

    it('should declare locale prop as readonly', () => {
        expect(eventsContent).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(eventsContent).toContain('createT(');
    });

    it('should render translation calls for events copy', () => {
        expect(eventsContent).toContain("t('home.upcomingEvents.");
    });

    it('should use semantic border token in footer divider', () => {
        expect(eventsContent).toContain('border-border');
    });

    it('should use semantic muted-foreground for footer text', () => {
        expect(eventsContent).toContain('text-muted-foreground');
    });

    it('should have a section element with an id', () => {
        expect(eventsContent).toMatch(/id="events"/);
    });

    it('should compose EventCard and SectionHeader', () => {
        expect(eventsContent).toContain('EventCard');
        expect(eventsContent).toContain('SectionHeader');
    });

    it('should pass the reversed prop for alternating bento layouts', () => {
        expect(eventsContent).toContain('reversed=');
    });

    it('should include a CTA button via GradientButton', () => {
        expect(eventsContent).toContain('GradientButton');
    });
});

// ---------------------------------------------------------------------------
// PostsSection
// ---------------------------------------------------------------------------
describe('PostsSection.astro', () => {
    it('should define a Props interface', () => {
        expect(postsContent).toContain('interface Props');
    });

    it('should declare locale prop as readonly', () => {
        expect(postsContent).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(postsContent).toContain('createT(');
    });

    it('should render translation calls for posts copy', () => {
        expect(postsContent).toContain("t('home.latestPosts.");
    });

    it('should use semantic bg-muted for section background', () => {
        expect(postsContent).toContain('bg-muted');
    });

    it('should use a forest color for tagline', () => {
        expect(postsContent).toContain('text-hospeda-forest');
    });

    it('should have a section element with an id', () => {
        expect(postsContent).toMatch(/id="posts"/);
    });

    it('should compose FeaturedArticleCard and SecondaryArticleCard', () => {
        expect(postsContent).toContain('FeaturedArticleCard');
        expect(postsContent).toContain('SecondaryArticleCard');
    });

    it('should split cards into featured and secondary', () => {
        expect(postsContent).toContain('featuredCard');
        expect(postsContent).toContain('secondaryCards');
    });

    it('should include a CTA button via GradientButton', () => {
        expect(postsContent).toContain('GradientButton');
    });
});

// ---------------------------------------------------------------------------
// ListPropertySection
// ---------------------------------------------------------------------------
describe('ListPropertySection.astro', () => {
    it('should define a Props interface', () => {
        expect(listPropertyContent).toContain('interface Props');
    });

    it('should declare locale prop as readonly', () => {
        expect(listPropertyContent).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(listPropertyContent).toContain('createT(');
    });

    it('should render translation calls for CTA copy', () => {
        expect(listPropertyContent).toContain("t('home.ownerCta.");
    });

    it('should use semantic primary color tokens for gradient card', () => {
        expect(listPropertyContent).toContain('from-primary');
        expect(listPropertyContent).toContain('text-primary-foreground');
    });

    it('should use semantic accent color for the CTA button', () => {
        expect(listPropertyContent).toContain('bg-accent');
        expect(listPropertyContent).toContain('text-accent-foreground');
    });

    it('should have aria-hidden on decorative circles', () => {
        expect(listPropertyContent).toContain('aria-hidden="true"');
    });

    it('should link to registrar-alojamiento with locale prefix', () => {
        expect(listPropertyContent).toContain('registrar-alojamiento');
        expect(listPropertyContent).toContain('/${locale}/');
    });

    it('should import icons from @repo/icons', () => {
        expect(listPropertyContent).toContain('from "@repo/icons"');
    });

    it('should have a section element', () => {
        expect(listPropertyContent).toContain('<section');
    });
});

// ---------------------------------------------------------------------------
// ReviewsSection
// ---------------------------------------------------------------------------
describe('ReviewsSection.astro', () => {
    it('should define a Props interface', () => {
        expect(reviewsContent).toContain('interface Props');
    });

    it('should declare locale prop as readonly', () => {
        expect(reviewsContent).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(reviewsContent).toContain('createT(');
    });

    it('should render translation calls for testimonials copy', () => {
        expect(reviewsContent).toContain("t('home.testimonials.");
    });

    it('should use semantic relative z-index stacking', () => {
        expect(reviewsContent).toContain('z-[2]');
    });

    it('should compose ReviewCard and SectionHeader', () => {
        expect(reviewsContent).toContain('ReviewCard');
        expect(reviewsContent).toContain('SectionHeader');
    });

    it('should iterate over REVIEWS data', () => {
        expect(reviewsContent).toContain('REVIEWS');
    });

    it('should have a section element', () => {
        expect(reviewsContent).toContain('<section');
    });
});

// ---------------------------------------------------------------------------
// StatsSection
// ---------------------------------------------------------------------------
describe('StatsSection.astro', () => {
    it('should define a Props interface', () => {
        expect(statsContent).toContain('interface Props');
    });

    it('should declare locale prop as readonly', () => {
        expect(statsContent).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(statsContent).toContain('createT(');
    });

    it('should render translation calls for statistics copy', () => {
        expect(statsContent).toContain("t('home.statistics.");
    });

    it('should use semantic bg-muted background token', () => {
        expect(statsContent).toContain('bg-muted');
    });

    it('should have a section element with an id', () => {
        expect(statsContent).toMatch(/id="stats"/);
    });

    it('should compose StatCard and SectionHeader', () => {
        expect(statsContent).toContain('StatCard');
        expect(statsContent).toContain('SectionHeader');
    });

    it('should iterate over STATS data', () => {
        expect(statsContent).toContain('STATS');
    });

    it('should use scroll-reveal class for animation', () => {
        expect(statsContent).toContain('scroll-reveal');
    });
});

// ---------------------------------------------------------------------------
// Additional: DestinationsSection - Grid layout, decoratives, API, CTA
// ---------------------------------------------------------------------------
describe('DestinationsSection.astro - grid layout and decoratives', () => {
    it('should use a 3-column grid for the card layout', () => {
        expect(destinationsContent).toContain('md:grid-cols-3');
    });

    it('should use gap utility for card spacing in the grid', () => {
        expect(destinationsContent).toContain('gap-6');
    });

    it('should reference the deco-avion decorative element', () => {
        expect(destinationsContent).toContain('deco-avion.svg');
    });

    it('should reference the deco-multi-pins decorative element', () => {
        expect(destinationsContent).toContain('deco-multi-pins.svg');
    });

    it('should reference the deco-flecha-curva decorative element', () => {
        expect(destinationsContent).toContain('deco-flecha-curva.svg');
    });

    it('should reference the deco-pin-location decorative element', () => {
        expect(destinationsContent).toContain('deco-pin-location.svg');
    });

    it('should reference the destinos illustration', () => {
        expect(destinationsContent).toContain('ilustracion-destinos.svg');
    });

    it('should call destinationsApi.list with isFeatured and pageSize', () => {
        expect(destinationsContent).toContain('destinationsApi.list');
        expect(destinationsContent).toContain('isFeatured: true');
        expect(destinationsContent).toContain('pageSize: 3');
    });

    it('should use toDestinationCardProps transform', () => {
        expect(destinationsContent).toContain('toDestinationCardProps');
    });

    it('should link CTA to /${locale}/destinos/', () => {
        expect(destinationsContent).toContain('/${locale}/destinos/');
    });

    it('should use scroll-reveal class on the CTA wrapper', () => {
        expect(destinationsContent).toContain('scroll-reveal');
    });

    it('should use negative top margin for overlapping wave effect', () => {
        expect(destinationsContent).toContain('-mt-10');
    });
});

// ---------------------------------------------------------------------------
// Additional: EventsSection - Grid layout, decoratives, API, CTA
// ---------------------------------------------------------------------------
describe('EventsSection.astro - grid layout and decoratives', () => {
    it('should use a 4-column grid for the bento layout on large screens', () => {
        expect(eventsContent).toContain('lg:grid-cols-4');
    });

    it('should use a 2-column grid on small screens', () => {
        expect(eventsContent).toContain('sm:grid-cols-2');
    });

    it('should apply scroll-reveal animation class to the bento grid', () => {
        expect(eventsContent).toContain('scroll-reveal');
    });

    it('should reference the deco-olas decorative element', () => {
        expect(eventsContent).toContain('deco-olas.svg');
    });

    it('should reference the deco-brujula decorative element', () => {
        expect(eventsContent).toContain('deco-brujula.svg');
    });

    it('should reference the eventos illustration', () => {
        expect(eventsContent).toContain('ilustracion-eventos.svg');
    });

    it('should call eventsApi.list with isFeatured and pageSize 4', () => {
        expect(eventsContent).toContain('eventsApi.list');
        expect(eventsContent).toContain('isFeatured: true');
        expect(eventsContent).toContain('pageSize: 4');
    });

    it('should use toEventCardProps transform', () => {
        expect(eventsContent).toContain('toEventCardProps');
    });

    it('should link CTA to /${locale}/eventos/', () => {
        expect(eventsContent).toContain('/${locale}/eventos/');
    });

    it('should render a footer divider between text and CTA', () => {
        expect(eventsContent).toContain('border-t');
    });
});

// ---------------------------------------------------------------------------
// Additional: PostsSection - Magazine layout, decoratives, API, CTA
// ---------------------------------------------------------------------------
describe('PostsSection.astro - magazine layout and decoratives', () => {
    it('should use a 12-column grid for the magazine layout', () => {
        expect(postsContent).toContain('lg:grid-cols-12');
    });

    it('should apply scroll-reveal animation class to the magazine grid', () => {
        expect(postsContent).toContain('scroll-reveal');
    });

    it('should use pattern-waves background pattern', () => {
        expect(postsContent).toContain('pattern-waves.svg');
    });

    it('should reference the deco-brujula decorative element', () => {
        expect(postsContent).toContain('deco-brujula.svg');
    });

    it('should reference the deco-avion decorative element', () => {
        expect(postsContent).toContain('deco-avion.svg');
    });

    it('should reference the notas illustration', () => {
        expect(postsContent).toContain('ilustracion-notas.svg');
    });

    it('should call postsApi.list with isFeatured and pageSize 3', () => {
        expect(postsContent).toContain('postsApi.list');
        expect(postsContent).toContain('isFeatured: true');
        expect(postsContent).toContain('pageSize: 3');
    });

    it('should use toPostCardProps transform', () => {
        expect(postsContent).toContain('toPostCardProps');
    });

    it('should link CTA to /${locale}/notas/', () => {
        expect(postsContent).toContain('/${locale}/notas/');
    });

    it('should place secondary cards in a 5-column span on large screens', () => {
        expect(postsContent).toContain('lg:col-span-5');
    });

    it('should align section header to the left', () => {
        expect(postsContent).toContain('align="left"');
    });
});

// ---------------------------------------------------------------------------
// Additional: AccommodationsSection - Grid, decoratives, API, filter chips, CTA
// ---------------------------------------------------------------------------
describe('AccommodationsSection.astro - grid layout, filter chips and decoratives', () => {
    it('should use a 4-column grid on xl screens', () => {
        expect(accommodationsContent).toContain('xl:grid-cols-4');
    });

    it('should use a 3-column grid on lg screens', () => {
        expect(accommodationsContent).toContain('lg:grid-cols-3');
    });

    it('should use a 2-column grid on sm screens', () => {
        expect(accommodationsContent).toContain('sm:grid-cols-2');
    });

    it('should apply scroll-reveal animation class to the accommodation grid', () => {
        expect(accommodationsContent).toContain('scroll-reveal');
    });

    it('should use pattern-dots background pattern', () => {
        expect(accommodationsContent).toContain('pattern-dots.svg');
    });

    it('should reference the deco-kayak decorative element', () => {
        expect(accommodationsContent).toContain('deco-kayak.svg');
    });

    it('should reference the deco-brujula decorative element', () => {
        expect(accommodationsContent).toContain('deco-brujula.svg');
    });

    it('should reference the deco-rio-uruguay decorative element', () => {
        expect(accommodationsContent).toContain('deco-rio-uruguay.svg');
    });

    it('should reference the buscar-alojamiento illustration', () => {
        expect(accommodationsContent).toContain('ilustracion-buscar-alojamiento.svg');
    });

    it('should import ACCOMMODATION_TYPES data', () => {
        expect(accommodationsContent).toContain('ACCOMMODATION_TYPES');
    });

    it('should import AMENITIES data', () => {
        expect(accommodationsContent).toContain('AMENITIES');
    });

    it('should render FilterChip for each accommodation type', () => {
        expect(accommodationsContent).toContain('FilterChip');
    });

    it('should call accommodationsApi.list with isFeatured and pageSize 8', () => {
        expect(accommodationsContent).toContain('accommodationsApi.list');
        expect(accommodationsContent).toContain('isFeatured: true');
        expect(accommodationsContent).toContain('pageSize: 8');
    });

    it('should use toAccommodationCardProps transform', () => {
        expect(accommodationsContent).toContain('toAccommodationCardProps');
    });

    it('should link CTA to /${locale}/alojamientos/', () => {
        expect(accommodationsContent).toContain('/${locale}/alojamientos/');
    });

    it('should use negative top margin for overlapping wave effect', () => {
        expect(accommodationsContent).toContain('-mt-10');
    });
});
