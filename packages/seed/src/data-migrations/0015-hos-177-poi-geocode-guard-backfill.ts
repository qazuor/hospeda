/**
 * @fileoverview
 * Data migration: 0015-hos-177-poi-geocode-guard-backfill
 *
 * Dual-write counterpart for HOS-177. The baseline seed now nulls a subset of
 * auto-geocoded POI coordinates that fail the approved destination-radius /
 * town-centroid guards, and this migration applies the same cleaned geocode
 * fields to already-seeded environments so live DBs converge with the updated
 * fixtures.
 *
 * The migration reads the canonical POI fixtures directly from
 * `src/data/pointOfInterest/*.json` (all 12 legacy + 908 catalog rows) and only
 * updates a row when one of the synchronized geocode/provenance fields differs.
 */
import type { PointOfInterest } from '@repo/schemas';
import requiredManifest from '../manifest-required.json';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0015-hos-177-poi-geocode-guard-backfill',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

interface PointOfInterestGeocodeFixture {
    readonly slug: string;
    readonly lat?: number | null;
    readonly long?: number | null;
    readonly verified?: boolean;
    readonly verifiedAt?: string | null;
    readonly source?: string | null;
    readonly notes?: string | null;
}

interface GeocodeSyncCounts {
    poisUpdated: number;
    poisSkipped: number;
    poisNotFound: number;
}

interface ExistingPointOfInterestGeocodeRow {
    readonly id: string;
    readonly lat?: number | null;
    readonly long?: number | null;
    readonly verified?: boolean;
    readonly verifiedAt?: string | null;
    readonly source?: string | null;
    readonly notes?: string | null;
}

/** Minimal model contract needed for the POI geocode-field backfill. */
export interface PointOfInterestGeocodeSyncModel {
    findOne(
        where: { readonly slug: string },
        db: SeedMigrationCtx['db']
    ): Promise<ExistingPointOfInterestGeocodeRow | null>;
    update(
        where: { readonly id: string },
        data: Partial<PointOfInterest>,
        db: SeedMigrationCtx['db']
    ): Promise<unknown>;
}

function toNullableNumber(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toNullableString(value: string | null | undefined): string | null {
    return typeof value === 'string' ? value : null;
}

function toNullableDate(value: string | Date | null | undefined): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value !== 'string') {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildGeocodePatch(params: {
    readonly existing: ExistingPointOfInterestGeocodeRow;
    readonly fixture: PointOfInterestGeocodeFixture;
}): Partial<PointOfInterest> | null {
    const { existing, fixture } = params;
    const next = {
        lat: toNullableNumber(fixture.lat),
        long: toNullableNumber(fixture.long),
        verified: fixture.verified === true,
        verifiedAt: toNullableDate(fixture.verifiedAt),
        source: toNullableString(fixture.source),
        notes: toNullableString(fixture.notes)
    } as const;

    const unchanged =
        toNullableNumber(existing.lat) === next.lat &&
        toNullableNumber(existing.long) === next.long &&
        existing.verified === next.verified &&
        toNullableDate(existing.verifiedAt)?.toISOString() === next.verifiedAt?.toISOString() &&
        toNullableString(existing.source) === next.source &&
        toNullableString(existing.notes) === next.notes;

    return unchanged ? null : next;
}

/**
 * Synchronizes POI geocode/provenance fields from fixture data onto existing DB
 * rows, keyed by `slug`.
 */
export async function syncPointOfInterestGeocodeFixtures(params: {
    readonly fixtures: readonly PointOfInterestGeocodeFixture[];
    readonly poiModel: PointOfInterestGeocodeSyncModel;
    readonly db: SeedMigrationCtx['db'];
}): Promise<GeocodeSyncCounts> {
    const { fixtures, poiModel, db } = params;
    const counts: GeocodeSyncCounts = {
        poisUpdated: 0,
        poisSkipped: 0,
        poisNotFound: 0
    };

    for (const fixture of fixtures) {
        const existing = await poiModel.findOne({ slug: fixture.slug }, db);
        if (!existing) {
            counts.poisNotFound += 1;
            continue;
        }

        const patch = buildGeocodePatch({ existing, fixture });
        if (patch === null) {
            counts.poisSkipped += 1;
            continue;
        }

        await poiModel.update({ id: existing.id }, patch, db);
        counts.poisUpdated += 1;
    }

    return counts;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const poiModel = new ctx.models.PointOfInterestModel() as PointOfInterestGeocodeSyncModel;
    const fixtures = await loadJsonFiles<PointOfInterestGeocodeFixture>('pointOfInterest', [
        ...requiredManifest.pointsOfInterest,
        ...requiredManifest.pointOfInterestCatalog
    ]);
    const counts = await syncPointOfInterestGeocodeFixtures({
        fixtures,
        poiModel,
        db: ctx.db
    });

    return {
        summary: `HOS-177 POI geocode cleanup backfill: ${counts.poisUpdated} POIs updated (${counts.poisSkipped} already matched fixtures, ${counts.poisNotFound} not found).`,
        counts: { ...counts }
    };
}
