/**
 * @fileoverview
 * Data migration: 0009-hos-113-points-of-interest
 *
 * Dual-write counterpart (HOS-25) for HOS-113 Phase 1: adds the new
 * `points_of_interest` catalog (12 fixtures under
 * `src/data/pointOfInterest/*.json`) and wires the `r_destination_point_of_interest`
 * M2M relations declared via `pointOfInterestIds` on 6 already-live
 * destination fixtures (`002-destination-colon`, `003-destination-concordia`,
 * `004-destination-federacion`, `007-destination-liebig`,
 * `011-destination-concepcion-del-uruguay`, `018-destination-caseros`).
 *
 * A fresh DB gets both directly from the baseline (`pointsOfInterest.seed.ts`
 * + `destinations.seed.ts`'s `pointOfInterestRelationBuilder`), but an
 * already-seeded staging/prod DB predates HOS-113 entirely — it has neither
 * the 12 POI rows nor the 6 relation rows — so this migration backfills both.
 *
 * Row data is read directly from the same fixture JSON files the baseline
 * seed reads (via `loadJsonFiles`), reusing `normalizePointOfInterestSeedItem`
 * from `pointsOfInterest.seed.ts`, so the two can never drift.
 *
 * ## Idempotency
 *
 * - POIs are created only when no row with the same `slug` already exists
 *   (`points_of_interest.slug` is UNIQUE).
 * - Relations are created only when no `(destinationId, pointOfInterestId)`
 *   row already exists in `r_destination_point_of_interest` (composite PK).
 * - Both destinations and POIs are resolved by `slug`, never by a hardcoded
 *   UUID: neither entity uses a deterministic fixture id (POIs have no
 *   `deterministicId` option in `pointsOfInterest.seed.ts`; destination ids
 *   ARE deterministic, but re-deriving that UUID here would duplicate
 *   `getDestinationFixtureId` for no benefit over a plain slug lookup) — and
 *   in any case staging/prod ids differ from local dev ids for any row not
 *   using the deterministic-id path.
 *
 * ## `destructive` flag decision
 *
 * `false` — every operation here is an INSERT-if-missing (POIs, then
 * relations). Nothing is ever deleted or overwritten.
 */
import type { PointOfInterest } from '@repo/schemas';
import { normalizePointOfInterestSeedItem } from '../required/pointsOfInterest.seed.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0009-hos-113-points-of-interest',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The 12 POI fixture filenames this migration backfills (HOS-113 Phase 1).
 * Deliberately a fixed list, not `requiredManifest.pointsOfInterest` —
 * a future PR that adds MORE points of interest ships its own migration for
 * that delta; this one must stay frozen to what HOS-113 Phase 1 introduced.
 */
const POI_FIXTURE_FILES = [
    '001-point-of-interest-autodromo_concepcion_del_uruguay.json',
    '002-point-of-interest-playa_banco_pelay.json',
    '003-point-of-interest-palacio_san_jose.json',
    '004-point-of-interest-basilica_inmaculada_concepcion.json',
    '005-point-of-interest-parque_unzue.json',
    '006-point-of-interest-isla_del_puerto.json',
    '007-point-of-interest-plaza_francisco_ramirez.json',
    '008-point-of-interest-mirador_costanera.json',
    '009-point-of-interest-complejo_termal_concordia.json',
    '010-point-of-interest-balneario_itape.json',
    '011-point-of-interest-parque_nacional_el_palmar.json',
    '012-point-of-interest-termas_de_federacion.json'
] as const;

/**
 * The 6 already-live destination fixture filenames whose `pointOfInterestIds`
 * array was edited by HOS-113 Phase 1 to add destination↔POI relations.
 */
const DESTINATION_FIXTURE_FILES_WITH_POIS = [
    '002-destination-colon.json',
    '003-destination-concordia.json',
    '004-destination-federacion.json',
    '007-destination-liebig.json',
    '011-destination-concepcion-del-uruguay.json',
    '018-destination-caseros.json'
] as const;

