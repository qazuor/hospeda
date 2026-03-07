/**
 * @file card-components.test.ts
 * @description Tests for shared Astro card components.
 * Validates Props interfaces, semantic token usage, img tags, i18n patterns,
 * accessibility, and link structure.
 *
 * Components covered:
 * - AccommodationCard.astro
 * - DestinationCard.astro
 * - EventCard.astro
 * - ReviewCard.astro
 * - FeaturedArticleCard.astro
 * - SecondaryArticleCard.astro
 * - StatCard.astro
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sharedDir = resolve(__dirname, '../../../src/components/shared');

const accommodationCard = readFileSync(resolve(sharedDir, 'AccommodationCard.astro'), 'utf8');
const destinationCard = readFileSync(resolve(sharedDir, 'DestinationCard.astro'), 'utf8');
const eventCard = readFileSync(resolve(sharedDir, 'EventCard.astro'), 'utf8');
const reviewCard = readFileSync(resolve(sharedDir, 'ReviewCard.astro'), 'utf8');
const featuredArticleCard = readFileSync(resolve(sharedDir, 'FeaturedArticleCard.astro'), 'utf8');
const secondaryArticleCard = readFileSync(resolve(sharedDir, 'SecondaryArticleCard.astro'), 'utf8');
const statCard = readFileSync(resolve(sharedDir, 'StatCard.astro'), 'utf8');

// ---------------------------------------------------------------------------
// AccommodationCard
// ---------------------------------------------------------------------------
describe('AccommodationCard.astro', () => {
    it('should define a Props interface', () => {
        expect(accommodationCard).toContain('interface Props');
    });

    it('should declare card prop as readonly', () => {
        expect(accommodationCard).toContain('readonly card:');
    });

    it('should declare locale prop as readonly', () => {
        expect(accommodationCard).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(accommodationCard).toContain('createT(');
    });

    it('should render translation calls', () => {
        expect(accommodationCard).toContain("t('home.featuredAccommodations.");
    });

    it('should render an img tag for the accommodation image', () => {
        expect(accommodationCard).toContain('<img');
        expect(accommodationCard).toContain('card.featuredImage');
    });

    it('should set alt attribute on the image', () => {
        expect(accommodationCard).toContain('alt={card.name}');
    });

    it('should use semantic card background token', () => {
        expect(accommodationCard).toContain('bg-card');
    });

    it('should use semantic muted-foreground token', () => {
        expect(accommodationCard).toContain('text-muted-foreground');
    });

    it('should use semantic foreground gradient overlay', () => {
        expect(accommodationCard).toContain('from-foreground/');
    });

    it('should link to accommodation detail page with locale prefix', () => {
        expect(accommodationCard).toContain('/${locale}/alojamientos/${card.slug}/');
    });

    it('should have aria-label on the detail link', () => {
        expect(accommodationCard).toContain('aria-label=');
    });

    it('should compose CategoryBadge, LocationBadge, RatingBadge, AmenityTag', () => {
        expect(accommodationCard).toContain('CategoryBadge');
        expect(accommodationCard).toContain('LocationBadge');
        expect(accommodationCard).toContain('RatingBadge');
        expect(accommodationCard).toContain('AmenityTag');
    });

    it('should use an article element as root', () => {
        expect(accommodationCard).toContain('<article');
    });

    it('should import icon from @repo/icons', () => {
        expect(accommodationCard).toContain('from "@repo/icons"');
    });
});

// ---------------------------------------------------------------------------
// DestinationCard
// ---------------------------------------------------------------------------
describe('DestinationCard.astro', () => {
    it('should define a Props interface', () => {
        expect(destinationCard).toContain('interface Props');
    });

    it('should have a card prop', () => {
        expect(destinationCard).toContain('card:');
    });

    it('should use i18n via createT', () => {
        expect(destinationCard).toContain('createT(');
    });

    it('should render an img tag with alt attribute', () => {
        expect(destinationCard).toContain('<img');
        expect(destinationCard).toContain('alt=');
    });

    it('should use semantic card/foreground gradient overlay', () => {
        expect(destinationCard).toContain('from-foreground/');
    });

    it('should link to destination detail page with locale prefix', () => {
        expect(destinationCard).toContain('/${locale}/destinos/${card.slug}/');
    });

    it('should display accommodations count with i18n label', () => {
        expect(destinationCard).toContain('card.accommodationsCount');
        expect(destinationCard).toContain("t('home.featuredDestinations.accommodations");
    });

    it('should have aria-label on the arrow button', () => {
        expect(destinationCard).toContain('aria-label=');
    });

    it('should use semantic accent color for count text', () => {
        expect(destinationCard).toContain('text-accent');
    });

    it('should support a stagger animation via index prop', () => {
        expect(destinationCard).toContain('index');
        expect(destinationCard).toContain('transition-delay');
    });
});

// ---------------------------------------------------------------------------
// EventCard
// ---------------------------------------------------------------------------
describe('EventCard.astro', () => {
    it('should define a Props interface', () => {
        expect(eventCard).toContain('interface Props');
    });

    it('should declare card prop as readonly', () => {
        expect(eventCard).toContain('readonly card:');
    });

    it('should declare reversed prop as readonly', () => {
        expect(eventCard).toContain('readonly reversed?');
    });

    it('should declare locale prop as readonly', () => {
        expect(eventCard).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(eventCard).toContain('createT(');
    });

    it('should render translation calls', () => {
        expect(eventCard).toContain("t('home.upcomingEvents.");
    });

    it('should render an img tag for the event image', () => {
        expect(eventCard).toContain('<img');
        expect(eventCard).toContain('card.featuredImage');
    });

    it('should set alt attribute on the image', () => {
        expect(eventCard).toContain('alt={card.name}');
    });

    it('should use semantic foreground gradient overlay', () => {
        expect(eventCard).toContain('from-background');
    });

    it('should link to event detail page with locale prefix', () => {
        expect(eventCard).toContain('/${locale}/eventos/${card.slug}/');
    });

    it('should have aria-label on the detail link', () => {
        expect(eventCard).toContain('aria-label=');
    });

    it('should compose CategoryBadge and LocationBadge', () => {
        expect(eventCard).toContain('CategoryBadge');
        expect(eventCard).toContain('LocationBadge');
    });

    it('should apply conditional reversed layout via class:list', () => {
        expect(eventCard).toContain('class:list');
        expect(eventCard).toContain('reversed');
    });

    it('should use semantic muted-foreground token for date display', () => {
        expect(eventCard).toContain('text-muted-foreground');
    });
});

// ---------------------------------------------------------------------------
// ReviewCard
// ---------------------------------------------------------------------------
describe('ReviewCard.astro', () => {
    it('should define a Props interface', () => {
        expect(reviewCard).toContain('interface Props');
    });

    it('should declare review prop as readonly', () => {
        expect(reviewCard).toContain('readonly review:');
    });

    it('should use a blockquote element as root', () => {
        expect(reviewCard).toContain('<blockquote');
    });

    it('should use semantic bg-card and shadow-card tokens', () => {
        expect(reviewCard).toContain('bg-card');
        expect(reviewCard).toContain('shadow-card');
    });

    it('should use semantic card-foreground for text', () => {
        expect(reviewCard).toContain('text-card-foreground');
    });

    it('should use semantic border-border token', () => {
        expect(reviewCard).toContain('border-border');
    });

    it('should compose StarsDisplay', () => {
        expect(reviewCard).toContain('StarsDisplay');
    });

    it('should display review text', () => {
        expect(reviewCard).toContain('review.text');
    });

    it('should display reviewer name and location', () => {
        expect(reviewCard).toContain('review.name');
        expect(reviewCard).toContain('review.location');
    });

    it('should display accommodation name', () => {
        expect(reviewCard).toContain('review.accommodation');
    });

    it('should use primary color for avatar background', () => {
        expect(reviewCard).toContain('bg-primary');
        expect(reviewCard).toContain('text-primary-foreground');
    });

    it('should import icon from @repo/icons', () => {
        expect(reviewCard).toContain('from "@repo/icons"');
    });
});

// ---------------------------------------------------------------------------
// FeaturedArticleCard
// ---------------------------------------------------------------------------
describe('FeaturedArticleCard.astro', () => {
    it('should define a Props interface', () => {
        expect(featuredArticleCard).toContain('interface Props');
    });

    it('should declare article prop as readonly', () => {
        expect(featuredArticleCard).toContain('readonly article:');
    });

    it('should declare locale prop as readonly', () => {
        expect(featuredArticleCard).toContain('readonly locale?');
    });

    it('should use i18n via createT', () => {
        expect(featuredArticleCard).toContain('createT(');
    });

    it('should render a translation call for readArticle label', () => {
        expect(featuredArticleCard).toContain("t('home.latestPosts.readArticle");
    });

    it('should render an img tag for the article image', () => {
        expect(featuredArticleCard).toContain('<img');
        expect(featuredArticleCard).toContain('article.featuredImage');
    });

    it('should set alt attribute on the image', () => {
        expect(featuredArticleCard).toContain('alt={article.title}');
    });

    it('should link to publication detail page with locale prefix', () => {
        expect(featuredArticleCard).toContain('/${locale}/publicaciones/${article.slug}/');
    });

    it('should use semantic card background token', () => {
        expect(featuredArticleCard).toContain('bg-card');
    });

    it('should use semantic foreground gradient overlay', () => {
        expect(featuredArticleCard).toContain('from-foreground/');
    });

    it('should use semantic muted-foreground token', () => {
        expect(featuredArticleCard).toContain('text-muted-foreground');
    });

    it('should use semantic primary token for CTA text', () => {
        expect(featuredArticleCard).toContain('text-primary');
    });

    it('should compose PaperFold and CategoryBadge', () => {
        expect(featuredArticleCard).toContain('PaperFold');
        expect(featuredArticleCard).toContain('CategoryBadge');
    });

    it('should have aria-hidden on bookmark decoration', () => {
        expect(featuredArticleCard).toContain('aria-hidden="true"');
    });

    it('should span 7 columns in the grid', () => {
        expect(featuredArticleCard).toContain('lg:col-span-7');
    });
});

// ---------------------------------------------------------------------------
// SecondaryArticleCard
// ---------------------------------------------------------------------------
describe('SecondaryArticleCard.astro', () => {
    it('should define a Props interface', () => {
        expect(secondaryArticleCard).toContain('interface Props');
    });

    it('should declare article prop as readonly', () => {
        expect(secondaryArticleCard).toContain('readonly article:');
    });

    it('should declare locale prop as readonly', () => {
        expect(secondaryArticleCard).toContain('readonly locale?');
    });

    it('should render an img tag for the article image', () => {
        expect(secondaryArticleCard).toContain('<img');
        expect(secondaryArticleCard).toContain('article.featuredImage');
    });

    it('should set alt attribute on the image', () => {
        expect(secondaryArticleCard).toContain('alt={article.title}');
    });

    it('should link to publication detail page with locale prefix', () => {
        expect(secondaryArticleCard).toContain('/${locale}/publicaciones/${article.slug}/');
    });

    it('should use semantic bg-card token', () => {
        expect(secondaryArticleCard).toContain('bg-card');
    });

    it('should use semantic muted-foreground token', () => {
        expect(secondaryArticleCard).toContain('text-muted-foreground');
    });

    it('should use semantic border token', () => {
        expect(secondaryArticleCard).toContain('border-border');
    });

    it('should compose PaperFold and CategoryBadge', () => {
        expect(secondaryArticleCard).toContain('PaperFold');
        expect(secondaryArticleCard).toContain('CategoryBadge');
    });

    it('should display reading time', () => {
        expect(secondaryArticleCard).toContain('article.readingTimeMinutes');
    });
});

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
describe('StatCard.astro', () => {
    it('should define a Props interface', () => {
        expect(statCard).toContain('interface Props');
    });

    it('should have a stat prop', () => {
        expect(statCard).toContain('stat:');
    });

    it('should use semantic bg-card token', () => {
        expect(statCard).toContain('bg-card');
    });

    it('should use semantic primary color for icon wrapper', () => {
        expect(statCard).toContain('bg-primary/10');
        expect(statCard).toContain('text-primary');
    });

    it('should use semantic foreground token for value text', () => {
        expect(statCard).toContain('text-foreground');
    });

    it('should use semantic muted-foreground for description', () => {
        expect(statCard).toContain('text-muted-foreground');
    });

    it('should display stat value', () => {
        expect(statCard).toContain('stat.value');
    });

    it('should display stat label', () => {
        expect(statCard).toContain('stat.label');
    });

    it('should display stat description', () => {
        expect(statCard).toContain('stat.description');
    });

    it('should mark icon wrapper as aria-hidden', () => {
        expect(statCard).toContain('aria-hidden="true"');
    });
});

// ---------------------------------------------------------------------------
// Hover effects on cards
// ---------------------------------------------------------------------------
describe('Card hover effects', () => {
    it('AccommodationCard should apply hover shadow and translate transform', () => {
        expect(accommodationCard).toContain('hover:shadow-card-hover');
        expect(accommodationCard).toContain('hover:-translate-y-1');
    });

    it('AccommodationCard image should scale on group-hover', () => {
        expect(accommodationCard).toContain('group-hover:scale-110');
    });

    it('AccommodationCard should use group class for coordinated hover effects', () => {
        expect(accommodationCard).toContain('group overflow-hidden');
    });

    it('EventCard image should scale on hover', () => {
        expect(eventCard).toContain('hover:scale-105');
    });

    it('ReviewCard should apply hover shadow', () => {
        expect(reviewCard).toContain('hover:shadow-card-hover');
    });

    it('FeaturedArticleCard should apply group-hover translate', () => {
        expect(featuredArticleCard).toContain('group-hover:-translate-x-1.5');
        expect(featuredArticleCard).toContain('group-hover:-translate-y-1.5');
    });

    it('SecondaryArticleCard image should scale on group-hover', () => {
        expect(secondaryArticleCard).toContain('group-hover:scale-110');
    });
});

// ---------------------------------------------------------------------------
// Price display on AccommodationCard
// ---------------------------------------------------------------------------
describe('AccommodationCard price display', () => {
    it('should call formatPrice helper', () => {
        expect(accommodationCard).toContain('formatPrice(');
    });

    it('should render a per-night label via i18n', () => {
        expect(accommodationCard).toContain("t('home.featuredAccommodations.perNight'");
    });

    it('should render an inquire fallback label when no price', () => {
        expect(accommodationCard).toContain("t('home.featuredAccommodations.inquire'");
    });

    it('should render the price in a rounded pill with backdrop-blur', () => {
        expect(accommodationCard).toContain('rounded-full bg-card/90');
        expect(accommodationCard).toContain('backdrop-blur-sm');
    });

    it('should use text-primary for the inquire label', () => {
        expect(accommodationCard).toContain('text-primary');
    });
});

// ---------------------------------------------------------------------------
// Amenity badges on AccommodationCard
// ---------------------------------------------------------------------------
describe('AccommodationCard amenity badges', () => {
    it('should map over card.amenities array', () => {
        expect(accommodationCard).toContain('card.amenities');
    });

    it('should pass amenity.label to AmenityTag', () => {
        expect(accommodationCard).toContain('amenity.label');
    });

    it('should guard against null amenities with ?? []', () => {
        expect(accommodationCard).toContain('?? []');
    });

    it('should wrap amenity tags in a flex-wrap container', () => {
        expect(accommodationCard).toContain('flex flex-wrap gap-1');
    });
});

// ---------------------------------------------------------------------------
// Avatar initials in ReviewCard
// ---------------------------------------------------------------------------
describe('ReviewCard avatar initials', () => {
    it('should derive initials from the first character of review.name', () => {
        expect(reviewCard).toContain('review.name[0]');
    });

    it('should render the avatar with a rounded-full circle', () => {
        expect(reviewCard).toContain('rounded-full bg-primary');
    });
});

// ---------------------------------------------------------------------------
// Date display in EventCard
// ---------------------------------------------------------------------------
describe('EventCard date formatting', () => {
    it('should render card.date.start when available', () => {
        expect(eventCard).toContain('card.date.start');
    });

    it('should show a "date to be confirmed" i18n label as fallback', () => {
        expect(eventCard).toContain("t('home.upcomingEvents.dateToBeConfirmed'");
    });

    it('should render date alongside a CalendarIcon', () => {
        expect(eventCard).toContain('CalendarIcon');
    });
});

// ---------------------------------------------------------------------------
// Image lazy loading via view transition names
// ---------------------------------------------------------------------------
describe('Image transition:name attribute (view transitions)', () => {
    it('AccommodationCard image should have transition:name with entity slug', () => {
        expect(accommodationCard).toContain('transition:name={`entity-${card.slug}`}');
    });

    it('EventCard image should have transition:name with entity slug', () => {
        expect(eventCard).toContain('transition:name={`entity-${card.slug}`}');
    });

    it('FeaturedArticleCard image should have transition:name with entity slug', () => {
        expect(featuredArticleCard).toContain('transition:name={`entity-${article.slug}`}');
    });

    it('SecondaryArticleCard image should have transition:name with entity slug', () => {
        expect(secondaryArticleCard).toContain('transition:name={`entity-${article.slug}`}');
    });
});

// ---------------------------------------------------------------------------
// Destination card variant - stagger and accent color
// ---------------------------------------------------------------------------
describe('DestinationCard variant specifics', () => {
    it('should use font-serif for the destination name', () => {
        expect(destinationCard).toContain('font-serif');
    });

    it('should link destination count text with text-accent class', () => {
        expect(destinationCard).toContain('text-accent');
    });

    it('should use card.accommodationsCount in the link text', () => {
        expect(destinationCard).toContain('card.accommodationsCount');
    });

    it('should render the root element as an anchor tag', () => {
        expect(destinationCard).toContain('<a\n');
    });

    it('should apply group class for hover coordination', () => {
        expect(destinationCard).toContain('group relative');
    });
});
