/**
 * @file DetailHeader.test.ts
 * @description Source-reading tests for DetailHeader.astro.
 *
 * The detail header delegates the type pill to the shared
 * `AccommodationTypeBadge` (single source of truth for type colour + label).
 * Status pills (featured/new) are rendered as inline `<span>` elements so
 * they share the exact padding / font-size of the type badge — the generic
 * Badge primitive's inline styles would otherwise win and produce a
 * visually-smaller pill. Colours still come from `getBadgeStatusColor`.
 *
 * Layout: `.detail-header__main` (left) + `.detail-header__favorite` (right)
 * keep the heart button anchored to the right at every breakpoint and in
 * compact mode.
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

        it('renders status pills as inline spans sized to match the type badge', () => {
            expect(src).toMatch(/<span[^>]*class="detail-header__status-pill"/);
        });

        it('applies status-pill colours from getBadgeStatusColor via inline style', () => {
            // Commit d4112990c (refactor: unify "Destacado" badge look) replaced the
            // featuredColors variable + detail-header__status-pill span with a shared
            // <span class="featured-badge"> component. Only the "new" pill retains
            // the getBadgeStatusColor-derived inline style via newColors.
            expect(src).toContain('newColors');
            // The "featured" badge now uses the shared featured-badge class, not inline colors.
            expect(src).toContain('featured-badge');
        });

        it('does not render an inline `<span class="detail-header__type-badge">`', () => {
            expect(src).not.toMatch(/<span[^>]*class="detail-header__type-badge"/);
        });
    });

    describe('CSS overrides preserved', () => {
        it('still defines compact-mode rules for the status pills', () => {
            expect(src).toMatch(/wave-header--compact[\s\S]*?detail-header__status-pill/);
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

        it('places FavoriteButton inside its own right-aligned container', () => {
            expect(src).toContain('detail-header__favorite');
            expect(src).toMatch(/detail-header__favorite[\s\S]*?<FavoriteButton/);
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

    describe('Layout', () => {
        it('wraps the textual content in a detail-header__main container', () => {
            expect(src).toMatch(/class="detail-header__main"/);
        });

        it('puts the FavoriteButton in a sibling detail-header__favorite container', () => {
            expect(src).toMatch(/class="detail-header__favorite"/);
        });

        it('keeps the favorite right-aligned via margin-left: auto', () => {
            expect(src).toMatch(/\.detail-header__favorite\s*\{[^}]*margin-left:\s*auto/);
        });

        it('has CSS for detail-header__bookmark-count', () => {
            expect(src).toContain('.detail-header__bookmark-count');
        });
    });
});
