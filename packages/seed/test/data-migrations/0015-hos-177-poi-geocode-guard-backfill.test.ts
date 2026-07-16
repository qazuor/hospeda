import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    type PointOfInterestGeocodeSyncModel,
    syncPointOfInterestGeocodeFixtures
} from '../../src/data-migrations/0015-hos-177-poi-geocode-guard-backfill.js';

interface PoiRow {
    id: string;
    slug: string;
    lat: number | null;
    long: number | null;
    verified: boolean;
    verifiedAt: string | null;
    source: string | null;
    notes: string | null;
}

function loadFixture(fileName: string) {
    return JSON.parse(
        readFileSync(resolve(__dirname, `../../src/data/pointOfInterest/${fileName}`), 'utf8')
    ) as {
        slug: string;
        lat: number | null;
        long: number | null;
        verified: boolean;
        verifiedAt: string | null;
        source: string | null;
        notes: string | null;
    };
}

function buildPoiModel(store: Map<string, PoiRow>): PointOfInterestGeocodeSyncModel {
    return {
        async findOne(where) {
            return store.get(where.slug) ?? null;
        },
        async update(where, data) {
            const row = [...store.values()].find((item) => item.id === where.id);
            if (!row) {
                return null;
            }
            Object.assign(row, data);
            return row;
        }
    };
}

describe('0015-hos-177-poi-geocode-guard-backfill', () => {
    it('updates a legacy wrong geocode to the cleaned fixture fields and skips rows already in sync', async () => {
        const cleaned = loadFixture('173-point-of-interest-centro_cultural_linares_cardozo.json');
        const unchanged = loadFixture('153-point-of-interest-casino_colon.json');
        const store = new Map<string, PoiRow>([
            [
                cleaned.slug,
                {
                    id: `poi-${cleaned.slug}`,
                    slug: cleaned.slug,
                    lat: -31.999,
                    long: -59.999,
                    verified: false,
                    verifiedAt: null,
                    source: cleaned.source,
                    notes: 'Institución y domicilio confirmados por la Municipalidad. Falta geocodificar. Coordinates auto-geocoded from address on 2026-07-13 via google-places; pending human cartographic verification.'
                }
            ],
            [unchanged.slug, { id: `poi-${unchanged.slug}`, ...unchanged }]
        ]);

        const counts = await syncPointOfInterestGeocodeFixtures({
            fixtures: [cleaned, unchanged],
            poiModel: buildPoiModel(store),
            db: {}
        });

        expect(counts).toEqual({
            poisUpdated: 1,
            poisSkipped: 1,
            poisNotFound: 0
        });
        expect(store.get(cleaned.slug)).toMatchObject({
            lat: cleaned.lat,
            long: cleaned.long,
            verified: cleaned.verified,
            verifiedAt: cleaned.verifiedAt,
            source: cleaned.source,
            notes: cleaned.notes
        });
    });

    it('is idempotent once the DB row already matches the fixture', async () => {
        const cleaned = loadFixture('173-point-of-interest-centro_cultural_linares_cardozo.json');
        const store = new Map<string, PoiRow>([
            [cleaned.slug, { id: `poi-${cleaned.slug}`, ...cleaned }]
        ]);

        const counts = await syncPointOfInterestGeocodeFixtures({
            fixtures: [cleaned],
            poiModel: buildPoiModel(store),
            db: {}
        });

        expect(counts).toEqual({
            poisUpdated: 0,
            poisSkipped: 1,
            poisNotFound: 0
        });
    });

    it('counts missing rows without attempting an update', async () => {
        const cleaned = loadFixture('173-point-of-interest-centro_cultural_linares_cardozo.json');

        const counts = await syncPointOfInterestGeocodeFixtures({
            fixtures: [cleaned],
            poiModel: buildPoiModel(new Map()),
            db: {}
        });

        expect(counts).toEqual({
            poisUpdated: 0,
            poisSkipped: 0,
            poisNotFound: 1
        });
    });
});
