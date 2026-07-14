/**
 * HOS-141 T-016 — Pipeline report (report.md + report.json, G-6).
 *
 * A machine- and human-readable summary of a pipeline run: totals, geocoding
 * stats by confidence tier (with the unresolved slugs listed), category-map
 * coverage, slug collisions resolved, destination fixups applied, and relation
 * counts. The geocode totals are internally consistent (AC-8).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Geocoding outcome counts for the rows that needed geocoding. */
export interface GeocodeStats {
    /** Rows that already carried coordinates in the CSV (no geocoding needed). */
    readonly alreadyHadCoords: number;
    /** Coordinate-less rows resolved at high confidence. */
    readonly resolvedHigh: number;
    /** Coordinate-less rows resolved at medium confidence. */
    readonly resolvedMedium: number;
    /** Of the resolved rows, how many came from the Google Places fallback. */
    readonly resolvedByFallback: number;
    /** Coordinate-less rows whose only match was rejected as low confidence. */
    readonly rejectedLowConfidence: number;
    /** Coordinate-less rows the provider could not match at all. */
    readonly unresolved: number;
    /** Slugs of the rows left without coordinates (rejected + unresolved). */
    readonly unresolvedSlugs: readonly string[];
}

/** The full set of stats collected during a pipeline run. */
export interface PipelineStats {
    readonly totalRows: number;
    readonly totalFixtures: number;
    readonly geocode: GeocodeStats;
    readonly categoryCoverageUsed: number;
    readonly categoryCoverageTotal: number;
    readonly slugCollisionsResolved: number;
    readonly destinationFixupsApplied: number;
    readonly relationsPrimary: number;
    readonly relationsNearby: number;
    readonly unresolvedNearby: readonly string[];
}

/**
 * The number of coordinate-less rows that needed geocoding, per the stats.
 *
 * @param g - The geocode stats.
 * @returns `resolvedHigh + resolvedMedium + rejectedLowConfidence + unresolved`.
 */
export function geocodeAttempts(g: GeocodeStats): number {
    return g.resolvedHigh + g.resolvedMedium + g.rejectedLowConfidence + g.unresolved;
}

/**
 * The fraction of coordinate-less rows resolved at high/medium confidence
 * (0..1). Returns 1 when there were no rows to geocode.
 *
 * @param g - The geocode stats.
 * @returns The high/medium resolution rate.
 */
export function geocodeSuccessRate(g: GeocodeStats): number {
    const attempts = geocodeAttempts(g);
    return attempts === 0 ? 1 : (g.resolvedHigh + g.resolvedMedium) / attempts;
}

/**
 * Builds the machine (JSON) + human (Markdown) report strings from run stats.
 *
 * @param stats - The collected pipeline stats.
 * @returns `{ json, markdown }` report bodies.
 */
export function buildReport(stats: PipelineStats): { json: string; markdown: string } {
    const { geocode: g } = stats;
    const rate = geocodeSuccessRate(g);
    const ratePct = (rate * 100).toFixed(1);

    const json = `${JSON.stringify(stats, null, 4)}\n`;

    const markdown = `# POI data pipeline report

## Totals
- Input rows: **${stats.totalRows}**
- Output fixtures: **${stats.totalFixtures}**
- Destination fixups applied: **${stats.destinationFixupsApplied}**
- Slug collisions resolved: **${stats.slugCollisionsResolved}**
- Category coverage: **${stats.categoryCoverageUsed}/${stats.categoryCoverageTotal}**

## Geocoding
- Already had coordinates: **${g.alreadyHadCoords}**
- Resolved (high): **${g.resolvedHigh}**
- Resolved (medium): **${g.resolvedMedium}**
- ...of which via Google Places fallback: **${g.resolvedByFallback}**
- Rejected (low confidence): **${g.rejectedLowConfidence}**
- Unresolved: **${g.unresolved}**
- High/medium resolution rate: **${ratePct}%** of ${geocodeAttempts(g)} attempted

### Rows left without coordinates (${g.unresolvedSlugs.length})
${g.unresolvedSlugs.length === 0 ? '_none_' : g.unresolvedSlugs.map((s) => `- ${s}`).join('\n')}

## Relations
- PRIMARY: **${stats.relationsPrimary}**
- NEARBY: **${stats.relationsNearby}**
- Unresolved nearby references (${stats.unresolvedNearby.length}): ${
        stats.unresolvedNearby.length === 0
            ? '_none_'
            : `\n${stats.unresolvedNearby.map((s) => `- ${s}`).join('\n')}`
    }
`;

    return { json, markdown };
}

/**
 * Writes `report.md` + `report.json` into the output directory.
 *
 * @param params.stats - The collected pipeline stats.
 * @param params.outputDir - The staged output directory.
 * @param params.writeFileFn - Injectable writer (defaults to node fs).
 */
export function writeReport(params: {
    readonly stats: PipelineStats;
    readonly outputDir: string;
    readonly writeFileFn?: (filePath: string, contents: string) => void;
}): void {
    const { stats, outputDir } = params;
    const writeFileFn =
        params.writeFileFn ?? ((filePath, contents) => writeFileSync(filePath, contents));
    const { json, markdown } = buildReport(stats);
    writeFileFn(join(outputDir, 'report.json'), json);
    writeFileFn(join(outputDir, 'report.md'), markdown);
}
