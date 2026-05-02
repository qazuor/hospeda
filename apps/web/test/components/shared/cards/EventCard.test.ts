/**
 * @file EventCard.test.ts
 * @description Unit tests for EventCard.astro component.
 * Follows Astro testing pattern: read source file and assert on content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/EventCard.astro'),
    'utf8'
);

describe('EventCard.astro', () => {
    describe('imports', () => {
        it('should import Badge component', () => {
            expect(src).toContain("import Badge from '../ui/Badge.astro'");
        });

        it('should import FavoriteButton island from shared/favorite', () => {
            expect(src).toContain("from '@/components/shared/favorite/FavoriteButton.client'");
            expect(src).toContain('FavoriteButton');
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

        it('should declare optional isAuthenticated prop', () => {
            expect(src).toContain('readonly isAuthenticated?: boolean');
        });

        it('should default isAuthenticated to false', () => {
            expect(src).toContain('isAuthenticated = false');
        });
    });

    describe('FavoriteButton island integration (SPEC-098)', () => {
        it('should render FavoriteButton with client:load directive', () => {
            expect(src).toContain('client:load');
        });

        it('should pass entityId from data.id', () => {
            expect(src).toContain('entityId={data.id}');
        });

        it('should pass entityType="EVENT"', () => {
            expect(src).toContain('entityType="EVENT"');
        });

        it('should pass initialIsFavorited from data.isFavorited', () => {
            expect(src).toContain('initialIsFavorited={data.isFavorited}');
        });

        it('should pass initialBookmarkId from data.favoriteBookmarkId with null fallback', () => {
            expect(src).toContain('initialBookmarkId={data.favoriteBookmarkId ?? null}');
        });

        it('should pass count from data.bookmarkCount', () => {
            expect(src).toContain('count={data.bookmarkCount}');
        });

        it('should use standalone variant', () => {
            expect(src).toContain('variant="standalone"');
        });

        it('should forward locale to FavoriteButton', () => {
            expect(src).toContain('locale={locale}');
        });

        it('should forward isAuthenticated to FavoriteButton', () => {
            expect(src).toContain('isAuthenticated={isAuthenticated}');
        });

        it('should position FavoriteButton wrapper outside the image <a> link', () => {
            expect(src).toContain('event-card__fav-wrapper');
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

        it('should prefer caption over name as alt text (caption wins when present)', () => {
            // Caption from API media.featuredImage.caption is used first; name is the fallback.
            expect(src).toContain('data.featuredImage.caption ?? data.name');
        });

        it('should use data.featuredImage.url as the image src', () => {
            expect(src).toContain('data.featuredImage.url');
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

        it('should display venue name when location exists', () => {
            expect(src).toContain('data.location.name');
        });

        it('should prefer cityName from cityDestination over legacy location.city (SPEC-095)', () => {
            expect(src).toContain('data.cityName ?? data.location.city');
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

        it('should use muted-foreground CSS variable for secondary content', () => {
            expect(src).toContain('muted-foreground');
        });
    });
});
