/**
 * @file ListingHeader.test.ts
 * @description Source-level tests of the shared listing header (HOS-2579 §6.3,
 * AC-8, AC-10, AC-11, AC-12). Migrated from `DetailHeader.test.ts` and
 * `VenueDetailHeader.open-now.test.ts` when the three vertical headers were
 * folded into `components/listing/header/`.
 *
 * Vitest cannot render `.astro` in this repo (see
 * `test/components/account/PartnerMentionsSection.test.ts`), so these read the
 * SOURCE. What each vertical passes in is decided by the pure builders and is
 * covered, executed, in `test/lib/listing-header/build-listing-header.test.ts`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../../src');
const read = (relative: string): string => readFileSync(resolve(SRC, relative), 'utf8');

const HEADER = read('components/listing/header/ListingHeader.astro');
const BADGES = read('components/listing/header/ListingHeaderBadges.astro');
const ACTIONS = read('components/listing/header/ListingHeaderActions.astro');
const LOCATION = read('components/listing/header/ListingLocationLine.astro');
/** Template only: after the frontmatter fence, before `<style>`. */
const markup = (src: string): string => (src.split('\n---\n')[1] ?? '').split('<style>')[0] ?? '';
const mobileStyles = (src: string): string =>
    src.match(/@media \(max-width: 767px\)[\s\S]*?(?=@media \(prefers|<\/style>)/)?.[0] ?? '';

const PAGES = {
    accommodation: read('pages/[lang]/alojamientos/[slug].astro'),
    venue: read('pages/[lang]/comer-y-salir/[slug].astro'),
    experience: read('pages/[lang]/experiencias/[slug].astro')
} as const;

describe('the three detail pages share one header (AC-8)', () => {
    it.each(Object.entries(PAGES))('%s imports ListingHeader and its builder', (_v, page) => {
        expect(page).toContain(
            "import ListingHeader from '@/components/listing/header/ListingHeader.astro';"
        );
        expect(page).toContain("from '@/lib/listing-header/build-listing-header'");
        expect(page).toContain('<ListingHeader {...headerProps} />');
    });

    it.each([
        'components/accommodation/DetailHeader.astro',
        'components/venue/VenueDetailHeader.astro',
        'components/experience/ExperienceHero.astro'
    ])('%s no longer exists', (relative) => {
        expect(existsSync(resolve(SRC, relative))).toBe(false);
    });
});

describe('ListingHeader frame', () => {
    it('wraps rating chips without breaking review or bookmark phrases', () => {
        expect(HEADER).toMatch(
            /\.listing-header__rating\s*\{[^}]*flex-wrap: wrap;[^}]*gap: var\(--space-2/
        );
        for (const chip of ['reviews-count', 'bookmark-count']) {
            expect(HEADER).toMatch(
                new RegExp(`\\.listing-header__${chip}\\s*\\{[^}]*white-space: nowrap;`)
            );
        }
        expect(mobileStyles(HEADER)).toMatch(
            /\.listing-header__bookmark-count--after-rating\s*\{[^}]*border-left: 0;/
        );
    });
    it('keeps every WaveHeader compact hook the old headers used (AC-12)', () => {
        const all = [HEADER, BADGES, LOCATION].map(markup).join('\n');
        for (const cls of [
            'wh-compact-hide',
            'wh-compact-row',
            'wh-compact-title',
            'wh-compact-demote',
            'wh-compact-hide-mobile'
        ]) {
            expect(all, cls).toContain(cls);
        }
        expect(markup(HEADER)).toMatch(/class="listing-header__back-row wh-compact-hide"/);
        expect(markup(HEADER)).toMatch(/<h1 class="listing-header__title wh-compact-title">/);
        expect(markup(LOCATION)).toContain('listing-header__location wh-compact-demote');
    });

    it('renders exactly one <h1>, the title', () => {
        expect(markup(HEADER).match(/<h1\b/g)).toHaveLength(1);
    });

    it('hides the back row only with the gallery opt-in, below 768px', () => {
        expect(HEADER).toContain("'listing-header--mobile-gallery': hasMobileGalleryControls");
        expect(mobileStyles(HEADER)).toMatch(
            /\.listing-header--mobile-gallery \.listing-header__back-row\s*\{\s*display: none/
        );
    });

    it('uses the h3 step for the mobile title and an ellipsised body line in compact', () => {
        expect(mobileStyles(HEADER)).toMatch(
            /\.listing-header--mobile-gallery \.listing-header__title\s*\{\s*font-size: var\(--text-h3/
        );
        expect(mobileStyles(HEADER)).toMatch(
            /:global\(\.wave-header--compact\) \.listing-header--mobile-gallery \.listing-header__title\s*\{[^}]*font-size: var\(--text-body, 1rem\);[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/
        );
        expect(mobileStyles(HEADER)).toMatch(
            /:global\(\.wave-header\.wave-header--compact \.wave-header__content:has\(\.listing-header--mobile-gallery\)\)\s*\{[^}]*padding-top: var\(--space-3, 12px\);/
        );
    });

    it('keeps the desktop action column and title before actions in the DOM', () => {
        expect(HEADER).toMatch(
            /\.listing-header__main\s*\{[^}]*display: grid;[^}]*grid-template-areas:\s*"badges actions"\s*"title actions"\s*"location actions"/
        );
        expect(markup(HEADER)).toMatch(
            /<\/h1>[\s\S]*?<ListingHeaderActions[\s\S]*?<ListingLocationLine/
        );
    });
});

describe('small-screen header layout (CARD-022)', () => {
    const smallScreenStyles =
        HEADER.match(/@media \(width < 640px\)[\s\S]*?(?=@media|<\/style>)/)?.[0] ?? '';

    it('gives the title a full-width row and actions their own row, including gallery headers', () => {
        expect(smallScreenStyles).toMatch(
            /\.listing-header__main,\s*:global\(\.wave-header\) \.listing-header--mobile-gallery \.listing-header__main\s*\{[^}]*grid-template-areas:\s*"badges"\s*"title"\s*"actions"\s*"location"\s*"meta"/
        );
        expect(smallScreenStyles).toContain('grid-template-columns: minmax(0, 1fr);');
    });

    it('keeps stars, score and review count together without shrinking the stars', () => {
        expect(smallScreenStyles).toMatch(
            /\.listing-header__rating\s*\{[^}]*flex-wrap: nowrap;[^}]*white-space: nowrap;/
        );
        expect(smallScreenStyles).toMatch(
            /\.listing-header__rating > :global\(\.rating-stars\)\s*\{[^}]*flex-shrink: 0;/
        );
        expect(smallScreenStyles).toMatch(
            /\.listing-header__reviews-count\s*\{[^}]*white-space: nowrap;/
        );
    });

    it('places bookmarks below the rating without a divider or clipping the second line', () => {
        expect(smallScreenStyles).toMatch(
            /\.listing-header__meta\s*\{[^}]*flex-direction: column;[^}]*align-items: flex-start;[^}]*max-height: none;/
        );
        expect(smallScreenStyles).toMatch(
            /\.listing-header__bookmark-count--after-rating\s*\{[^}]*border-left: 0;[^}]*padding-left: 0;[^}]*margin-left: 0;/
        );
    });
});

