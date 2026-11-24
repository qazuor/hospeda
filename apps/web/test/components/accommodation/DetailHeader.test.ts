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
import { createTranslations } from '@/lib/i18n';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/DetailHeader.astro'),
    'utf8'
);

describe('accommodation mobile title block (AC-1.19)', () => {
    const page = readFileSync(
        resolve(__dirname, '../../../src/pages/[lang]/alojamientos/[slug].astro'),
        'utf8'
    );
    const mobileStyles = src.match(/@media \(max-width: 767px\)[\s\S]*?(?=@media|<\/style>)/)?.[0];
    const badges = src.match(/<div\s+class="detail-header__badges[^"]*"[^>]*>/)?.[0];

    it('hides the visual breadcrumb wrapper without moving the structured breadcrumbs', () => {
        expect(page).toMatch(
            /@media \(max-width: 767px\)\s*\{\s*:global\(\.wave-header__breadcrumbs:has\(\.acc-detail-breadcrumbs\)\)\s*\{\s*display: none/
        );
        expect(page).toContain('<div slot="breadcrumbs" class="acc-detail-breadcrumbs">');
        expect(page).toContain('<BreadcrumbJsonLd slot="head-extra" items={breadcrumbItems} />');
    });

    it('hides duplicate back and favorite controls only with the gallery opt-in', () => {
        expect(src).toContain('hasMobileGalleryControls = false');
        expect(src).toContain("'detail-header--mobile-gallery': hasMobileGalleryControls");
        expect(page).toMatch(/<DetailHeader\b[^>]*\bhasMobileGalleryControls\b[^>]*\/>/);
        expect(mobileStyles).toMatch(
            /\.detail-header--mobile-gallery \.detail-header__back-row,\s*\.detail-header--mobile-gallery \.detail-header__favorite-only\s*\{\s*display: none/
        );
    });

    it('gives the badges one horizontally scrollable line (size from the shared contract)', () => {
        expect(mobileStyles).toMatch(
            /\.detail-header__badges\s*\{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/
        );
    });

    it('shares one mobile title and Compare row between expanded and sticky compact states', () => {
        expect(mobileStyles).toMatch(
            /:global\(\.wave-header\) \.detail-header--mobile-gallery \.detail-header__body\s*\{[^}]*\bdisplay: grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;[^}]*grid-template-areas:\s*"badges badges"\s*"title compare"\s*"destination destination"/
        );
        expect(mobileStyles).toMatch(
            /:global\(\.wave-header\) \.detail-header--mobile-gallery \.detail-header__main\s*\{[^}]*\bdisplay: contents;/
        );
        expect(src).toMatch(/\.detail-header__name\s*\{\s*grid-area: title;/);
        expect(src).toMatch(/\.detail-header__favorite\s*\{\s*grid-area: compare;/);
        expect(mobileStyles).toMatch(
            /:global\(\.detail-header__compare-btn\)\s*\{[^}]*width: 32px;[^}]*height: 32px;/
        );
    });

    it('gives the badges scroller an accessible name and visible focus ring', () => {
        expect.soft(badges).toContain('role="group"');
        expect.soft(badges).toContain("aria-label={t('accommodations.detail.badges.scrollLabel')}");
        expect(src).toMatch(
            /\.detail-header__badges:focus-visible\s*\{[^}]*outline: 2px solid var\(--brand-primary\);/
        );
    });

    it('only puts badges in the tab sequence on mobile, including after client navigation', () => {
        const page = document.implementation.createHTMLDocument();
        const breakpoint = Object.assign(new EventTarget(), { matches: false });
        // Slice the component's own inline script out of its source. This reads a
        // trusted repo file, not untrusted HTML, so plain index lookups suffice.
        const scriptOpen = '<script>';
        const scriptStart = src.indexOf(scriptOpen);
        const scriptEnd = src.indexOf('</script>', scriptStart);
        const script =
            scriptStart >= 0 && scriptEnd > scriptStart
                ? src.slice(scriptStart + scriptOpen.length, scriptEnd)
                : '';
        const badgeMarkup = `${badges ?? ''}</div>`;
        const tabIndex = () =>
            page.querySelector('.detail-header__badges')?.getAttribute('tabindex');
        page.body.innerHTML = badgeMarkup;

        expect.soft(tabIndex()).toBe('-1');
        new Function('document', 'window', script)(page, {
            matchMedia: (query: string) => {
                expect(query).toBe('(max-width: 767px)');
                return breakpoint;
            }
        });
        expect.soft(tabIndex()).toBe('-1');

        breakpoint.matches = true;
        breakpoint.dispatchEvent(new Event('change'));
        expect.soft(tabIndex()).toBe('0');

        page.body.innerHTML = badgeMarkup;
        page.dispatchEvent(new Event('astro:page-load'));
        expect.soft(tabIndex()).toBe('0');

        breakpoint.matches = false;
        breakpoint.dispatchEvent(new Event('change'));
        expect(tabIndex()).toBe('-1');
    });

    it('makes the mobile compact state clearly smaller than the expanded one (owner smoke, HOS-2520)', () => {
        // The badges row collapses in compact below 768px, through the WaveHeader contract
        // that also makes it inert.
        expect(badges).toContain('wh-compact-hide-mobile');
        // The title drops to body size on one ellipsised line.
        expect(mobileStyles).toMatch(
            /:global\(\.wave-header--compact\) \.detail-header--mobile-gallery \.detail-header__name\s*\{[^}]*font-size: var\(--text-body, 1rem\);[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/
        );
        // And the band itself tightens its padding.
        expect(mobileStyles).toMatch(
            /:global\(\.wave-header\.wave-header--compact \.wave-header__content:has\(\.detail-header--mobile-gallery\)\)\s*\{[^}]*padding-top: var\(--space-3, 12px\);[^}]*padding-bottom: var\(--space-3, 12px\);/
        );
    });

    it.each([
        ['es', 'Distintivos del alojamiento'],
        ['en', 'Accommodation badges'],
        ['pt', 'Selos da hospedagem']
    ] as const)('localizes the badges scroller name in %s', (locale, expected) => {
        const { t } = createTranslations(locale);

        expect(t('accommodations.detail.badges.scrollLabel')).toBe(expected);
    });

    it('renders a single compare control between the title and destination in tab order', () => {
        const markup = src.split('<style>')[0] ?? '';

        expect(markup.match(/<DetailCompareButton\b/g)).toHaveLength(1);
        expect(markup).toMatch(
            /<\/h1>[\s\S]*?<DetailCompareButton\b[\s\S]*?class="detail-header__destination /
        );
    });
});

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
            expect(src).toMatch(
                /<AccommodationTypeBadge[\s\S]*?class="detail-header__type-badge listing-header-badge"/
            );
        });

        it('renders status pills as inline spans sized to match the type badge', () => {
            // HOS-84 appended the shared `wh-compact-badge` utility class, so the
            // element carries additional classes after the base name.
            expect(src).toMatch(/<span[^>]*class="[^"]*\bdetail-header__status-pill\b/);
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

        it('leaves the type badge compact shrink to the shared contract (no !important)', () => {
            // HOS-2520: components.css `.listing-header-badge` sets --acc-type-* for
            // every vertical; the header no longer carries its own override.
            expect(src).not.toMatch(/--acc-type-font-size/);
            expect(src).not.toMatch(/!important/);
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
        it('no longer declares isAuthenticated prop (removed HOS-369 WB0-5)', () => {
            expect(src).not.toContain('isAuthenticated');
        });

        it('declares accommodationId prop', () => {
            expect(src).toContain('accommodationId');
        });

        it('no longer declares initialIsFavorited prop (removed HOS-369 WB0-5)', () => {
            expect(src).not.toContain('initialIsFavorited');
        });

        it('no longer declares initialBookmarkId prop (removed HOS-369 WB0-5)', () => {
            expect(src).not.toContain('initialBookmarkId');
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

        it('does NOT pass isAuthenticated to FavoriteButton — resolves client-side (HOS-369 WB0-5)', () => {
            expect(src).not.toMatch(/<FavoriteButton[\s\S]*?isAuthenticated=/);
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
            // HOS-84 appended the shared `wh-compact-row` utility class, so the
            // container carries additional classes after the base name.
            expect(src).toMatch(/class="[^"]*\bdetail-header__main\b/);
        });

        it('keeps the action cluster in the right column of the desktop grid', () => {
            expect(src).toMatch(
                /\.detail-header__main\s*\{[^}]*display: grid;[^}]*grid-template-areas:\s*"badges compare"\s*"title compare"\s*"destination compare"/
            );
            expect(src).toMatch(/\.detail-header__favorite\s*\{[^}]*align-self: start;/);
        });

        it('reserves a top-right action column in compact mode starting at 768px', () => {
            const desktopStyles = src.match(
                /@media \(min-width: 768px\)[\s\S]*?(?=@media|<\/style>)/
            )?.[0];
            const compactMain = desktopStyles?.match(
                /:global\(\.wave-header\.wave-header--compact\) \.detail-header__main\s*\{([^}]*)\}/
            )?.[1];
            const compactActions = desktopStyles?.match(
                /:global\(\.wave-header--compact\) \.detail-header__favorite\s*\{([^}]*)\}/
            )?.[1];

            expect(compactMain).toMatch(/display: grid;/);
            expect(compactMain).toMatch(/grid-template-columns:[^;]+ auto;/);
            expect(compactMain).toMatch(
                /grid-template-areas:\s*"badges title destination \. compare"/
            );
            expect(compactActions).toContain('align-self: start;');
            expect(desktopStyles).toMatch(
                /\.detail-header__name,\s*:global\(\.wave-header--compact\) \.detail-header__destination\s*\{[^}]*overflow-wrap: anywhere;/
            );
        });

        it('keeps the favorite right-aligned via margin-left: auto', () => {
            expect(src).toMatch(/\.detail-header__favorite\s*\{[^}]*margin-left:\s*auto/);
        });

        it('has CSS for detail-header__bookmark-count', () => {
            expect(src).toContain('.detail-header__bookmark-count');
        });
    });
});

