/**
 * HOS-141 T-013 — destination-relations.json emit.
 *
 * Every POI has a PRIMARY relation to its (reconciled) destination. Rows that
 * carry `nearbyDestinationSlugs` additionally produce NEARBY relations to each
 * listed destination, resolved through the SAME destination reconciliation as
 * the PRIMARY relation (so `pueblo-liebig` etc. are fixed up consistently). A
 * nearby slug that does not resolve to a real destination is skipped and
 * collected in the result (nearby data is softer than the primary destination —
 * a bad nearby reference should not abort the whole run).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SluggedRow } from './dedup.js';
import { splitSemicolon } from './loader.js';
import { reconcileDestinationSlug } from './reconcile.js';

/** A single destination<->POI relation row. */
export interface DestinationRelationRow {
    readonly destinationSlug: string;
    readonly poiSlug: string;
    readonly relation: 'PRIMARY' | 'NEARBY';
}

/** The relations emit result: the rows plus any unresolved nearby references. */
export interface RelationsResult {
    readonly relations: readonly DestinationRelationRow[];
    readonly unresolvedNearby: readonly string[];
}

/**
 * Builds all destination<->POI relations: one PRIMARY per POI plus NEARBY rows
 * derived from `nearbyDestinationSlugs`.
 *
 * @param params.rows - The slugged (and reconciled) rows.
 * @param params.realSlugs - The set of real seeded destination slugs (for
 *   reconciling nearby references).
 * @returns The relation rows plus any unresolved nearby references.
 */
export function buildRelations(params: {
    readonly rows: readonly SluggedRow[];
    readonly realSlugs: ReadonlySet<string>;
}): RelationsResult {
    const { rows, realSlugs } = params;
    const relations: DestinationRelationRow[] = [];
    const unresolvedNearby: string[] = [];

    for (const row of rows) {
        relations.push({
            destinationSlug: row.destinationSlug,
            poiSlug: row.slug,
            relation: 'PRIMARY'
        });

        for (const rawNearby of splitSemicolon(row.row.nearbyDestinationSlugs)) {
            const nearby = reconcileDestinationSlug({ slug: rawNearby, realSlugs });
            if (nearby === null) {
                unresolvedNearby.push(`${row.slug} -> '${rawNearby}'`);
                continue;
            }
            // A POI's PRIMARY destination should not also appear as NEARBY.
            if (nearby === row.destinationSlug) {
                continue;
            }
            relations.push({ destinationSlug: nearby, poiSlug: row.slug, relation: 'NEARBY' });
        }
    }

    return { relations, unresolvedNearby };
}

/**
 * Writes `destination-relations.json` into the output directory (deterministic:
 * relations are sorted so re-runs diff cleanly).
 *
 * @param params.relations - The relation rows.
 * @param params.outputDir - The staged output directory.
 * @param params.writeFileFn - Injectable writer (defaults to node fs).
 */
export function writeRelations(params: {
    readonly relations: readonly DestinationRelationRow[];
    readonly outputDir: string;
    readonly writeFileFn?: (filePath: string, contents: string) => void;
}): void {
    const { relations, outputDir } = params;
    const writeFileFn =
        params.writeFileFn ?? ((filePath, contents) => writeFileSync(filePath, contents));
    const sorted = [...relations].sort(
        (a, b) =>
            a.poiSlug.localeCompare(b.poiSlug) ||
            a.relation.localeCompare(b.relation) ||
            a.destinationSlug.localeCompare(b.destinationSlug)
    );
    writeFileFn(
        join(outputDir, 'destination-relations.json'),
        `${JSON.stringify(sorted, null, 2)}\n`
    );
}