/**
 * Shape of a raw POI fixture item, as loaded from
 * `src/data/pointOfInterest/*.json`, before normalization.
 */
interface RawPointOfInterestFixture {
    readonly id: string;
    readonly slug: string;
    readonly [key: string]: unknown;
}

/**
 * Shape of the subset of a raw destination fixture item this migration
 * cares about: its own `slug` and the `pointOfInterestIds` seed-key array
 * (each entry is a POI fixture's own `id`, e.g.
 * `"010-point-of-interest-balneario_itape"`).
 */
interface RawDestinationFixtureWithPois {
    readonly slug: string;
    readonly pointOfInterestIds?: readonly string[];
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const poiModel = new ctx.models.PointOfInterestModel();
    const destinationModel = new ctx.models.DestinationModel();
    const relationModel = new ctx.models.RDestinationPointOfInterestModel();

    const counts: Record<string, number> = {
        poisCreated: 0,
        poisSkipped: 0,
        relationsCreated: 0,
        relationsSkipped: 0,
        destinationsNotFound: 0,
        poisNotFound: 0
    };

    // ── Points of interest (idempotent by slug) ────────────────────────────
    const rawPois = await loadJsonFiles<RawPointOfInterestFixture>('pointOfInterest', [
        ...POI_FIXTURE_FILES
    ]);

    // Maps a POI fixture's own seed-key (its JSON `id`, e.g.
    // "010-point-of-interest-balneario_itape") to its curated `slug`, so the
    // relation step below can resolve `pointOfInterestIds` entries without
    // re-parsing the filename convention.
    const poiSlugBySeedId = new Map<string, string>();

    for (const rawPoi of rawPois) {
        poiSlugBySeedId.set(rawPoi.id, rawPoi.slug);

        const existing = await poiModel.findOne({ slug: rawPoi.slug }, ctx.db);
        if (existing) {
            counts.poisSkipped = (counts.poisSkipped ?? 0) + 1;
            continue;
        }

        const normalized = normalizePointOfInterestSeedItem(rawPoi);
        await poiModel.create(normalized as Partial<PointOfInterest>, ctx.db);
        counts.poisCreated = (counts.poisCreated ?? 0) + 1;
    }

    // ── Destination ↔ POI relations (idempotent by composite PK) ───────────
    const rawDestinations = await loadJsonFiles<RawDestinationFixtureWithPois>('destination', [
        ...DESTINATION_FIXTURE_FILES_WITH_POIS
    ]);

    for (const rawDestination of rawDestinations) {
        const poiSeedIds = rawDestination.pointOfInterestIds ?? [];
        if (poiSeedIds.length === 0) {
            continue;
        }

        const destination = await destinationModel.findOne({ slug: rawDestination.slug }, ctx.db);
        if (!destination) {
            counts.destinationsNotFound = (counts.destinationsNotFound ?? 0) + 1;
            continue;
        }

        for (const poiSeedId of poiSeedIds) {
            const poiSlug = poiSlugBySeedId.get(poiSeedId);
            if (!poiSlug) {
                counts.poisNotFound = (counts.poisNotFound ?? 0) + 1;
                continue;
            }

            const poi = await poiModel.findOne({ slug: poiSlug }, ctx.db);
            if (!poi) {
                counts.poisNotFound = (counts.poisNotFound ?? 0) + 1;
                continue;
            }

            const existingRelation = await relationModel.findOne(
                { destinationId: destination.id, pointOfInterestId: poi.id },
                ctx.db
            );
            if (existingRelation) {
                counts.relationsSkipped = (counts.relationsSkipped ?? 0) + 1;
                continue;
            }

            await relationModel.create(
                { destinationId: destination.id, pointOfInterestId: poi.id },
                ctx.db
            );
            counts.relationsCreated = (counts.relationsCreated ?? 0) + 1;
        }
    }

    return {
        summary: `HOS-113 POI backfill: ${counts.poisCreated} POIs created (${counts.poisSkipped} already existed), ${counts.relationsCreated} destination-POI relations created (${counts.relationsSkipped} already existed).`,
        counts
    };
}
