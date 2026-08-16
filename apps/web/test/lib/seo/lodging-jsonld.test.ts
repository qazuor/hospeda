/**
 * @fileoverview
 * Regression tests for the two derived `LodgingBusiness` JSON-LD fields.
 *
 * Both defects came out of the August 2026 production smoke and share a failure
 * mode: structured data is machine-facing, so a missing field and a field
 * holding the wrong string both render as *nothing visible*. Neither raises an
 * error, neither breaks a page, and neither is caught by a test that only checks
 * the component was mounted.
 *
 * - HOS-554 (H-113): `geo` was never emitted, on ANY accommodation.
 * - HOS-557 (H-114): `amenityFeature[].name` published raw catalog slugs
 *   (`air_conditioning`, `full_kitchen`) — machine ids, in English, on a
 *   Spanish site.
 */

import { describe, expect, it } from 'vitest';
import { translateAmenityName } from '../../../src/lib/catalog-names';
import { buildLodgingAmenityNames, buildLodgingGeo } from '../../../src/lib/seo/lodging-jsonld';

/**
 * A translator with the same contract as `createTranslations().t`: it returns
 * `[MISSING:<key>]` for an unknown key, which is the signal
 * `translateAmenityName` uses to fall back to a humanized slug.
 */
function makeTranslate(dictionary: Readonly<Record<string, string>>) {
    return (key: string, fallback?: string): string => {
        const hit = dictionary[key];
        if (hit !== undefined) return hit;
        return fallback ?? `[MISSING:${key}]`;
    };
}

const ES_AMENITIES = makeTranslate({
    'accommodations.amenityNames.wifi': 'WiFi',
    'accommodations.amenityNames.air_conditioning': 'Aire acondicionado',
    'accommodations.amenityNames.full_kitchen': 'Cocina completa',
    'accommodations.amenityNames.smart_tv': 'Smart TV'
});

describe('buildLodgingGeo — HOS-554 (H-113)', () => {
    it('emits geo from the obfuscated approximateLocation', () => {
        // Arrange — the exact shape the public API returns (measured in prod).
        const approximateLocation = {
            lat: -32.488110772530206,
            lng: -58.35920248924995,
            radiusMeters: 150
        };

        // Act
        const geo = buildLodgingGeo({ approximateLocation });

        // Assert
        expect(geo).toEqual({
            latitude: -32.488110772530206,
            longitude: -58.35920248924995
        });
    });

    it('does NOT read the exact pin — approximateLocation is the only source', () => {
        // Arrange — a payload carrying the exact coordinate under the canonical
        // `location.coordinates.{lat,long}` path AND no approximateLocation. On a
        // public page SPEC-097 strips `coordinates`, so this combination should
        // never occur; if it ever does, publishing the exact pin is precisely the
        // leak SPEC-097 exists to prevent, so the builder must still emit nothing.
        const payload = {
            location: { coordinates: { lat: '-32.4864074', long: '-58.3603116' } },
            approximateLocation: undefined
        } as { approximateLocation?: undefined };

        // Act
        const geo = buildLodgingGeo({ approximateLocation: payload.approximateLocation });

        // Assert
        expect(geo).toBeUndefined();
    });

    it('returns undefined when the accommodation has no coordinates at all', () => {
        expect(buildLodgingGeo({ approximateLocation: undefined })).toBeUndefined();
    });

    it.each([
        ['NaN latitude', { lat: Number.NaN, lng: -58.3, radiusMeters: 150 }],
        ['NaN longitude', { lat: -32.4, lng: Number.NaN, radiusMeters: 150 }],
        ['infinite latitude', { lat: Number.POSITIVE_INFINITY, lng: -58.3, radiusMeters: 150 }]
    ])('returns undefined rather than publishing a broken coordinate (%s)', (_case, approx) => {
        // A non-finite number serializes to `null` in JSON, which would emit a
        // structurally invalid GeoCoordinates node.
        expect(buildLodgingGeo({ approximateLocation: approx })).toBeUndefined();
    });
});

describe('buildLodgingAmenityNames — HOS-557 (H-114)', () => {
    it('publishes the localized label, never the catalog slug', () => {
        // Arrange — `name` carries the SLUG since SPEC-266 dropped the catalog's
        // `name` column. These are the exact slugs production was publishing.
        const amenities = [
            { name: 'wifi' },
            { name: 'air_conditioning' },
            { name: 'full_kitchen' },
            { name: 'smart_tv' }
        ];

        // Act
        const names = buildLodgingAmenityNames({
            amenities,
            translateAmenityName,
            t: ES_AMENITIES
        });

        // Assert — the localized labels...
        expect(names).toEqual(['WiFi', 'Aire acondicionado', 'Cocina completa', 'Smart TV']);
        // ...and none of the raw machine ids survives into the published value.
        for (const slug of ['air_conditioning', 'full_kitchen', 'smart_tv']) {
            expect(names).not.toContain(slug);
        }
    });

    it('falls back to a humanized slug instead of dropping an untranslated amenity', () => {
        // Arrange — a catalog slug with no i18n entry yet.
        const amenities = [{ name: 'wifi' }, { name: 'private_dock' }];

        // Act
        const names = buildLodgingAmenityNames({
            amenities,
            translateAmenityName,
            t: ES_AMENITIES
        });

        // Assert — still two entries, and the fallback is at least readable.
        expect(names).toEqual(['WiFi', 'Private Dock']);
    });

    it('never emits the raw underscore form of any slug it received', () => {
        // A general guard: whatever the dictionary knows, no published name may
        // still look like a machine id.
        const amenities = [
            { name: 'air_conditioning' },
            { name: 'full_kitchen' },
            { name: 'bed_linens' },
            { name: 'refrigerator_freezer' }
        ];

        const names =
            buildLodgingAmenityNames({ amenities, translateAmenityName, t: ES_AMENITIES }) ?? [];

        expect(names).toHaveLength(4);
        for (const name of names) {
            expect(name).not.toContain('_');
        }
    });

    it('returns undefined for an accommodation with no amenities', () => {
        // The JSON-LD component omits `amenityFeature` entirely on undefined.
        expect(
            buildLodgingAmenityNames({ amenities: [], translateAmenityName, t: ES_AMENITIES })
        ).toBeUndefined();
    });

    it('resolves through the page locale, so an English page gets English labels', () => {
        const enTranslate = makeTranslate({
            'accommodations.amenityNames.air_conditioning': 'Air conditioning'
        });

        const names = buildLodgingAmenityNames({
            amenities: [{ name: 'air_conditioning' }],
            translateAmenityName,
            t: enTranslate
        });

        expect(names).toEqual(['Air conditioning']);
    });
});
