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
import { GEOCODE_BATCH_DATE, REGIONAL_QUALIFIER } from './constants.js';
import { computeSlugs, countCollidingSlugs } from './dedup.js';
import { buildPoiFixture, type PoiFixture } from './emit.js';
import type { Geocoder } from './geocoder.js';
import { loadRealDestinationSlugs, reconcileRows } from './reconcile.js';
import { buildRelations, type DestinationRelationRow } from './relations.js';
import type { PipelineStats } from './report.js';
import type { RawCsvRow } from './types.js';

/** The full result of a pipeline run: emit artifacts + stats. */
export interface PipelineResult {
    readonly fixtures: readonly PoiFixture[];
    readonly relations: readonly DestinationRelationRow[];
    readonly stats: PipelineStats;
}

/**
 * Runs the transformation pipeline over already-loaded rows.
 *
 * @param params.rows - The parsed CSV rows.
 * @param params.geocoder - The geocoder for coordinate-less rows (cached
 *   Nominatim in the real run, a mock in tests).
 * @param params.realDestinationSlugs - Real seeded destination slugs (defaults
 *   to the on-disk fixtures).
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
     * Optional second-tier geocoder (Google Places) tried, with a name-based
     * query, ONLY for rows the primary geocoder leaves unresolved. Absent =
     * primary-only (no paid calls).
     */
    readonly fallbackGeocoder?: Geocoder;
    readonly realDestinationSlugs?: ReadonlySet<string>;
    readonly realCategorySlugs?: ReadonlySet<string>;
    readonly geocodeIsoDate?: string;
}): Promise<PipelineResult> {
    const {
        rows,
        geocoder,
        fallbackGeocoder,
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
            // Primary tier: Nominatim, address-based query.
            const primaryQuery = `${s.row.address.trim()}${REGIONAL_QUALIFIER}`;
            let outcome = resolveConfidence(await geocoder.resolve(primaryQuery));
            let fromFallback = false;

            // Second tier: Google Places, name-based query — only when the
            // primary left it unresolved (keeps paid calls to the minimum).
            if (outcome.result === null && fallbackGeocoder !== undefined) {
                const fallbackQuery = `${s.row.name.trim()}, ${s.row.destinationName.trim()}, Entre Ríos, Argentina`;
                const fbOutcome = resolveConfidence(await fallbackGeocoder.resolve(fallbackQuery));
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
        totalFixtures: fixtures.length,
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

    return { fixtures, relations, stats };
}
