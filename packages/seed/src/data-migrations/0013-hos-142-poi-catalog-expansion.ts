/**
 * @fileoverview
 * Data migration: 0013-hos-142-poi-catalog-expansion
 *
 * Dual-write counterpart (HOS-25) for HOS-142 Phase 2: backfills the 908-row
 * POI catalog expansion (`src/data/pointOfInterest/013-*.json` through
 * `926-*.json`) — plus its destination relations and category assignments —
 * onto an already-seeded staging/prod DB, which predates the whole catalog
 * entirely (it only ever received the original 12 HOS-113 rows via
 * `0009-hos-113-points-of-interest.ts`).
 *
 * A fresh DB gets the 908 POIs and their category assignments directly from
 * the dedicated `--poi-catalog` seed group (`pointOfInterestCatalog/index.ts`
 * — `seedPointOfInterestCatalog` + `seedPointOfInterestCatalogCategories`),
 * but that group deliberately does NOT seed destination relations (HOS-142
 * spec §6.3 point 3 — a new relation-sourcing mechanism,
 * `scripts/poi-pipeline/output/destination-relations.json`, that no seed-time
 * step reads yet). This migration is therefore the ONLY place — fresh or
 * live — that writes `r_destination_point_of_interest` rows for the 908
 * catalog POIs. See this migration's own JSDoc note below on the `db:fresh`/
 * `db:fresh-dev` baseline-stamp interaction this implies.
 *
 * Three steps, mirroring `0009-hos-113-points-of-interest.ts`'s shape:
 *
 * 1. **POIs** — reads the 908 catalog fixture files via `loadJsonFiles`,
 *    reuses `normalizePointOfInterestSeedItem` unchanged, resolves/creates by
 *    `slug` (insert-if-missing).
 * 2. **Destination relations** — reads
 *    `scripts/poi-pipeline/output/destination-relations.json` (NOT a
 *    `src/data/**` fixture — HOS-141's raw pipeline output, read directly
 *    from disk since `loadJsonFiles` only resolves paths under
 *    `src/data/`), resolves destination + POI by `slug`, inserts a
 *    `(destinationId, pointOfInterestId, relation)` row when the PAIR
 *    doesn't exist yet.
 * 3. **Categories** — reads each of the same 908 fixtures' own
 *    `categories: [{ slug, isPrimary }]` array (HOS-139), resolves category
 *    by `slug`, inserts a `(pointOfInterestId, categoryId)` row when missing.
 *
 * ## Idempotency
 *
 * - POIs: idempotent by unique `slug` (same as 0009).
 * - Category assignments: idempotent by `(pointOfInterestId, categoryId)`
 *   (same as 0012).
 * - Destination relations: **idempotent by the PAIR**
 *   `(destinationId, pointOfInterestId)` — NOT the triple including
 *   `relation`. The table's actual composite PRIMARY KEY is
 *   `(destinationId, pointOfInterestId)` (`relation` is a plain column with a
 *   default, HOS-140 — it was never moved into the PK), so at most one row
 *   can ever exist per pair regardless of `relation`. Checking the pair
 *   catches an existing row before attempting an INSERT that would otherwise
 *   violate the PK:
 *     - No existing row → INSERT with the pipeline's `relation` value
 *       (`relationsCreated`).
 *     - Existing row, SAME `relation` → true no-op, re-running is safe
 *       (`relationsSkipped`).
 *     - Existing row, DIFFERENT `relation` → **never** attempted as an
 *       INSERT (would violate the PK) and never overwritten (`destructive:
 *       false` — this migration only ever adds rows, never updates existing
 *       ones); counted separately as `relationsConflicting` so the one real,
 *       discovered case (see below) stays visible instead of silently
 *       vanishing into `relationsSkipped`.
 *
 *   **Known conflict (verified against the real fixture data at authoring
 *   time)**: `0009` gave `(colon, parque_nacional_el_palmar)` an implicit
 *   `PRIMARY` relation (Colón's `pointOfInterestIds` array, pre-HOS-140,
 *   before the `relation` column existed). HOS-141's cleaned dataset
 *   reassigns that POI's PRIMARY destination to `ubajay` and lists `colon`
 *   as only `NEARBY`. This migration deliberately does NOT overwrite the
 *   existing `(colon, parque_nacional_el_palmar)` row to `NEARBY` — that
 *   would be a destructive update outside this migration's additive scope —
 *   so it surfaces as exactly one `relationsConflicting` count instead of
 *   crashing on a PK violation or silently disagreeing with the new data.
 *   Reconciling it (if desired) is a follow-up decision, not this
 *   migration's job.
 *
 * - Both destinations and POIs are resolved by `slug`, never a hardcoded
 *   UUID (same rationale as 0009: POIs have no deterministic-id option, and
 *   ids differ across environments regardless).
 *
 * ## Fixture list: manifest reference, not a hardcoded array
 *
 * Unlike `0009`/`0011`/`0012` (which hardcode their small fixed fixture
 * lists inline, specifically so a LATER manifest growth can never silently
 * widen an already-shipped migration's scope), this migration reads
 * `requiredManifest.pointOfInterestCatalog` (908 entries) directly —
 * hand-transcribing 908 filenames would blow past this repo's 500-line-per-
 * file convention and risks a transcription error a copy-paste from the
 * manifest cannot make. The same "frozen scope" guarantee still holds in
 * practice: once this migration's `up()` runs once, the `seed_migrations`
 * ledger marks it applied and the runner never re-invokes it again — a
 * FUTURE PR that adds MORE POIs to this same manifest key must ship its own
 * new-numbered migration for that delta (mirroring the 0009/0011/0012
 * precedent), not rely on this file re-running.
 *
 * ## `destructive` flag decision
 *
 * `false` — every operation is an INSERT-if-missing (POIs, then relations,
 * then category assignments). The one known pre-existing-row case (see
 * above) is explicitly SKIPPED rather than overwritten, keeping this
 * migration structurally addition-only.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PointOfInterest, PointOfInterestDestinationRelationEnum } from '@repo/schemas';
import requiredManifest from '../manifest-required.json';
import { normalizePointOfInterestSeedItem } from '../required/pointsOfInterest.seed.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0013-hos-142-poi-catalog-expansion',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

// ESM equivalent of __dirname, anchored to this file's own location so the
// pipeline-output path resolves independently of `process.cwd()` (same
// technique `utils/loadJsonFile.ts` uses for `src/data/`).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Absolute path to HOS-141's raw pipeline output listing every
 * destination↔POI relation (`{ destinationSlug, poiSlug, relation }`).
 * Deliberately NOT under `src/data/` — this is pipeline scratch output, not
 * a curated fixture — so it is read directly via `fs`, not `loadJsonFiles`
 * (which only resolves paths anchored under this package's `src/data/`).
 */
