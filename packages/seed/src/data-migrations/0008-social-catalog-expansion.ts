/**
 * @fileoverview
 * Data migration: 0008-social-catalog-expansion
 *
 * Dual-write counterpart (HOS-25) for the baseline seed
 * `packages/seed/src/required/socialAutomation.seed.ts`, which expanded the
 * social-automation catalog with a full seasonal/event content calendar for
 * the Litoral (campaigns, content batches, audiences, footers, hashtag sets,
 * and hashtags), plus a typo fix on one existing hashtag row.
 *
 * Adds, idempotently (findOne by unique key → create if missing):
 *   - 15 new `social_campaigns` rows (16 total, `institucional-hospeda` already existed)
 *   - 7 new `social_content_batches` rows (8 total, `hospeda-launch-2026-06` already existed)
 *   - 8 new `social_audiences` rows (12 total, the original 4 already existed)
 *   - 5 new `social_post_footers` rows (6 total, `hospeda` already existed)
 *   - 11 new `social_hashtag_sets` rows (18 total, the original 7 already existed)
 *   - 51 new `social_hashtags` rows (89 total, the original 38 already existed)
 *
 * Two hashtags requested by the content spec — `#Termas` (`#termas`) and
 * `#Relax` (`#relax`) — already existed in the original 38-row catalog and are
 * therefore NOT re-added here (the column is UNIQUE on `normalized_hashtag`).
 * See the `NEW_HASHTAGS` filter below and the matching comments in the
 * baseline `HASHTAGS` array.
 *
 * Also fixes a pre-existing data bug: the `#ServiciosTuristicos` hashtag row
 * had `normalized_hashtag = '#serviciostristicos'` (missing the "u"). This
 * migration updates that row's `normalized_hashtag` to the correct
 * `'#serviciosturisticos'` — a no-op if the row is already fixed or absent.
 *
 * Row data is imported directly from the baseline seed's exported arrays
 * (`CAMPAIGNS`, `CONTENT_BATCHES`, `FOOTERS`, `HASHTAG_SETS`, `HASHTAGS`)
 * rather than duplicated here, so the two can never drift for those five
 * entities. The `social_audiences` are the one exception: the baseline seed
 * keeps its audience list as a `seedSocialAudiences`-local array (matching
 * the pre-existing convention for that entity, not exported), so the 8 new
 * audience rows are duplicated below — they must be kept in sync by hand if
 * either list changes.
 *
 * ## `destructive` flag decision
 *
 * `false` — every operation here is either an INSERT-if-missing or a single
 * corrective UPDATE of one already-wrong value on one existing row (never a
 * delete, and never a mutation of a row's commercial/identity fields).
 */
import {
    CAMPAIGNS,
    CONTENT_BATCHES,
    FOOTERS,
    HASHTAG_SETS,
    HASHTAGS
} from '../required/socialAutomation.seed.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0008-social-catalog-expansion',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The 8 new `social_audiences` rows added alongside the existing 4
 * (`turistas`, `familias`, `parejas`, `aventureros`). Duplicated from the
 * baseline seed's inline `seedSocialAudiences` array — see the module
 * doc-comment above for why this one entity is not imported.
 */
const NEW_AUDIENCES = [
    {
        name: 'Grupos de Amigos',
        slug: 'grupos-de-amigos',
        description: 'Escapadas grupales, cabañas grandes y actividades',
        active: true
    },
    {
        name: 'Viajeros Solos',
        slug: 'viajeros-solos',
        description: 'Turismo individual, mochileros y experiencias',
        active: true
    },
    {
        name: 'Adultos Mayores',
        slug: 'adultos-mayores',
        description: 'Turismo termal, descanso y ritmo tranquilo',
        active: true
    },
    {
        name: 'Viajan con Mascotas',
        slug: 'con-mascotas',
        description: 'Público que busca alojamientos pet friendly',
        active: true
    },
    {
        name: 'Turismo Termal y Bienestar',
        slug: 'turismo-termal',
        description: 'Público de termas, spa y descanso',
        active: true
    },
    {
        name: 'Pescadores',
        slug: 'pescadores',
        description: 'Pesca deportiva en el Río Uruguay',
        active: true
    },
    {
        name: 'Contingentes y Empresas',
        slug: 'contingentes-empresas',
        description: 'Grupos corporativos, contingentes y eventos',
        active: true
    },
    {
        name: 'Viajes de Egresados',
        slug: 'egresados',
        description: 'Grupos de egresados y viajes estudiantiles',
        active: true
    }
] as const;

/**
 * The legacy (typo'd) normalized value of the `#ServiciosTuristicos` row,
 * used to locate it before the fix.
 */
const LEGACY_SERVICIOS_TURISTICOS_NORMALIZED = '#serviciostristicos';

/**
 * The corrected normalized value (matches `HASHTAGS` in the baseline seed).
 */
const FIXED_SERVICIOS_TURISTICOS_NORMALIZED = '#serviciosturisticos';

/**
 * `HASHTAGS` minus the `#ServiciosTuristicos` row: that row already exists on
 * any already-seeded environment (just with the legacy typo'd normalized
 * value), so it must be reached via the dedicated typo-fix UPDATE below, not
 * the generic create-if-missing loop — looping it as-is would `findOne` by
 * the NEW (correct) normalized value, find nothing, and insert a duplicate
 * row instead of fixing the existing one.
 */
