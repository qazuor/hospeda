/**
 * @file reviews-section.test.ts
 * @description Focused tests for ReviewsSection.astro, ReviewCard.astro,
 * and the REVIEWS static data layer.
 *
 * Covers: Props interface, i18n translation keys, imported components,
 * REVIEWS data binding, grid layout, decorative element usage,
 * accessibility (semantic HTML, blockquote structure, icon ariaHidden),
 * semantic token compliance, and the ReviewCard sub-component structure.
 *
 * Strategy: source-file reading via readFileSync.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sectionsDir = resolve(__dirname, '../../../src/components/sections');
const sharedDir = resolve(__dirname, '../../../src/components/shared');
const dataDir = resolve(__dirname, '../../../src/data');

const sectionSrc = readFileSync(resolve(sectionsDir, 'ReviewsSection.astro'), 'utf8');
const reviewCardSrc = readFileSync(resolve(sharedDir, 'ReviewCard.astro'), 'utf8');
const reviewsDataSrc = readFileSync(resolve(dataDir, 'reviews.ts'), 'utf8');

// ---------------------------------------------------------------------------
// ReviewsSection.astro - Props interface
// ---------------------------------------------------------------------------

describe('ReviewsSection.astro - Props interface', () => {
    it('should define a Props interface', () => {
        // Arrange / Act / Assert
        expect(sectionSrc).toContain('interface Props');
    });

    it('should declare locale as a readonly optional prop', () => {
        expect(sectionSrc).toContain('readonly locale?');
    });

    it('should default locale to "es" for the Argentina market', () => {
        expect(sectionSrc).toContain("locale = 'es'");
    });
});

// ---------------------------------------------------------------------------
// ReviewsSection.astro - i18n integration
// ---------------------------------------------------------------------------

describe('ReviewsSection.astro - i18n integration', () => {
    it('should import createT from @/lib/i18n', () => {
        expect(sectionSrc).toContain('createT');
        expect(sectionSrc).toContain('@/lib/i18n');
    });

    it('should create the translation function with the locale prop', () => {
        expect(sectionSrc).toContain('createT(locale)');
    });

    it('should use home.testimonials namespace for section copy', () => {
        expect(sectionSrc).toContain("t('home.testimonials.");
    });

    it('should translate the section tagline', () => {
        expect(sectionSrc).toContain("t('home.testimonials.tagline'");
    });

    it('should translate the section title', () => {
        expect(sectionSrc).toContain("t('home.testimonials.title'");
    });

    it('should provide a Spanish fallback for the tagline', () => {
        expect(sectionSrc).toContain("'Testimonios'");
    });

    it('should provide a Spanish fallback for the section title', () => {
        expect(sectionSrc).toContain('Lo que dicen nuestros viajeros');
    });
});

// ---------------------------------------------------------------------------
// ReviewsSection.astro - Imported components
// ---------------------------------------------------------------------------

describe('ReviewsSection.astro - Imported components', () => {
    it('should import ReviewCard from shared components', () => {
        expect(sectionSrc).toContain('ReviewCard');
    });

    it('should import SectionHeader from shared components', () => {
        expect(sectionSrc).toContain('SectionHeader');
    });

    it('should import BackgroundPattern for the section texture', () => {
        expect(sectionSrc).toContain('BackgroundPattern');
    });

    it('should import DecorativeElement for illustrative flourishes', () => {
        expect(sectionSrc).toContain('DecorativeElement');
    });

    it('should import Illustration for the reviews illustration', () => {
        expect(sectionSrc).toContain('Illustration');
    });
});

// ---------------------------------------------------------------------------
// ReviewsSection.astro - REVIEWS data binding
// ---------------------------------------------------------------------------

describe('ReviewsSection.astro - REVIEWS data binding', () => {
    it('should import REVIEWS from the data layer', () => {
        expect(sectionSrc).toContain('REVIEWS');
        expect(sectionSrc).toContain('@/data/reviews');
    });

    it('should iterate over REVIEWS using .map()', () => {
        expect(sectionSrc).toContain('REVIEWS.map(');
    });

    it('should pass each review entry to ReviewCard via the review prop', () => {
        expect(sectionSrc).toContain('<ReviewCard review={review}');
    });
});

// ---------------------------------------------------------------------------
// ReviewsSection.astro - Grid layout and structure
// ---------------------------------------------------------------------------

describe('ReviewsSection.astro - Grid layout and structure', () => {
    it('should use a <section> element as the root', () => {
        expect(sectionSrc).toContain('<section');
    });

    it('should use a 3-column grid on medium screens', () => {
        expect(sectionSrc).toContain('md:grid-cols-3');
    });

    it('should apply scroll-reveal for entrance animation', () => {
        expect(sectionSrc).toContain('scroll-reveal');
    });

    it('should constrain content width with max-w-7xl container', () => {
        expect(sectionSrc).toContain('max-w-7xl');
    });

    it('should use z-[2] for stacking context above other sections', () => {
        expect(sectionSrc).toContain('z-[2]');
    });

    it('should include generous vertical padding for visual breathing room', () => {
        expect(sectionSrc).toContain('py-16');
    });
});

// ---------------------------------------------------------------------------
// ReviewsSection.astro - Decorative elements
// ---------------------------------------------------------------------------

describe('ReviewsSection.astro - Decorative elements', () => {
    it('should use the pattern-crosses background texture', () => {
        expect(sectionSrc).toContain('pattern-crosses.svg');
    });

    it('should include the rio-uruguay decorative element', () => {
        expect(sectionSrc).toContain('deco-rio-uruguay.svg');
    });

    it('should include a compass/brujula decorative element', () => {
        expect(sectionSrc).toContain('deco-brujula.svg');
    });

    it('should include a kayak decorative element', () => {
        expect(sectionSrc).toContain('deco-kayak.svg');
    });

    it('should include the ruta-punteada decorative element', () => {
        expect(sectionSrc).toContain('deco-ruta-punteada.svg');
    });

    it('should include the reviews illustration SVG', () => {
        expect(sectionSrc).toContain('ilustracion-reviews.svg');
    });
});

// ---------------------------------------------------------------------------
// REVIEWS data array integrity
// ---------------------------------------------------------------------------

describe('reviews.ts - Data integrity', () => {
    it('should export REVIEWS as a named constant', () => {
        expect(reviewsDataSrc).toContain('export const REVIEWS');
    });

    it('should type REVIEWS as readonly Review[]', () => {
        expect(reviewsDataSrc).toContain('readonly Review[]');
    });

    it('should import the Review type with import type (type-only import)', () => {
        expect(reviewsDataSrc).toContain('import type { Review }');
    });

    it('should contain 3 review entries (matching the 3-column grid)', () => {
        const nameMatches = reviewsDataSrc.match(/name:/g) ?? [];
        expect(nameMatches.length).toBe(3);
    });

    it('should include Maria L. review from Buenos Aires', () => {
        expect(reviewsDataSrc).toContain("name: 'Maria L.'");
        expect(reviewsDataSrc).toContain("location: 'Buenos Aires'");
    });

    it('should include Carlos R. review from Rosario', () => {
        expect(reviewsDataSrc).toContain("name: 'Carlos R.'");
        expect(reviewsDataSrc).toContain("location: 'Rosario'");
    });

    it('should include Ana S. review from Cordoba', () => {
        expect(reviewsDataSrc).toContain("name: 'Ana S.'");
        expect(reviewsDataSrc).toContain("location: 'Cordoba'");
    });

    it('should have all reviews at a 5-star rating', () => {
        const ratingMatches = reviewsDataSrc.match(/rating: 5/g) ?? [];
        expect(ratingMatches.length).toBe(3);
    });

    it('should include accommodation references for each review', () => {
        expect(reviewsDataSrc).toContain("accommodation: 'Hotel Boutique Rio Azul'");
        expect(reviewsDataSrc).toContain("accommodation: 'Cabanas del Litoral'");
        expect(reviewsDataSrc).toContain("accommodation: 'Glamping Selva Montielera'");
    });

    it('should freeze data via as const assertion', () => {
        expect(reviewsDataSrc).toContain('as const');
    });
});

// ---------------------------------------------------------------------------
// ReviewCard.astro - Props interface
// ---------------------------------------------------------------------------

describe('ReviewCard.astro - Props interface', () => {
    it('should define a Props interface', () => {
        expect(reviewCardSrc).toContain('interface Props');
    });

    it('should declare the review prop as readonly', () => {
        expect(reviewCardSrc).toContain('readonly review: Review');
    });

    it('should import the Review type with import type', () => {
        expect(reviewCardSrc).toContain('import type { Review }');
    });
});

// ---------------------------------------------------------------------------
// ReviewCard.astro - Semantic HTML structure
// ---------------------------------------------------------------------------

describe('ReviewCard.astro - Semantic HTML structure', () => {
    it('should use a <blockquote> as the card root for semantic correctness', () => {
        expect(reviewCardSrc).toContain('<blockquote');
    });

    it('should render the review text wrapped in quotes', () => {
        expect(reviewCardSrc).toContain('"{review.text}"');
    });

    it('should render the reviewer name', () => {
        expect(reviewCardSrc).toContain('{review.name}');
    });

    it('should render the reviewer location', () => {
        expect(reviewCardSrc).toContain('{review.location}');
    });

    it('should render the accommodation name', () => {
        expect(reviewCardSrc).toContain('{review.accommodation}');
    });
});

// ---------------------------------------------------------------------------
// ReviewCard.astro - Star rating
// ---------------------------------------------------------------------------

describe('ReviewCard.astro - Star rating integration', () => {
    it('should import StarsDisplay from shared components', () => {
        expect(reviewCardSrc).toContain('StarsDisplay');
    });

    it('should pass review.rating to StarsDisplay via count prop', () => {
        expect(reviewCardSrc).toContain('<StarsDisplay count={review.rating}');
    });
});

// ---------------------------------------------------------------------------
// ReviewCard.astro - Icon usage
// ---------------------------------------------------------------------------

describe('ReviewCard.astro - Icon usage', () => {
    it('should import QuotesIcon from @repo/icons (not inline SVG)', () => {
        expect(reviewCardSrc).toContain('QuotesIcon');
        expect(reviewCardSrc).toContain('@repo/icons');
    });

    it('should render the QuotesIcon as a decorative visual element', () => {
        expect(reviewCardSrc).toContain('<QuotesIcon');
    });
});

// ---------------------------------------------------------------------------
// ReviewCard.astro - Avatar initials
// ---------------------------------------------------------------------------

describe('ReviewCard.astro - Avatar initials', () => {
    it('should render the first character of the reviewer name as avatar', () => {
        expect(reviewCardSrc).toContain('review.name[0]');
    });

    it('should style the avatar as a rounded circle', () => {
        expect(reviewCardSrc).toContain('rounded-full');
    });
});

// ---------------------------------------------------------------------------
// ReviewCard.astro - Semantic token compliance
// ---------------------------------------------------------------------------

describe('ReviewCard.astro - Semantic token compliance', () => {
    it('should use bg-card for the card surface', () => {
        expect(reviewCardSrc).toContain('bg-card');
        expect(reviewCardSrc).not.toContain('bg-white');
    });

    it('should use text-card-foreground for the review text', () => {
        expect(reviewCardSrc).toContain('text-card-foreground');
    });

    it('should use shadow-card and shadow-card-hover semantic tokens', () => {
        expect(reviewCardSrc).toContain('shadow-card');
        expect(reviewCardSrc).toContain('shadow-card-hover');
    });

    it('should use border-border for the separator between review and author', () => {
        expect(reviewCardSrc).toContain('border-border');
    });

    it('should use text-muted-foreground for secondary author info', () => {
        expect(reviewCardSrc).toContain('text-muted-foreground');
    });

    it('should use bg-primary for the avatar background', () => {
        expect(reviewCardSrc).toContain('bg-primary');
    });

    it('should use text-primary-foreground for avatar text', () => {
        expect(reviewCardSrc).toContain('text-primary-foreground');
    });

    it('should NOT use hardcoded palette colors', () => {
        expect(reviewCardSrc).not.toContain('bg-gray-');
        expect(reviewCardSrc).not.toContain('text-gray-');
        expect(reviewCardSrc).not.toContain('bg-white');
        expect(reviewCardSrc).not.toContain('text-black');
    });
});

// ---------------------------------------------------------------------------
// ReviewCard.astro - Layout and animation
// ---------------------------------------------------------------------------

describe('ReviewCard.astro - Layout and animation', () => {
    it('should apply hover shadow transition for interactive feedback', () => {
        expect(reviewCardSrc).toContain('hover:shadow-card-hover');
    });

    it('should use transition-all for smooth hover state', () => {
        expect(reviewCardSrc).toContain('transition-all');
    });

    it('should use rounded-2xl for a soft card shape', () => {
        expect(reviewCardSrc).toContain('rounded-2xl');
    });

    it('should include a JSDoc file header', () => {
        expect(reviewCardSrc).toContain('@file ReviewCard.astro');
    });
});
