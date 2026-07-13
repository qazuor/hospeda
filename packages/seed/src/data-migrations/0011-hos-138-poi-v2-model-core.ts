/**
 * @fileoverview
 * Data migration: 0011-hos-138-poi-v2-model-core
 *
 * Dual-write counterpart (HOS-25) for HOS-138 (POI v2 core data model). The
 * structural migration `0052_*.sql` adds the `nameI18n` / `descriptionI18n` /
 * `translationMeta` columns to `points_of_interest` (all nullable), and this
 * spec's baseline edit fills those columns on the 12 seed fixtures so a FRESH
 * DB is built correct. This migration applies the identical i18n content to the
 * 12 rows that already exist on an already-seeded staging/prod DB (which
 * predates the columns), so both paths converge (spec §7.4, AC-6).
 *
 * Row data is read directly from the same fixture JSON files the baseline seed
 * reads (via `loadJsonFiles`), so the two can never drift — the fixture's
 * `nameI18n`/`descriptionI18n`/`translationMeta` are the single source of truth.
 *
 * ## Idempotency
 *
 * - A POI is updated only when its existing `nameI18n` is still `null` (the
 *   pre-migration state). A row that already carries `nameI18n` — because this
 *   migration ran before, or because a fresh DB seeded the content from the
 *   baseline — is skipped, so re-running never overwrites curated content.
 * - POIs are resolved by `slug` (UNIQUE), never by a hardcoded UUID: POI rows
 *   have no deterministic fixture id, and staging/prod ids differ from local
 *   dev ids.
 *
 * ## `destructive` flag decision
 *
 * `false` — every operation is an additive UPDATE of previously-`null` i18n
 * columns on an existing row. No row is deleted, and no already-populated i18n
 * content is overwritten (the `nameI18n IS NULL` guard).
 */
import type { I18nText, PointOfInterest, TranslationMeta } from '@repo/schemas';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0011-hos-138-poi-v2-model-core',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The 12 POI fixture filenames this migration backfills i18n content onto.
 * Deliberately a fixed list, not `requiredManifest.pointsOfInterest` — a future
 * PR that adds MORE points of interest ships its own migration for that delta;
 * this one stays frozen to the 12 that existed when HOS-138 landed.
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
 * Shape of the subset of a raw POI fixture item this migration reads: its
 * `slug` (lookup key) plus the three v2 i18n fields added by HOS-138.
 */
interface RawPointOfInterestI18nFixture {
    readonly slug: string;
    readonly nameI18n?: I18nText;
    readonly descriptionI18n?: I18nText;
    readonly translationMeta?: TranslationMeta;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const poiModel = new ctx.models.PointOfInterestModel();

    const counts: Record<string, number> = {
        poisUpdated: 0,
        poisSkipped: 0,
        poisNotFound: 0
    };

    const rawPois = await loadJsonFiles<RawPointOfInterestI18nFixture>('pointOfInterest', [
        ...POI_FIXTURE_FILES
    ]);

    for (const rawPoi of rawPois) {
        const existing = await poiModel.findOne({ slug: rawPoi.slug }, ctx.db);
        if (!existing) {
            // The row should exist post-0009; if a target env somehow lacks it,
            // that's the baseline-seed/0009's job, not this content backfill.
            counts.poisNotFound = (counts.poisNotFound ?? 0) + 1;
            continue;
        }

        // Idempotency: only touch rows still in the pre-migration null state.
        if (existing.nameI18n !== null && existing.nameI18n !== undefined) {
            counts.poisSkipped = (counts.poisSkipped ?? 0) + 1;
            continue;
        }

        await poiModel.update(
            { id: existing.id },
            {
                nameI18n: rawPoi.nameI18n,
                descriptionI18n: rawPoi.descriptionI18n,
                translationMeta: rawPoi.translationMeta
            } as Partial<PointOfInterest>,
            ctx.db
        );
        counts.poisUpdated = (counts.poisUpdated ?? 0) + 1;
    }

    return {
        summary: `HOS-138 POI v2 i18n backfill: ${counts.poisUpdated} POIs updated (${counts.poisSkipped} already had nameI18n, ${counts.poisNotFound} not found).`,
        counts
    };
}