describe('rating and bookmark count (AC-10)', () => {
    it('renders the rating through RatingStars (sm, with value) plus the count', () => {
        expect(HEADER).toContain(
            "import RatingStars from '@/components/shared/ui/RatingStars.astro';"
        );
        expect(HEADER).toMatch(/<RatingStars rating=\{rating\.average\} size="sm" showValue \/>/);
        expect(HEADER).toContain("tPlural('review.list.totalReviews', rating.count");
    });

    it('renders no rating element without reviews', () => {
        expect(HEADER).toContain('const showsRating = rating !== null && rating.count > 0;');
        expect(HEADER).toMatch(/\{showsRating && rating && \(/);
    });

    it('draws no hand-made stars and no text heart', () => {
        expect(HEADER).not.toContain('StarIcon');
        expect(HEADER).not.toMatch(/♥|&#9829;/);
    });

    it('marks the bookmark count with a decorative FavoriteIcon and keeps the number as text', () => {
        const count =
            HEADER.match(/<span[\s\S]*?data-testid="bookmark-count"[\s\S]*?<\/span>/)?.[0] ?? '';
        expect(count).toMatch(/<FavoriteIcon[\s\S]*?aria-hidden="true"/);
        expect(count).toContain("tPlural('accommodations.detail.bookmark_count', bookmarkCount)");
        expect(HEADER).toMatch(/bookmarkCount\s*!==\s*undefined/);
    });
});

describe('actions (AC-11)', () => {
    it('shows a share button on every vertical (ShareButtons, icon-only)', () => {
        expect(ACTIONS).toContain(
            "import { ShareButtons } from '@/components/ShareButtons.client';"
        );
        const share = ACTIONS.match(/<ShareButtons[\s\S]*?\/>/)?.[0] ?? '';
        expect(share).toContain('client:visible');
        expect(share).toContain('url={share.url}');
        expect(share).toContain('campaign={share.campaign}');
        expect(share).toMatch(/appearance="icon(-overlay)?"/);
        // Not behind any vertical condition.
        expect(ACTIONS).not.toMatch(/\{vertical === [^}]*<ShareButtons/);
    });

    it('renders compare only when the builder passes it (accommodation only)', () => {
        expect(ACTIONS).toMatch(/\{compare && \(\s*<DetailCompareButton/);
        expect(ACTIONS).toContain('compare ? await readComparePlan()');
        expect(ACTIONS).toMatch(/<DetailCompareButton[^>]*\{\.\.\.comparePlan\}/);
    });

    it('mounts the shared FavoriteButton for the vertical entity type', () => {
        expect(ACTIONS).toMatch(
            /<FavoriteButton[\s\S]*?client:load[\s\S]*?entityType=\{FAVORITE_ENTITY_TYPES\[vertical\]\}/
        );
        expect(ACTIONS).toContain("accommodation: 'ACCOMMODATION'");
        expect(ACTIONS).toContain("venue: 'VENUE'");
        expect(ACTIONS).toContain("experience: 'EXPERIENCE'");
    });

    it('hides favorite and share below 768px when the gallery carries them, keeping compare', () => {
        expect(ACTIONS).toMatch(
            /:global\(\.listing-header--mobile-gallery\) \.listing-header__gallery-duplicate\s*\{\s*display: none/
        );
        const compare = ACTIONS.match(/<DetailCompareButton[\s\S]*?\/>/)?.[0] ?? '';
        expect(compare).not.toContain('gallery-duplicate');
    });
});

describe('badges', () => {
    it('puts every badge on the shared listing-header-badge contract', () => {
        expect(BADGES).toContain('class="listing-header__badges listing-header-badges');
        expect(BADGES).toContain('<span class="featured-badge listing-header-badge">');
        expect(BADGES).toContain(
            '<span class="featured-badge listing-header__verified-badge listing-header-badge">'
        );
        expect(BADGES).toContain(
            '<span class="listing-header__status-pill listing-header-badge" style={newStyle}>'
        );
        expect(BADGES).toMatch(
            /<AccommodationTypeBadge[\s\S]*?class="listing-header__type-badge listing-header-badge"/
        );
    });

    it('collapses the badge row in the mobile compact state', () => {
        expect(BADGES).toContain('listing-header-badges wh-compact-hide-mobile');
    });

    it('mounts the open-now island in a reserved, CLS-free slot (HOS-2257)', () => {
        expect(BADGES).toMatch(
            /<span class="listing-header__open-now" data-open-now-slot>\s*<VenueOpenNowBadge\s+client:idle\s+locale=\{locale\}\s+openingHours=\{badge\.openingHours\}\s+variant="inline"\s*\/>/
        );
        expect(BADGES).toMatch(
            /\.listing-header__open-now \{[^}]*min-height: var\(--listing-badge-height, 1\.75rem\);[^}]*min-width: 9\.5rem;/
        );
        expect(BADGES).not.toContain('computeOpenNowStatus');
    });
});

describe('location line (AC-9)', () => {
    it('links to the destination when there is an href, plain text with LocationIcon otherwise', () => {
        expect(LOCATION).toContain('<LocationIcon size={16} weight="fill" aria-hidden="true" />');
        expect(LOCATION).toMatch(/\{location\.href \? \(\s*<a href=\{location\.href\}/);
        expect(LOCATION).toContain(
            '<span class="listing-header__location-text">{location.name}</span>'
        );
    });
});
