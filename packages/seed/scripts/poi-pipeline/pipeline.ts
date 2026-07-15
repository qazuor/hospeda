/**
 * HOS-141 — Pipeline orchestrator.
 *
 * Ties every stage together: reconcile destinations -> compute slugs ->
 * normalize categories -> geocode the coordinate-less rows (through the
 * injected geocoder) -> tier -> build fixtures + relations -> collect stats.
 * The geocoder is injected so tests drive it with a mock (no network) and the
 * real run wraps a cached Nominatim geocoder.
 */

import { loadRealCategorySlugs, normalizeCategories } from './categories.js';
import { resolveConfidence } from './confidence.js';
import { AUTO_GEOCODE_MARKER, GEOCODE_BATCH_DATE, REGIONAL_QUALIFIER } from './constants.js';
import { computeSlugs, countCollidingSlugs } from './dedup.js';
import { buildPoiFixture, type PoiFixture } from './emit.js';
import { applyDestinationGuards, isGenericDestinationAddress } from './geocode-guards.js';
import type { Geocoder } from './geocoder.js';
import {
    loadRealDestinationSlugs,
    loadRealDestinations,
    type RealDestinationRecord,
    reconcileRows
} from './reconcile.js';
import { buildRelations, type DestinationRelationRow } from './relations.js';
import type { PipelineStats } from './report.js';
import type { RawCsvRow } from './types.js';

/** The full result of a pipeline run: emit artifacts + stats. */
export interface PipelineResult {
    readonly fixtures: readonly PoiFixture[];
    readonly relations: readonly DestinationRelationRow[];
    readonly stats: PipelineStats;
}

/** Accent-insensitive text normalization for query construction. */
function normalize(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function joinUniqueQueryParts(parts: readonly string[]): string {
    const joined: string[] = [];
    let current = '';

    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length === 0) {
            continue;
        }
        const normalizedPart = normalize(trimmed);
        if (current.includes(normalizedPart)) {
            continue;
        }
        joined.push(trimmed);
        current = normalize(joined.join(', '));
    }

    return joined.join(', ');
}

function stripAutoGeocodeMarker(notes: string | null): string | null {
    if (notes === null) {
        return null;
    }
    const stripped = notes
        .replace(
            /\s*Coordinates auto-geocoded from address on \d{4}-\d{2}-\d{2} via [a-z-]+; pending human cartographic verification\./i,
            ''
        )
        .trim();
    return stripped.length > 0 ? stripped : null;
}

function nullDuplicateAutoGeocodes(params: {
    readonly fixtures: readonly PoiFixture[];
}): PoiFixture[] {
    const { fixtures } = params;
    const duplicateKeys = new Set<string>();
    const autoGeocodedByKey = new Map<string, PoiFixture[]>();

    for (const fixture of fixtures) {
        if (
            fixture.lat == null ||
            fixture.long == null ||
            fixture.verified ||
            !fixture.notes?.includes(AUTO_GEOCODE_MARKER)
        ) {
            continue;
        }
        const key = `${fixture.lat},${fixture.long}`;
        const bucket = autoGeocodedByKey.get(key) ?? [];
        bucket.push(fixture);
        autoGeocodedByKey.set(key, bucket);
        if (bucket.length > 1) {
            duplicateKeys.add(key);
        }
    }

    return fixtures.map((fixture) => {
        if (
            fixture.lat == null ||
            fixture.long == null ||
            fixture.verified ||
            !fixture.notes?.includes(AUTO_GEOCODE_MARKER)
        ) {
            return fixture;
        }
        const key = `${fixture.lat},${fixture.long}`;
        if (!duplicateKeys.has(key)) {
            return fixture;
        }
        return {
            ...fixture,
            lat: null,
            long: null,
            notes: stripAutoGeocodeMarker(fixture.notes)
        };
    });
}

function buildFallbackQuery(params: { readonly row: RawCsvRow }): string {
    const { row } = params;
    const isDestinationOnlyAddress = isGenericDestinationAddress({
        rowAddress: row.address,
        destinationNames: [row.destinationName]
    });

    return isDestinationOnlyAddress
        ? joinUniqueQueryParts([row.name, row.address, 'Entre Rios', 'Argentina'])
        : joinUniqueQueryParts([row.address, row.destinationName, 'Entre Rios', 'Argentina']);
}

async function resolveGuardedHit(params: {
    readonly geocoder: Geocoder;
    readonly query: string;
    readonly row: RawCsvRow;
    readonly destination: RealDestinationRecord;
}): Promise<ReturnType<typeof applyDestinationGuards>> {
    const { geocoder, query, row, destination } = params;
    const hit = await geocoder.resolve(query);
    return applyDestinationGuards({
        hit,
        context: {
            destinationNames: [destination.name, row.destinationName],
            destinationCenter: destination.center,
            rowAddress: row.address
        }
    });
}

/**
 * Runs the transformation pipeline over already-loaded rows.
 *
 * @param params.rows - The parsed CSV rows.
 * @param params.geocoder - The geocoder for coordinate-less rows (cached
 *   Nominatim in the real run, a mock in tests).
 * @param params.realDestinationSlugs - Real seeded destination slugs (defaults
 *   to the on-disk fixtures).
 * @param params.realDestinations - Real seeded destination catalog (defaults to
 *   the on-disk fixtures). Used by the destination-aware geocode guards.
 * @param params.realCategorySlugs - Real seeded category slugs (defaults to the
 *   on-disk fixtures).
 * @param params.geocodeIsoDate - Pinned marker date (defaults to
 *   {@link GEOCODE_BATCH_DATE}).
 * @returns The fixtures, relations, and run stats.
 */
