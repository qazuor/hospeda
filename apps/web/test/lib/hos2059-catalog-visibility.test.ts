/**
 * @file hos2059-catalog-visibility.test.ts
 * @description HOS-2059 owner acceptance criteria on the public accommodation
 * detail, after the catalog curation (data-migration 0147):
 *
 * 1. An item reclassified from amenity to feature (Vista al río, Vista
 *    panorámica, Acceso al río) keeps rendering: it now arrives as a FEATURE
 *    relation, and the detail must still show it, with a real label, under its
 *    category heading.
 * 2. A merged duplicate shows its absorbed attribute: a listing that had
 *    "Cocina compartida" now links "Cocina" with `scope = shared`, and the
 *    detail must show the "Compartido" badge (likewise "Parrilla privada" ->
 *    "Parrilla" with `scope = private`).
 *
 * Vitest cannot render `.astro` here, so this drives the two functions the
 * grids call with what the API returns for a migrated listing: the detail
 * transform (`toAccommodationDetailPageProps`), then the grouping
 * (`groupFeaturesForDisplay`) and badge (`resolveAmenityAttributeBadges`)
 * helpers, with the real translator. The last block pins that the detail page
 * still mounts both grids and that the grids still call those helpers.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toAccommodationDetailPageProps } from '../../src/lib/api/transforms';
import {
    groupFeaturesForDisplay,
    resolveAmenityAttributeBadges
} from '../../src/lib/catalog-attribute-badges';
import { createTranslations, type SupportedLocale } from '../../src/lib/i18n';

const LOCALES: readonly SupportedLocale[] = ['es', 'en', 'pt'];

/** A public detail payload for a listing whose catalog rows were migrated by 0147. */
const migratedListing = (): Record<string, unknown> => ({
    id: 'acc-2059',
    slug: 'casa-del-rio',
    name: 'Casa del Río',
    summary: 'Resumen',
    description: 'Descripción',
    type: 'HOUSE',
    createdAt: '2026-11-06T00:00:00.000Z',
    owner: { id: 'owner-1', name: 'Owner', createdAt: '2026-01-01T00:00:00.000Z' },
    features: [
        { featureId: 'f-1', slug: 'river_view', icon: 'RiverViewIcon', category: 'VIEW' },
        {
            featureId: 'f-2',
            feature: { slug: 'panoramic_view_extended', category: 'VIEW' },
            icon: 'PanoramicViewIcon'
        },
        { featureId: 'f-3', slug: 'river_access', icon: 'RiverBeachIcon', category: 'ACCESS' }
    ],
    amenities: [
        { amenityId: 'a-1', slug: 'full_kitchen', icon: 'KitchenIcon', scope: 'shared' },
        { amenityId: 'a-2', slug: 'bbq_grill', icon: 'BbqGrillIcon', scope: 'private' },
        { amenityId: 'a-3', slug: 'wifi', icon: 'WifiIcon' }
    ]
});

describe('HOS-2059: an item moved from amenity to feature still renders', () => {
    it.each(LOCALES)('reaches the features grid with a real %s label', (locale) => {
        // Arrange
        const { t } = createTranslations(locale);

        // Act
        const detail = toAccommodationDetailPageProps({ item: migratedListing(), locale });
        const names = detail.features.map((feature) => feature.name);

        // Assert
        expect(names).toEqual(
            expect.arrayContaining(['river_view', 'panoramic_view_extended', 'river_access'])
        );
        for (const slug of ['river_view', 'panoramic_view_extended', 'river_access']) {
            const label = t(`accommodations.featureNames.${slug}`);
            expect(label, `${locale} ${slug}`).not.toMatch(/MISSING/);
            expect(label.trim().length).toBeGreaterThan(0);
        }
    });

    it('is grouped under the Vistas and Acceso headings', () => {
        // Arrange
        const { t } = createTranslations('es');
        const detail = toAccommodationDetailPageProps({ item: migratedListing(), locale: 'es' });

        // Act
        const groups = groupFeaturesForDisplay({ features: detail.features, t });

        // Assert
        const byKey = new Map((groups ?? []).map((group) => [group.key, group]));
        expect(byKey.get('VIEW')?.label).toBe('Vistas');
        expect(byKey.get('VIEW')?.items.map((item) => item.name)).toEqual(
            expect.arrayContaining(['river_view', 'panoramic_view_extended'])
        );
        expect(byKey.get('ACCESS')?.items.map((item) => item.name)).toEqual(['river_access']);
    });
});

describe('HOS-2059: a merged duplicate shows its absorbed attribute', () => {
    it.each(LOCALES)('the shared kitchen shows the shared badge in %s', (locale) => {
        // Arrange
        const { t } = createTranslations(locale);
        const detail = toAccommodationDetailPageProps({ item: migratedListing(), locale });
        const kitchen = detail.amenities.find((amenity) => amenity.name === 'full_kitchen');

        // Act
        const badges = resolveAmenityAttributeBadges({
            scope: kitchen?.scope,
            availability: kitchen?.availability,
            t
        });

        // Assert
        expect(kitchen?.scope).toBe('shared');
        expect(badges).toEqual([t('accommodations.amenityAttributes.scope.shared')]);
        expect(badges[0]).not.toMatch(/MISSING/);
    });

    it('the private grill shows the private badge, and an undeclared amenity shows none', () => {
        // Arrange
        const { t } = createTranslations('es');
        const detail = toAccommodationDetailPageProps({ item: migratedListing(), locale: 'es' });
        const badgesOf = (slug: string) => {
            const amenity = detail.amenities.find((item) => item.name === slug);
            return resolveAmenityAttributeBadges({
                scope: amenity?.scope,
                availability: amenity?.availability,
                t
            });
        };

        // Act + Assert
        expect(badgesOf('bbq_grill')).toEqual(['Privado']);
        expect(badgesOf('wifi')).toEqual([]);
    });
});

describe('HOS-2059: the detail page still wires both grids to those helpers', () => {
    const read = (relativePath: string): string =>
        readFileSync(resolve(__dirname, '../../src', relativePath), 'utf8');

    it('mounts the features and amenities grids with the listing relations', () => {
        const page = read('pages/[lang]/alojamientos/[slug].astro');
        expect(page).toMatch(/<FeaturesGrid\s+features=\{accommodation\.features\}/);
        expect(page).toMatch(/<AmenitiesGrid\s+amenities=\{accommodation\.amenities\}/);
    });

    it('the grids render the grouping and the badges', () => {
        expect(read('components/accommodation/FeaturesGrid.astro')).toContain(
            'groupFeaturesForDisplay({ features, t })'
        );
        expect(read('components/accommodation/AmenitiesGrid.astro')).toMatch(
            /resolveAmenityAttributeBadges\(\{\s*scope: amenity\.scope/
        );
    });
});
