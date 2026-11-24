/**
 * @file ListingPill.details.source.test.ts
 * @description Owner smoke (HOS-2520): an amenity or feature that carries per-listing
 * details must show them, in the summarized pills AND in the «Ver las N» sheet.
 *
 * What the data model carries per item:
 * - amenity relation (`r_accommodation_amenity`): `isOptional` («Con cargo extra»),
 *   `additionalCost`, `scope` (private/shared) and `availability` (year-round/seasonal);
 * - feature relation (`r_accommodation_feature`): `hostReWriteName` (label override) and
 *   `comments` (free text from the host).
 *
 * `.astro` cannot be rendered in Vitest here (see apps/web/CLAUDE.md, Testing), so the
 * wiring is pinned on the source; the badge resolution itself is exercised for real.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAmenityAttributeBadges } from '@/lib/catalog-attribute-badges';
import { createTranslations } from '@/lib/i18n';

const read = (relative: string): string =>
    readFileSync(resolve(__dirname, '../../../src', relative), 'utf8');

const PILL = read('components/listing/ListingPill.astro');
const AMENITIES = read('components/accommodation/AmenitiesGrid.astro');
const FEATURES = read('components/accommodation/FeaturesGrid.astro');
const pillMarkup = PILL.split('<style>')[0] ?? '';

describe('ListingPill renders the per-item details inline', () => {
    it('renders the host comment as secondary text under the name, not as a tooltip', () => {
        expect(pillMarkup).toContain(
            '{comments && <span class="listing-pill__comments">{comments}</span>}'
        );
        expect(pillMarkup).not.toMatch(/\btitle=/);
        expect(PILL).toMatch(
            /\.listing-pill__comments\s*\{[^}]*color: var\(--core-muted-foreground\)/
        );
    });

    it('renders the additional-cost note and one chip per attribute badge', () => {
        expect(pillMarkup).toContain(
            '{costLabel && <span class="listing-pill__cost">{costLabel}</span>}'
        );
        expect(pillMarkup).toContain(
            '{badges.map((badge) => <span class="listing-pill__badge">{badge}</span>)}'
        );
    });
});

describe('the grids feed those details to every pill', () => {
    it('amenities pass the cost label and the declared scope/availability/extra-charge badges', () => {
        expect(AMENITIES).toContain(
            'costLabel: amenity.additionalCost != null ? additionalCostLabel : null'
        );
        expect(AMENITIES).toMatch(
            /badges: resolveAmenityAttributeBadges\(\{\s*scope: amenity\.scope,\s*availability: amenity\.availability,\s*extraCharge: amenity\.isOptional,/
        );
    });

    it('the amenities sheet renders the same entries (with their details) as the pills', () => {
        const sheet = AMENITIES.match(/<ListingItemsSheet[\s\S]*?<\/ListingItemsSheet>/)?.[0] ?? '';
        expect(sheet).toContain('{entries.map((entry) => <ListingPill {...entry} />)}');
    });

    it('features pass the host label override and the host comment, in the grid and the sheet', () => {
        expect(FEATURES).toContain(
            'label: feature.hostReWriteName ?? translateFeature(feature.name)'
        );
        expect(FEATURES).toContain('comments: feature.comments ?? null');
        const sheet = FEATURES.match(/<ListingItemsSheet[\s\S]*?<\/ListingItemsSheet>/)?.[0] ?? '';
        expect(sheet).toContain('<ListingPill {...toPill(feature)} />');
    });
});

describe('resolveAmenityAttributeBadges (what a detailed amenity pill shows)', () => {
    const { t } = createTranslations('es');

    it('shows nothing for an amenity that declares nothing', () => {
        expect(
            resolveAmenityAttributeBadges({
                scope: null,
                availability: null,
                extraCharge: false,
                t
            })
        ).toEqual([]);
    });

    it('shows one badge per declared value', () => {
        const badges = resolveAmenityAttributeBadges({
            scope: 'shared',
            availability: 'seasonal',
            extraCharge: true,
            t
        });

        expect(badges).toHaveLength(3);
        for (const badge of badges) {
            expect(badge.trim().length).toBeGreaterThan(0);
            expect(badge).not.toMatch(/^accommodations\./);
        }
    });
});