const DESTINATION_RELATIONS_PATH = path.resolve(
    __dirname,
    '../../scripts/poi-pipeline/output/destination-relations.json'
);

/**
 * Shape of a single row in `destination-relations.json`.
 */
interface RawDestinationRelation {
    readonly destinationSlug: string;
    readonly poiSlug: string;
    readonly relation: PointOfInterestDestinationRelationEnum;
}

/**
 * Shape of a single category assignment on a raw POI catalog fixture
 * (HOS-139's `categories: [{ slug, isPrimary }]` array).
 */
interface RawCategoryAssignment {
    readonly slug: string;
    readonly isPrimary: boolean;
}

/**
 * Shape of a raw POI catalog fixture item, as loaded from
 * `src/data/pointOfInterest/*.json`, before normalization.
 */
interface RawPointOfInterestCatalogFixture {
    readonly id: string;
    readonly slug: string;
    readonly categories?: readonly RawCategoryAssignment[];
    readonly [key: string]: unknown;
}

/**
 * Reads and parses HOS-141's destination-relations pipeline output. Kept as
 * a tiny standalone loader (rather than reusing `loadJsonFiles`) since this
 * file lives outside `src/data/` — see {@link DESTINATION_RELATIONS_PATH}.
 */
async function loadDestinationRelations(): Promise<RawDestinationRelation[]> {
    const raw = await readFile(DESTINATION_RELATIONS_PATH, 'utf-8');
    return JSON.parse(raw) as RawDestinationRelation[];
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const poiModel = new ctx.models.PointOfInterestModel();
    const destinationModel = new ctx.models.DestinationModel();
    const relationModel = new ctx.models.RDestinationPointOfInterestModel();
    const categoryModel = new ctx.models.PoiCategoryModel();
    const poiCategoryRelationModel = new ctx.models.RPoiCategoryModel();

    const counts: Record<string, number> = {
        poisCreated: 0,
        poisSkipped: 0,
        relationsCreated: 0,
        relationsSkipped: 0,
        relationsConflicting: 0,
        destinationsNotFound: 0,
        relationPoisNotFound: 0,
        categoryAssignmentsCreated: 0,
        categoryAssignmentsSkipped: 0,
        categoryPoisNotFound: 0,
        categoriesNotFoundForAssignment: 0
    };

    // ── 1. POIs (idempotent by slug) ────────────────────────────────────────
    const rawPois = await loadJsonFiles<RawPointOfInterestCatalogFixture>('pointOfInterest', [
        ...requiredManifest.pointOfInterestCatalog
    ]);

    // Maps each catalog POI's `slug` to its DB id (whether pre-existing or
    // just created), reused by both the relations and categories steps below
    // so neither has to re-query for a POI this same run already resolved.
    const poiIdBySlug = new Map<string, string>();

    for (const rawPoi of rawPois) {
        const existing = await poiModel.findOne({ slug: rawPoi.slug }, ctx.db);
        if (existing) {
            poiIdBySlug.set(rawPoi.slug, existing.id);
            counts.poisSkipped = (counts.poisSkipped ?? 0) + 1;
            continue;
        }

        const normalized = normalizePointOfInterestSeedItem(rawPoi);
        const created = await poiModel.create(normalized as Partial<PointOfInterest>, ctx.db);
        poiIdBySlug.set(rawPoi.slug, created.id);
        counts.poisCreated = (counts.poisCreated ?? 0) + 1;
    }

    // ── 2. Destination ↔ POI relations (idempotent by the pair, see JSDoc) ──
    const rawRelations = await loadDestinationRelations();

    /** Per-destination created/skipped/not-found breakdown (R-2 mitigation). */
    const destinationBreakdown = new Map<
        string,
        { created: number; skipped: number; notFound: number }
    >();
    const destinationIdBySlug = new Map<string, string>();

    for (const rawRelation of rawRelations) {
        const bucket = destinationBreakdown.get(rawRelation.destinationSlug) ?? {
            created: 0,
            skipped: 0,
            notFound: 0
        };
        destinationBreakdown.set(rawRelation.destinationSlug, bucket);

        let destinationId = destinationIdBySlug.get(rawRelation.destinationSlug);
        if (destinationId === undefined) {
            const destination = await destinationModel.findOne(
                { slug: rawRelation.destinationSlug },
                ctx.db
            );
            if (!destination) {
                counts.destinationsNotFound = (counts.destinationsNotFound ?? 0) + 1;
                bucket.notFound += 1;
                continue;
            }
            destinationId = destination.id;
            destinationIdBySlug.set(rawRelation.destinationSlug, destinationId);
        }

        let pointOfInterestId = poiIdBySlug.get(rawRelation.poiSlug);
        if (pointOfInterestId === undefined) {
            const poi = await poiModel.findOne({ slug: rawRelation.poiSlug }, ctx.db);
            if (!poi) {
                counts.relationPoisNotFound = (counts.relationPoisNotFound ?? 0) + 1;
                bucket.notFound += 1;
                continue;
            }
            pointOfInterestId = poi.id;
            poiIdBySlug.set(rawRelation.poiSlug, pointOfInterestId);
        }

        const existingRelation = await relationModel.findOne(
            { destinationId, pointOfInterestId },
            ctx.db
        );
        if (existingRelation) {
            if (existingRelation.relation === rawRelation.relation) {
                counts.relationsSkipped = (counts.relationsSkipped ?? 0) + 1;
            } else {
                // Existing row disagrees with the pipeline's relation value —
                // never overwritten (destructive: false). See this file's
                // JSDoc "Known conflict" note.
                counts.relationsConflicting = (counts.relationsConflicting ?? 0) + 1;
            }
            bucket.skipped += 1;
            continue;
        }

        await relationModel.create(
            { destinationId, pointOfInterestId, relation: rawRelation.relation },
            ctx.db
        );
        counts.relationsCreated = (counts.relationsCreated ?? 0) + 1;
        bucket.created += 1;
    }

    for (const [destinationSlug, bucket] of destinationBreakdown) {
        counts[`${destinationSlug}-relationsCreated`] = bucket.created;
        counts[`${destinationSlug}-relationsSkipped`] = bucket.skipped;
        counts[`${destinationSlug}-relationsNotFound`] = bucket.notFound;
    }

    // ── 3. Category assignments (each fixture's own categories[], HOS-139) ──
    for (const rawPoi of rawPois) {
        const pointOfInterestId = poiIdBySlug.get(rawPoi.slug);
        if (!pointOfInterestId) {
            // Should never happen (every rawPoi was resolved/created in step
            // 1 above) — defensive guard against a partially-applied prior
            // run of just this section.
            counts.categoryPoisNotFound = (counts.categoryPoisNotFound ?? 0) + 1;
            continue;
        }

        for (const assignment of rawPoi.categories ?? []) {
            const category = await categoryModel.findOne({ slug: assignment.slug }, ctx.db);
            if (!category) {
                counts.categoriesNotFoundForAssignment =
                    (counts.categoriesNotFoundForAssignment ?? 0) + 1;
                continue;
            }

            const existingAssignment = await poiCategoryRelationModel.findOne(
                { pointOfInterestId, categoryId: category.id },
                ctx.db
            );
            if (existingAssignment) {
                counts.categoryAssignmentsSkipped = (counts.categoryAssignmentsSkipped ?? 0) + 1;
                continue;
            }

            await poiCategoryRelationModel.create(
                { pointOfInterestId, categoryId: category.id, isPrimary: assignment.isPrimary },
                ctx.db
            );
            counts.categoryAssignmentsCreated = (counts.categoryAssignmentsCreated ?? 0) + 1;
        }
    }

    return {
        summary:
            `HOS-142 POI catalog expansion: ${counts.poisCreated} POIs created ` +
            `(${counts.poisSkipped} already existed), ${counts.relationsCreated} ` +
            `destination-POI relations created (${counts.relationsSkipped} already ` +
            `existed, ${counts.relationsConflicting} conflicting), ` +
            `${counts.categoryAssignmentsCreated} category assignments created ` +
            `(${counts.categoryAssignmentsSkipped} already existed).`,
        counts
    };
}
