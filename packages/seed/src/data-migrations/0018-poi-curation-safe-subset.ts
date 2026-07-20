/**
 * @fileoverview
 * Data migration: 0018-poi-curation-safe-subset
 *
 * Dual-write counterpart (HOS-25) for a manual editorial curation pass over
 * the HOS-142 POI catalog (branch `chore/poi-curation-safe-subset`). Two
 * independent corrections, both keyed by `slug` (POIs have no stable
 * deterministic id — same rationale `0009`/`0013` document):
 *
 * 1. **Removal of 78 non-geolocatable catalog rows.** These were seeded as
 *    "points of interest" but are actually one-off events (carnivals,
 *    festivals, marathons), guided activities/circuits with no fixed
 *    location (bike tours, fishing circuits, historical walking tours), or
 *    gas stations — none of which represent a stable physical landmark a
 *    map pin can meaningfully point to. The baseline fixtures for these 78
 *    slugs were deleted from `src/data/pointOfInterest/` and their filenames
 *    removed from `manifest-required.json`'s `pointOfInterestCatalog` array,
 *    so a FRESH seed never creates them. This migration reaches the same end
 *    state on an already-seeded environment via a SOFT delete (`deletedAt` +
 *    `deletedById`), not a hard delete — consistent with this codebase's
 *    default soft-delete convention (see `packages/db/CLAUDE.md` "Soft delete
 *    by default") and with `points_of_interest` carrying its own
 *    `deletedAt`/`deletedById` columns. Existing
 *    `r_destination_point_of_interest` / `r_poi_category` link rows are left
 *    untouched (no cascade) — every consuming read path already filters POIs
 *    to `deletedAt IS NULL AND lifecycleState = 'ACTIVE'`
 *    (`PointOfInterestModel.findDestinationIdsBySlugs`/`findWithinRadius`),
 *    so an orphaned link row simply never resolves to a visible POI, the
 *    same tolerance every other soft-deleted entity in this codebase relies
 *    on.
 *
 * 2. **Coordinate corrections for 244 catalog rows**: 214 fills (previously
 *    `lat`/`long: null`, now geocoded) and 30 small corrections (≤200m
 *    drift from the original auto-geocoded value). The baseline fixtures
 *    were updated in place with the corrected values; this migration applies
 *    the identical `lat`/`long` pair to already-seeded rows.
 *
 * Both operations read their exact target list from the colocated
 * `0018-poi-curation-safe-subset.data.json` file (78 slugs + 244
 * `{ slug, lat, long }` corrections) rather than re-scanning the live
 * `src/data/pointOfInterest/**` fixtures at migration run time (the approach
 * `0015-hos-177-poi-geocode-guard-backfill.ts` uses for its full-catalog
 * sync). A frozen, explicit list is deliberate here, mirroring `0009`'s
 * rationale: this migration's scope must never silently widen if a LATER
 * PR further edits those same fixture files for an unrelated reason — it
 * corrects exactly the 78+244 rows curated in this pass, no more.
 *
 * ## Idempotency
 *
 * - Deletions: a slug not found is counted separately (`deletionsNotFound`)
 *   rather than treated as an error (POIs have no deterministic id, so a
 *   fixture rename/removal on a later branch is a legitimate, non-fatal
 *   reason for a miss). A slug already soft-deleted is a no-op
 *   (`deletionsSkipped`) — re-running this migration never re-stamps
 *   `deletedAt`/`deletedById`.
 * - Coordinate corrections: only patched when the existing `lat`/`long`
 *   differ from the target value (`coordsSkipped` otherwise), so re-running
 *   is a true no-op once applied.
 *
 * ## `destructive` flag decision
 *
 * `true` — the 78 soft-deletes are an irreversible-by-default status change
 * (no automatic restore path), so this requires the production destructive-
 * migration gate (`HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION` / `--allow-destructive`)
 * before it can run against production, same as any other row-removal
 * migration in this carril.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PointOfInterest } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0018-poi-curation-safe-subset',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

// ESM equivalent of __dirname, anchored to this file's own location — same
// technique `loadDestinationRelations.ts` uses for its colocated data file.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '0018-poi-curation-safe-subset.data.json');

/** A single coordinate correction: fill a null value or correct small drift. */
interface CoordCorrection {
    readonly slug: string;
    readonly lat: number;
    readonly long: number;
}

/** Shape of the colocated `0018-poi-curation-safe-subset.data.json` payload. */
interface PoiCurationData {
    readonly deletedSlugs: readonly string[];
    readonly coordCorrections: readonly CoordCorrection[];
}