export async function runPipeline(params: {
    readonly rows: readonly RawCsvRow[];
    readonly geocoder: Geocoder;
    /**
     * Optional second-tier geocoder (Google Places) tried with an address-first
     * query (or name+address when the row only names the town), ONLY for rows
     * the primary geocoder leaves unresolved. Absent = primary-only (no paid
     * calls).
     */
    readonly fallbackGeocoder?: Geocoder;
    readonly realDestinationSlugs?: ReadonlySet<string>;
    readonly realDestinations?: ReadonlyMap<string, RealDestinationRecord>;
    readonly realCategorySlugs?: ReadonlySet<string>;
    readonly geocodeIsoDate?: string;
}): Promise<PipelineResult> {
    const {
        rows,
        geocoder,
        fallbackGeocoder,
        realDestinations = loadRealDestinations(),
        realDestinationSlugs = loadRealDestinationSlugs(),
        realCategorySlugs = loadRealCategorySlugs(),
        geocodeIsoDate = GEOCODE_BATCH_DATE
    } = params;

    const reconciled = reconcileRows({ rows, realSlugs: realDestinationSlugs });
    const slugged = computeSlugs({ rows: reconciled });

    const usedCategories = new Set<string>();
    const fixtures: PoiFixture[] = [];

    let alreadyHadCoords = 0;
    let resolvedHigh = 0;
    let resolvedMedium = 0;
    let resolvedByFallback = 0;
    let rejectedLowConfidence = 0;
    let unresolved = 0;
    const unresolvedSlugs: string[] = [];

    for (const s of slugged) {
        const categories = normalizeCategories({
            raw: s.row.categorySlugs,
            realSlugs: realCategorySlugs,
            rowId: s.row.id
        });
        for (const c of categories) {
            usedCategories.add(c.slug);
        }

        const hadCoords = s.row.lat.trim() !== '' && s.row.lng.trim() !== '';
        let geocoded = null;
        if (hadCoords) {
            alreadyHadCoords += 1;
        } else {
            const destination = realDestinations.get(s.destinationSlug);
            if (destination === undefined) {
                throw new Error(
                    `Destination '${s.destinationSlug}' is missing from the real destination catalog.`
                );
            }

            // Primary tier: Nominatim, address-based query.
            const primaryQuery = `${s.row.address.trim()}${REGIONAL_QUALIFIER}`;
            const primaryGuarded = await resolveGuardedHit({
                geocoder,
                query: primaryQuery,
                row: s.row,
                destination
            });
            let outcome = resolveConfidence(primaryGuarded.hit);
            let fromFallback = false;

            // Second tier: Google Places, address-first when the row carries a
            // usable address. Only tried when the primary left it unresolved,
            // including destination-guard rejections.
            if (outcome.result === null && fallbackGeocoder !== undefined) {
                const fallbackQuery = buildFallbackQuery({ row: s.row });
                const fallbackGuarded = await resolveGuardedHit({
                    geocoder: fallbackGeocoder,
                    query: fallbackQuery,
                    row: s.row,
                    destination
                });
                const fbOutcome = resolveConfidence(fallbackGuarded.hit);
                if (fbOutcome.result !== null) {
                    outcome = fbOutcome;
                    fromFallback = true;
                }
            }

            geocoded = outcome.result;
            if (outcome.tier === 'high') {
                resolvedHigh += 1;
            } else if (outcome.tier === 'medium') {
                resolvedMedium += 1;
            } else if (outcome.tier === 'low') {
                rejectedLowConfidence += 1;
                unresolvedSlugs.push(s.slug);
            } else {
                unresolved += 1;
                unresolvedSlugs.push(s.slug);
            }
            if (fromFallback) {
                resolvedByFallback += 1;
            }
        }

        fixtures.push(
            buildPoiFixture({ row: s.row, slug: s.slug, categories, geocoded, geocodeIsoDate })
        );
    }

    const cleanedFixtures = nullDuplicateAutoGeocodes({ fixtures });

    const { relations, unresolvedNearby } = buildRelations({
        rows: slugged,
        realSlugs: realDestinationSlugs
    });

    const destinationFixupsApplied = new Set(
        reconciled
            .filter((r) => r.destinationSlug !== r.row.destinationSlug)
            .map((r) => r.row.destinationSlug)
    ).size;

    const stats: PipelineStats = {
        totalRows: rows.length,
        totalFixtures: cleanedFixtures.length,
        geocode: {
            alreadyHadCoords,
            resolvedHigh,
            resolvedMedium,
            resolvedByFallback,
            rejectedLowConfidence,
            unresolved,
            unresolvedSlugs
        },
        categoryCoverageUsed: usedCategories.size,
        categoryCoverageTotal: realCategorySlugs.size,
        slugCollisionsResolved: countCollidingSlugs({ rows: reconciled }),
        destinationFixupsApplied,
        relationsPrimary: relations.filter((r) => r.relation === 'PRIMARY').length,
        relationsNearby: relations.filter((r) => r.relation === 'NEARBY').length,
        unresolvedNearby
    };

    return { fixtures: cleanedFixtures, relations, stats };
}
