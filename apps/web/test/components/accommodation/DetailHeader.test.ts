/**
 * @file DetailHeader.test.ts
 * @description Source-reading tests for DetailHeader.astro after the
 * AccommodationTypeBadge unification and FavoriteButton/bookmark-count
 * integration (T-045). The detail header delegates the type pill to the
 * shared `AccommodationTypeBadge` component (single source of truth for
 * type colour + label) while keeping the generic `Badge` primitive for
 * status pills (featured/new). Compact-mode overrides reach into the type
 * badge through the `--acc-type-*` custom properties exposed by it.
 *
 * T-045: FavoriteButton island is placed top-right inside a new
 * `.detail-header__top-row` wrapper. The public bookmark counter is
 * rendered inline next to the rating when `bookmarkCount` is defined.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/DetailHeader.astro'),
    'utf8'
);

describe('DetailHeader.astro — type badge unification', () => {
    describe('imports', () => {
        it('imports AccommodationTypeBadge from shared/ui', () => {
            expect(src).toContain("from '@/components/shared/ui/AccommodationTypeBadge.astro'");
        });

        it('imports the generic Badge for status pills', () => {
            expect(src).toContain("from '@/components/shared/ui/Badge.astro'");
        });

        it('imports getBadgeStatusColor from @/lib/colors', () => {
            expect(src).toContain("from '@/lib/colors'");
            expect(src).toContain('getBadgeStatusColor');
        });

        it('no longer imports getAccommodationTypeColor or its solid variant', () => {
            expect(src).not.toContain('getAccommodationTypeColor');
            expect(src).not.toContain('getAccommodationTypeColorSolid');
        });

        it('no longer imports getAccommodationTypeLabel (moved into the badge)', () => {
            expect(src).not.toContain('getAccommodationTypeLabel');
        });
    });

    describe('badge rendering', () => {
        it('renders the shared AccommodationTypeBadge for the type pill', () => {
            expect(src).toMatch(/<AccommodationTypeBadge[^>]*type=\{accommodation\.type\}/);
        });

        it('forwards size="sm" to the type badge', () => {
            expect(src).toMatch(/<AccommodationTypeBadge[\s\S]*?size="sm"/);
        });

        it('forwards class="detail-header__type-badge" so compact mode can target it', () => {
            expect(src).toMatch(/<AccommodationTypeBadge[\s\S]*?class="detail-header__type-badge"/);
        });

        it('still uses the generic Badge primitive for status pills', () => {
            expect(src).toContain('<Badge');
            expect(src).toContain('class="detail-header__status-badge"');
        });

        it('does not render an inline `<span class="detail-header__type-badge">`', () => {
            expect(src).not.toMatch(/<span[^>]*class="detail-header__type-badge"/);
        });
    });

    describe('CSS overrides preserved', () => {
        it('still defines compact-mode rules for the status pills', () => {
            expect(src).toMatch(/wave-header--compact[\s\S]*?detail-header__status-badge/);
        });

        it('compact mode overrides the type badge via custom properties (no !important)', () => {
            expect(src).toMatch(
                /wave-header--compact[\s\S]*?detail-header__type-badge[\s\S]*?--acc-type-font-size/
            );
            expect(src).toMatch(
                /wave-header--compact[\s\S]*?detail-header__type-badge[\s\S]*?--acc-type-padding/
            );
            expect(src).not.toMatch(/--acc-type-font-size:[^;]*!important/);
        });
    });
});

describe('DetailHeader.astro — T-045: FavoriteButton + bookmark counter', () => {
    describe('imports', () => {
        it('imports FavoriteButton from shared/favorite', () => {
            expect(src).toContain("from '@/components/shared/favorite/FavoriteButton.client'");
        });

        it('imports tPlural via createTranslations (destructured)', () => {
            expect(src).toMatch(/const\s*\{[^}]*tPlural[^}]*\}\s*=\s*createTranslations/);
        });
    });

    describe('Props interface', () => {
        it('declares isAuthenticated prop', () => {
            expect(src).toContain('isAuthenticated');
        });

        it('declares accommodationId prop', () => {
            expect(src).toContain('accommodationId');
        });

        it('declares initialIsFavorited prop', () => {
            expect(src).toContain('initialIsFavorited');
        });

        it('declares initialBookmarkId prop', () => {
            expect(src).toContain('initialBookmarkId');
        });

        it('declares bookmarkCount prop', () => {
            expect(src).toContain('bookmarkCount');
        });
    });

    describe('FavoriteButton island', () => {
        it('renders FavoriteButton with client:load', () => {
            expect(src).toMatch(/<FavoriteButton[\s\S]*?client:load/);
        });

        it('passes entityType="ACCOMMODATION" to FavoriteButton', () => {
            expect(src).toMatch(/<FavoriteButton[\s\S]*?entityType="ACCOMMODATION"/);
        });

        it('passes entityId from accommodationId prop', () => {
            expect(src).toMatch(/<FavoriteButton[\s\S]*?entityId=\{accommodationId\}/);
        });

        it('passes isAuthenticated prop through to FavoriteButton', () => {
            expect(src).toMatch(/<FavoriteButton[\s\S]*?isAuthenticated=\{isAuthenticated\}/);
        });

        it('uses standalone variant for detail page', () => {
            expect(src).toMatch(/<FavoriteButton[\s\S]*?variant="standalone"/);
        });

        it('positions FavoriteButton inside detail-header__top-row', () => {
            expect(src).toContain('detail-header__top-row');
            expect(src).toMatch(
                /detail-header__top-row[\s\S]*?FavoriteButton|FavoriteButton[\s\S]*?detail-header__top-row/
            );
        });
    });

    describe('Bookmark counter', () => {
        it('renders detail-header__bookmark-count element', () => {
            expect(src).toContain('detail-header__bookmark-count');
        });

        it('uses tPlural with accommodations.detail.bookmark_count key', () => {
            expect(src).toContain("tPlural('accommodations.detail.bookmark_count'");
        });

        it('guards counter render with bookmarkCount !== undefined', () => {
            expect(src).toMatch(/bookmarkCount\s*!==\s*undefined/);
        });

        it('counter has heart icon element', () => {
            expect(src).toContain('detail-header__bookmark-icon');
        });
    });

    describe('Top-row layout', () => {
        it('wraps badges and FavoriteButton in detail-header__top-row', () => {
            expect(src).toMatch(/class="detail-header__top-row"/);
        });

        it('has CSS for detail-header__top-row', () => {
            expect(src).toContain('.detail-header__top-row');
        });

        it('has CSS for detail-header__bookmark-count', () => {
            expect(src).toContain('.detail-header__bookmark-count');
        });
    });
});