/** Minimal row shape this migration needs back from `findOne`. */
interface ExistingPointOfInterestRow {
    readonly id: string;
    readonly lat?: number | null;
    readonly long?: number | null;
    readonly deletedAt?: Date | null;
}

/** Minimal model contract needed for the curation pass. */
export interface PointOfInterestCurationModel {
    findOne(
        where: { readonly slug: string },
        db: SeedMigrationCtx['db']
    ): Promise<ExistingPointOfInterestRow | null>;
    update(
        where: { readonly id: string },
        data: Partial<PointOfInterest>,
        db: SeedMigrationCtx['db']
    ): Promise<unknown>;
}

interface PoiCurationCounts {
    deletionsApplied: number;
    deletionsSkipped: number;
    deletionsNotFound: number;
    coordsUpdated: number;
    coordsSkipped: number;
    coordsNotFound: number;
}

async function loadPoiCurationData(): Promise<PoiCurationData> {
    const raw = await readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw) as PoiCurationData;
}

/**
 * Soft-deletes every POI in `deletedSlugs` that is not already soft-deleted,
 * stamping `deletedAt`/`deletedById` with the migration's acting actor.
 */
export async function applyPoiDeletions(params: {
    readonly deletedSlugs: readonly string[];
    readonly poiModel: PointOfInterestCurationModel;
    readonly db: SeedMigrationCtx['db'];
    readonly actorId: string;
}): Promise<
    Pick<PoiCurationCounts, 'deletionsApplied' | 'deletionsSkipped' | 'deletionsNotFound'>
> {
    const { deletedSlugs, poiModel, db, actorId } = params;
    let deletionsApplied = 0;
    let deletionsSkipped = 0;
    let deletionsNotFound = 0;

    for (const slug of deletedSlugs) {
        const existing = await poiModel.findOne({ slug }, db);
        if (!existing) {
            deletionsNotFound += 1;
            continue;
        }
        if (existing.deletedAt) {
            deletionsSkipped += 1;
            continue;
        }

        await poiModel.update(
            { id: existing.id },
            { deletedAt: new Date(), deletedById: actorId },
            db
        );
        deletionsApplied += 1;
    }

    return { deletionsApplied, deletionsSkipped, deletionsNotFound };
}

/**
 * Applies each `{ slug, lat, long }` correction, skipping rows whose stored
 * coordinates already match the target value.
 */
export async function applyPoiCoordCorrections(params: {
    readonly coordCorrections: readonly CoordCorrection[];
    readonly poiModel: PointOfInterestCurationModel;
    readonly db: SeedMigrationCtx['db'];
}): Promise<Pick<PoiCurationCounts, 'coordsUpdated' | 'coordsSkipped' | 'coordsNotFound'>> {
    const { coordCorrections, poiModel, db } = params;
    let coordsUpdated = 0;
    let coordsSkipped = 0;
    let coordsNotFound = 0;

    for (const correction of coordCorrections) {
        const existing = await poiModel.findOne({ slug: correction.slug }, db);
        if (!existing) {
            coordsNotFound += 1;
            continue;
        }

        const unchanged = existing.lat === correction.lat && existing.long === correction.long;
        if (unchanged) {
            coordsSkipped += 1;
            continue;
        }

        await poiModel.update(
            { id: existing.id },
            { lat: correction.lat, long: correction.long },
            db
        );
        coordsUpdated += 1;
    }

    return { coordsUpdated, coordsSkipped, coordsNotFound };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const poiModel = new ctx.models.PointOfInterestModel() as PointOfInterestCurationModel;
    const data = await loadPoiCurationData();

    const deletionCounts = await applyPoiDeletions({
        deletedSlugs: data.deletedSlugs,
        poiModel,
        db: ctx.db,
        actorId: ctx.actor.id
    });
    const coordCounts = await applyPoiCoordCorrections({
        coordCorrections: data.coordCorrections,
        poiModel,
        db: ctx.db
    });

    const counts: PoiCurationCounts = { ...deletionCounts, ...coordCounts };

    return {
        summary:
            `POI curation safe-subset: ${counts.deletionsApplied} soft-deleted ` +
            `(${counts.deletionsSkipped} already deleted, ${counts.deletionsNotFound} not found), ` +
            `${counts.coordsUpdated} coordinates corrected ` +
            `(${counts.coordsSkipped} already matched, ${counts.coordsNotFound} not found).`,
        counts: { ...counts }
    };
}