describe('DetailHeader.astro — HOS-85 T-010: DetailCompareButton island', () => {
    describe('imports', () => {
        it('imports DetailCompareButton from components/accommodation', () => {
            expect(src).toContain("from '@/components/accommodation/DetailCompareButton.client'");
        });
    });

    describe('DetailCompareButton island', () => {
        it('renders DetailCompareButton with client:load', () => {
            expect(src).toMatch(/<DetailCompareButton[\s\S]*?client:load/);
        });

        it('passes accommodationId from the accommodationId prop', () => {
            expect(src).toMatch(/<DetailCompareButton[\s\S]*?accommodationId=\{accommodationId\}/);
        });

        it('passes accommodationName from accommodation.name', () => {
            expect(src).toMatch(
                /<DetailCompareButton[\s\S]*?accommodationName=\{accommodation\.name\}/
            );
        });

        it('passes accommodationThumbnailUrl from accommodation.featuredImage', () => {
            expect(src).toMatch(
                /<DetailCompareButton[\s\S]*?accommodationThumbnailUrl=\{accommodation\.featuredImage\}/
            );
        });

        it('is placed inside the shared right-aligned detail-header__favorite container, before FavoriteButton', () => {
            expect(src).toMatch(
                /detail-header__favorite[\s\S]*?<DetailCompareButton[\s\S]*?<FavoriteButton/
            );
        });
    });
});

