/**
 * @fileoverview
 * Shared loader for HOS-141's raw destination-POI relations pipeline output
 * (`scripts/poi-pipeline/output/destination-relations.json`).
 *
 * Deliberately NOT under `src/data/` — this is pipeline scratch output, not a
 * curated fixture — so it is read directly via `fs`, not `loadJsonFiles.ts`
 * (which only resolves paths anchored under this package's `src/data/`).
 *
 * Shared by TWO consumers that must never drift from each other (HOS-142
 * §6.3 point 3 / OQ resolution):
 *   - `pointOfInterestCatalog/pointOfInterestCatalogRelations.ts` — wires
 *     these relations on a FRESH DB, as part of the `--poi-catalog` seed
 *     group.
 *   - `data-migrations/0013-hos-142-poi-catalog-expansion.ts` — the
 *     dual-write counterpart backfilling the same relations onto an
 *     already-seeded staging/prod DB.
 *
 * @module utils/loadDestinationRelations
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PointOfInterestDestinationRelationEnum } from '@repo/schemas';

// ESM equivalent of __dirname, anchored to this file's own location so the
// pipeline-output path resolves independently of `process.cwd()` (same
// technique `loadJsonFile.ts` uses for `src/data/`).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Absolute path to HOS-141's raw pipeline output listing every
 * destination↔POI relation (`{ destinationSlug, poiSlug, relation }`).
 */
const DESTINATION_RELATIONS_PATH = path.resolve(
    __dirname,
    '../../scripts/poi-pipeline/output/destination-relations.json'
);

/**
 * Shape of a single row in `destination-relations.json`.
 */
export interface RawDestinationRelation {
    readonly destinationSlug: string;
    readonly poiSlug: string;
    readonly relation: PointOfInterestDestinationRelationEnum;
}

/**
 * Reads and parses HOS-141's destination-relations pipeline output.
 *
 * @returns Every `{ destinationSlug, poiSlug, relation }` row the pipeline
 * produced (1560 rows at HOS-142 authoring time: 914 `PRIMARY` + 646
 * `NEARBY`, covering all 908 catalog POIs plus 6 of the original 12
 * HOS-113 POIs).
 *
 * @example
 * ```ts
 * const relations = await loadDestinationRelations();
 * // [{ destinationSlug: 'chajari', poiSlug: 'acceso_oficina_turismo', relation: 'PRIMARY' }, ...]
 * ```
 */
export async function loadDestinationRelations(): Promise<RawDestinationRelation[]> {
    const raw = await readFile(DESTINATION_RELATIONS_PATH, 'utf-8');
    return JSON.parse(raw) as RawDestinationRelation[];
}
