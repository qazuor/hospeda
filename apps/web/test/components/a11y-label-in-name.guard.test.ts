/**
 * @file a11y-label-in-name.guard.test.ts
 * @description Source-level guard for WCAG 2.5.3 "label in name" (axe rule
 * `label-content-name-mismatch`).
 *
 * The rule fires on an interactive element whose `aria-label` /
 * `aria-labelledby` does not CONTAIN its visible text. `.astro` files cannot be
 * rendered in Vitest, so this reads the source (the documented pattern in this
 * repo) and pins the two shapes that satisfy the rule:
 *
 * - Whole-card links and CTA links carry NO `aria-label`: the accessible name
 *   then comes from the visible content, so the rule does not apply.
 * - Contact links keep the visible value (phone / email / URL) first and append
 *   the descriptive text as `.sr-only` content instead of an `aria-label`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const COMPONENTS = resolve(__dirname, '../../src/components');

function read(relativePath: string): string {
    return readFileSync(resolve(COMPONENTS, relativePath), 'utf8');
}

/**
 * Returns the opening `<a ...>` tags of `src` whose class attribute contains
 * `className`, so the assertion cannot be satisfied by an unrelated element.
 */
function openingTags({ src, className }: { src: string; className: string }): string[] {
    const tags = src.match(/<a\b[^>]*>/g) ?? [];
    return tags.filter((tag) => new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`).test(tag));
}

const CARD_LINKS: ReadonlyArray<{ file: string; className: string }> = [
    { file: 'shared/cards/DestinationCard.astro', className: 'dest-card__link' },
    { file: 'shared/cards/AccommodationCard.astro', className: 'acc-card__link' },
    { file: 'shared/cards/EventCardHorizontal.astro', className: 'event-card-h__link' },
    { file: 'shared/cards/ArticleCard.astro', className: 'article-card__link' },
    { file: 'venue/VenueCard.astro', className: 'venue-card__link' },
    { file: 'experience/ExperienceCard.astro', className: 'exp-card__link' },
    { file: 'post/PostRelatedEntityCard.astro', className: 'post-related-entity' },
    { file: 'shared/auth/SignInCtaCard.astro', className: 'signin-cta__link' },
    { file: 'shared/cards/EventCardFeatured.astro', className: 'event-card-featured__link' },
    { file: 'shared/cards/FeaturedArticleCard.astro', className: 'featured-card__link' }
];

describe('label in name (WCAG 2.5.3): links whose visible text is their content', () => {
    for (const { file, className } of CARD_LINKS) {
        it(`${file}: .${className} has no aria-label / aria-labelledby`, () => {
            // Arrange
            const tags = openingTags({ src: read(file), className });

            // Assert: the link exists, and nothing overrides its content-derived name
            expect(tags.length).toBeGreaterThan(0);
            for (const tag of tags) {
                expect(tag).not.toMatch(/aria-label(ledby)?=/);
            }
        });
    }
});

const CONTACT_LINKS: ReadonlyArray<{ file: string; className: string }> = [
    { file: 'accommodation/AccommodationContactBlock.astro', className: 'acc-contact__link' },
    { file: 'venue/VenueContactBlock.astro', className: 'venue-contact__link' },
    {
        file: 'event/EventDetailOrganizerCard.astro',
        className: 'event-organizer-card__contact-link'
    }
];

describe('label in name (WCAG 2.5.3): contact links', () => {
    for (const { file, className } of CONTACT_LINKS) {
        it(`${file}: .${className} keeps the visible value in the name and adds sr-only context`, () => {
            // Arrange
            const src = read(file);
            const tags = openingTags({ src, className });

            // Assert
            expect(tags.length).toBeGreaterThan(0);
            for (const tag of tags) {
                expect(tag).not.toMatch(/aria-label(ledby)?=/);
            }
            // The descriptive text moved into sr-only content that FOLLOWS the value.
            expect(src).toContain('<span class="sr-only">, ');
        });
    }
});

describe('label in name (WCAG 2.5.3): homepage destination carousel card', () => {
    it('DestinationsIsland no longer overrides the card link name', () => {
        // Arrange
        const src = read('sections/DestinationsIsland.client.tsx');

        // Assert: the slide <article> still carries the "N of M: name" label,
        // but the inner link must not replace its visible text.
        expect(src).not.toContain('cardAriaLabel');
        expect(src).not.toContain('destinations.carousel.viewDestination');
    });
});