describe('accommodation mobile header spacing regressions (F1)', () => {
    const page = readFileSync(
        resolve(__dirname, '../../../src/pages/[lang]/alojamientos/[slug].astro'),
        'utf8'
    );
    const mobileStyles = src.match(/@media \(max-width: 767px\)[\s\S]*?(?=@media|<\/style>)/)?.[0];

    it('gives the content band top padding when the breadcrumbs are hidden (expanded only)', () => {
        expect(page).toMatch(
            /:global\(\.wave-header:not\(\.wave-header--compact\) \.wave-header__bar:has\(\.acc-detail-breadcrumbs\) \.wave-header__content\)\s*\{\s*padding-top: var\(--space-6/
        );
    });

    it('removes the page-background strip above the full-bleed gallery on this page only', () => {
        expect(page).toMatch(
            /:global\(\.wave-header \.detail-page:has\(\.acc-detail\)\)\s*\{\s*padding-top: 0;/
        );
    });

    it('shrinks the mobile title and aligns Compare to its first line', () => {
        expect(mobileStyles).toMatch(
            /\.detail-header--mobile-gallery \.detail-header__name\s*\{\s*font-size: var\(--text-h3/
        );
        expect(mobileStyles).toMatch(
            /\.detail-header--mobile-gallery \.detail-header__favorite\s*\{\s*align-self: start;/
        );
    });
});

describe('header badges share one height (owner smoke, HOS-2520)', () => {
    it('puts every badge on the shared listing-header-badge contract', () => {
        expect(src).toContain('class="detail-header__badges listing-header-badges');
        expect(src).toContain('class="detail-header__type-badge listing-header-badge"');
        expect(src).toContain('<span class="featured-badge listing-header-badge">');
        expect(src).toContain(
            '<span class="featured-badge detail-header__verified-badge listing-header-badge">'
        );
        expect(src).toContain(
            '<span class="detail-header__status-pill listing-header-badge" style={newStyle}>'
        );
    });

    it('keeps no local badge sizing that could drift from the other verticals', () => {
        expect(src).not.toMatch(
            /--detail-header-badge-height|--acc-type-font-size|--acc-type-padding/
        );
    });
});