const NEW_HASHTAGS = HASHTAGS.filter((row) => row.hashtag !== '#ServiciosTuristicos');

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const campaignModel = new ctx.models.SocialCampaignModel();
    const contentBatchModel = new ctx.models.SocialContentBatchModel();
    const audienceModel = new ctx.models.SocialAudienceModel();
    const footerModel = new ctx.models.SocialPostFooterModel();
    const hashtagSetModel = new ctx.models.SocialHashtagSetModel();
    const hashtagModel = new ctx.models.SocialHashtagModel();

    const counts: Record<string, number> = {
        campaignsCreated: 0,
        campaignsSkipped: 0,
        contentBatchesCreated: 0,
        contentBatchesSkipped: 0,
        audiencesCreated: 0,
        audiencesSkipped: 0,
        footersCreated: 0,
        footersSkipped: 0,
        hashtagSetsCreated: 0,
        hashtagSetsSkipped: 0,
        hashtagsCreated: 0,
        hashtagsSkipped: 0,
        servicesHashtagTypoFixed: 0
    };

    // ── Campaigns (idempotent by slug) ────────────────────────────────────
    for (const row of CAMPAIGNS) {
        const existing = await campaignModel.findOne({ slug: row.slug }, ctx.db);
        if (existing) {
            counts.campaignsSkipped = (counts.campaignsSkipped ?? 0) + 1;
            continue;
        }
        await campaignModel.create(row, ctx.db);
        counts.campaignsCreated = (counts.campaignsCreated ?? 0) + 1;
    }

    // ── Content batches (idempotent by slug) ──────────────────────────────
    for (const row of CONTENT_BATCHES) {
        const existing = await contentBatchModel.findOne({ slug: row.slug }, ctx.db);
        if (existing) {
            counts.contentBatchesSkipped = (counts.contentBatchesSkipped ?? 0) + 1;
            continue;
        }
        await contentBatchModel.create(row, ctx.db);
        counts.contentBatchesCreated = (counts.contentBatchesCreated ?? 0) + 1;
    }

    // ── Audiences (idempotent by slug) ─────────────────────────────────────
    for (const row of NEW_AUDIENCES) {
        const existing = await audienceModel.findOne({ slug: row.slug }, ctx.db);
        if (existing) {
            counts.audiencesSkipped = (counts.audiencesSkipped ?? 0) + 1;
            continue;
        }
        await audienceModel.create(row, ctx.db);
        counts.audiencesCreated = (counts.audiencesCreated ?? 0) + 1;
    }

    // ── Footers (idempotent by slug) ───────────────────────────────────────
    for (const row of FOOTERS) {
        const existing = await footerModel.findOne({ slug: row.slug }, ctx.db);
        if (existing) {
            counts.footersSkipped = (counts.footersSkipped ?? 0) + 1;
            continue;
        }
        await footerModel.create(row, ctx.db);
        counts.footersCreated = (counts.footersCreated ?? 0) + 1;
    }

    // ── Hashtag sets (idempotent by slug) ──────────────────────────────────
    for (const row of HASHTAG_SETS) {
        const existing = await hashtagSetModel.findOne({ slug: row.slug }, ctx.db);
        if (existing) {
            counts.hashtagSetsSkipped = (counts.hashtagSetsSkipped ?? 0) + 1;
            continue;
        }
        await hashtagSetModel.create(row, ctx.db);
        counts.hashtagSetsCreated = (counts.hashtagSetsCreated ?? 0) + 1;
    }

    // ── Hashtags (idempotent by normalizedHashtag) ─────────────────────────
    for (const row of NEW_HASHTAGS) {
        const existing = await hashtagModel.findOne(
            { normalizedHashtag: row.normalizedHashtag },
            ctx.db
        );
        if (existing) {
            counts.hashtagsSkipped = (counts.hashtagsSkipped ?? 0) + 1;
            continue;
        }
        await hashtagModel.create(row, ctx.db);
        counts.hashtagsCreated = (counts.hashtagsCreated ?? 0) + 1;
    }

    // ── Typo fix: #ServiciosTuristicos normalized_hashtag ──────────────────
    const legacyRow = await hashtagModel.findOne(
        { normalizedHashtag: LEGACY_SERVICIOS_TURISTICOS_NORMALIZED },
        ctx.db
    );
    if (legacyRow) {
        await hashtagModel.update(
            { id: legacyRow.id },
            { normalizedHashtag: FIXED_SERVICIOS_TURISTICOS_NORMALIZED },
            ctx.db
        );
        counts.servicesHashtagTypoFixed = 1;
    }

    return {
        summary: `Social catalog expansion: ${counts.campaignsCreated} campaigns, ${counts.contentBatchesCreated} content batches, ${counts.audiencesCreated} audiences, ${counts.footersCreated} footers, ${counts.hashtagSetsCreated} hashtag sets, ${counts.hashtagsCreated} hashtags created; ServiciosTuristicos typo ${counts.servicesHashtagTypoFixed ? 'fixed' : 'already correct or row not found'}.`,
        counts
    };
}
