/**
 * @file EventCard.test.ts
 * @description Unit tests for EventCard.astro component.
 * Follows Astro testing pattern: read source file and assert on content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/shared/EventCard.astro'),
    'utf8'
);

describe('EventCard.astro', () => {
    describe('imports', () => {
        it('should import Badge component', () => {
            expect(src).toContain("import Badge from './Badge.astro'");
        });

        it('should import CalendarDotsIcon and LocationIcon from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('CalendarDotsIcon');
            expect(src).toContain('LocationIcon');
        });

        it('should import getEventCategoryColor from @/lib/colors', () => {
            expect(src).toContain("from '@/lib/colors'");
            expect(src).toContain('getEventCategoryColor');
        });

        it('should import formatDate from @/lib/format-utils', () => {
            expect(src).toContain("from '@/lib/format-utils'");
            expect(src).toContain('formatDate');
        });

        it('should import buildUrl from @/lib/urls', () => {
            expect(src).toContain("from '@/lib/urls'");
            expect(src).toContain('buildUrl');
        });

        it('should import EventCardData type', () => {
            expect(src).toContain('EventCardData');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });
    });

    describe('props interface', () => {
        it('should define Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('should declare data prop as readonly EventCardData', () => {
            expect(src).toContain('readonly data: EventCardData');
        });

        it('should declare locale prop as readonly SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('semantic structure', () => {
        it('should render an <article> element', () => {
            expect(src).toContain('<article');
        });

        it('should apply .card class to the article', () => {
            expect(src).toContain('class="card');
        });

        it('should have a .card__image container', () => {
            expect(src).toContain('card__image');
        });

        it('should have a .card__content container', () => {
            expect(src).toContain('card__content');
        });

        it('should render an <img> element', () => {
            expect(src).toContain('<img');
        });

        it('should render an <h3> for the event name', () => {
            expect(src).toContain('<h3');
        });
    });

    describe('image', () => {
        it('should use loading="lazy" on the image', () => {
            expect(src).toContain('loading="lazy"');
        });

        it('should set alt to data.name', () => {
            expect(src).toContain('alt={data.name}');
        });

        it('should set 16/9 aspect ratio on image container', () => {
            expect(src).toContain('aspect-ratio: 16/9');
        });

        it('should use organic border-radius on the image', () => {
            expect(src).toContain('var(--radius-organic)');
        });
    });

    describe('category badge', () => {
        it('should use Badge component for the category', () => {
            expect(src).toContain('<Badge');
        });

        it('should pass categoryColor to Badge colorScheme', () => {
            expect(src).toContain('colorScheme={categoryColor}');
        });

        it('should call getEventCategoryColor with data.category', () => {
            expect(src).toContain('{ category: data.category }');
        });
    });

    describe('content', () => {
        it('should use font-heading for the event name', () => {
            expect(src).toContain('font-heading');
        });

        it('should render CalendarDotsIcon for the date', () => {
            expect(src).toContain('CalendarDotsIcon');
        });

        it('should display formatted start date', () => {
            expect(src).toContain('startDate');
            expect(src).toContain('data.date.start');
        });

        it('should conditionally display end date', () => {
            expect(src).toContain('endDate');
            expect(src).toContain('data.date.end');
        });

        it('should conditionally render location when data.location exists', () => {
            expect(src).toContain('data.location');
        });

        it('should render LocationIcon for venue location', () => {
            expect(src).toContain('LocationIcon');
        });

        it('should display venue name and city when location exists', () => {
            expect(src).toContain('data.location.name');
            expect(src).toContain('data.location.city');
        });

        it('should render summary text', () => {
            expect(src).toContain('data.summary');
        });

        it('should apply line-clamp to the summary', () => {
            expect(src).toContain('-webkit-line-clamp: 2');
        });
    });

    describe('URL building', () => {
        it('should build detail URL with /eventos/ path and slug', () => {
            expect(src).toContain('/eventos/');
            expect(src).toContain('data.slug');
        });

        it('should link the card name to the detail page', () => {
            expect(src).toContain('href={detailUrl}');
        });
    });

    describe('accessibility', () => {
        it('should mark all decorative icons as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should use text-muted-foreground for secondary content', () => {
            expect(src).toContain('text-muted-foreground');
        });
    });
});
