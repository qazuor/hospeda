/**
 * @fileoverview
 * Data migration: 0020-backfill-accommodation-seo-titles
 *
 * Dual-write counterpart (HOS-25) for BETA-175: 13 accommodation seed
 * fixtures had a `seo.title` that was truncated to fit the schema's 60-char
 * cap (`SeoSchema` in `packages/schemas/src/common/seo.schema.ts`) by simply
 * cutting the string, leaving a dangling trailing preposition (" en") with no
 * city name after it — e.g. `"Cabaña del Río - Alojamiento a 300m del río
 * Uruguay en"`. The baseline fixtures were fixed to rewritten titles that
 * both include the city AND stay within the schema's `min(30)`/`max(60)`
 * bounds, but these 13 accommodations already exist on staging/prod with the
 * old truncated title stored in their `seo` JSONB column, so the baseline
 * edit alone never reaches them — this migration backfills the live rows.
 *
 * ## Idempotency
 *
 * Each of the 13 target accommodations is resolved by `slug` (never a
 * hardcoded id — accommodation fixture ids are not deterministic across
 * environments). A row is updated only when its current `seo.title` is
 * exactly the OLD truncated value; if the title has already been backfilled
 * (a second run) or was independently edited to something else by an owner,
 * the row is left untouched. `seo.description` (and any other sibling key
 * present in the stored JSONB, e.g. legacy `keywords`) is preserved
 * unchanged — only `title` is replaced, via a manual spread over the
 * existing `seo` object (accommodation's `mergeableJsonbColumns` does NOT
 * include `seo`, so `AccommodationModel.update()` replaces the column
 * wholesale rather than shallow-merging it).
 *
 * ## `destructive` flag decision
 *
 * `false` — this is a targeted, idempotent string replacement on a single
 * JSONB key of 13 well-identified rows. Nothing is deleted, and the change
 * is trivially reversible by re-running the old truncated value back in.
 */
import type { Seo } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0020-backfill-accommodation-seo-titles',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The 13 accommodations this migration backfills (BETA-175), keyed by their
 * fixture `slug` (stable across environments), mapping the OLD truncated
 * `seo.title` (dangling on a bare " en") to the NEW rewritten title that
 * includes the city and satisfies the schema's 30-60 char bounds.
 */
const SEO_TITLE_BACKFILLS: ReadonlyArray<{
    readonly slug: string;
    readonly oldTitle: string;
    readonly newTitle: string;
}> = [
    {
        slug: 'cabana-del-rio-colon',
        oldTitle: 'Cabaña del Río - Alojamiento a 300m del río Uruguay en',
        newTitle: 'Cabaña del Río - A 300m del río Uruguay en Colón'
    },
    {
        slug: 'horizonte-agradable-camping-colon',
        oldTitle: 'Horizonte Agradable Camping - Camping a orillas del río en',
        newTitle: 'Horizonte Agradable Camping - A orillas del río en Colón'
    },
    {
        slug: 'refugio-relajante-hotel-concordia',
        oldTitle: 'Refugio Relajante Hotel - Tranquilidad y piscina en',
        newTitle: 'Refugio Relajante Hotel - Piscina en Concordia'
    },
    {
        slug: 'refugio-apacible-hotel-federacion',
        oldTitle: 'Refugio Apacible Hotel - Tranquilidad y piscina en',
        newTitle: 'Refugio Apacible Hotel - Piscina en Federación'
    },
    {
        slug: 'nido-natural-room-gualeguaychu',
        oldTitle: 'Nido Natural - Habitación privada y económica en',
        newTitle: 'Nido Natural - Habitación económica en Gualeguaychú'
    },
    {
        slug: 'paraiso-encantado-room-gualeguaychu',
        oldTitle: 'Paraíso Encantado - Habitación privada económica en',
        newTitle: 'Paraíso Encantado - Habitación en Gualeguaychú'
    },
    {
        slug: 'sueno-calmado-hostel-gualeguaychu',
        oldTitle: 'Sueño Calmado Hostel - Alojamiento económico y tranquilo en',
        newTitle: 'Sueño Calmado Hostel - Económico en Gualeguaychú'
    },
    {
        slug: 'rincon-calmado-room-villa_paranacito',
        oldTitle: 'Rincón Calmado - Habitación privada y tranquila en',
        newTitle: 'Rincón Calmado - Habitación en Villa Paranacito'
    },
    {
        slug: 'mirador-relajante-hostel-concepcion_del_uruguay',
        oldTitle: 'Mirador Relajante Hostel - Alojamiento económico en',
        newTitle: 'Mirador Relajante Hostel en Concepción del Uruguay'
    },
    {
        slug: 'paraiso-tranquilo-room-concepcion_del_uruguay',
        oldTitle: 'Paraíso Tranquilo - Habitación privada y serena en',
        newTitle: 'Paraíso Tranquilo - Habitación en Concepción del Uruguay'
    },
    {
        slug: 'refugio-acogedor-room-concepcion_del_uruguay',
        oldTitle: 'Refugio Acogedor - Habitación privada y económica en',
        newTitle: 'Refugio Acogedor - Habitación en Concepción del Uruguay'
    },
    {
        slug: 'rio-apacible-house-concepcion_del_uruguay',
        oldTitle: 'Rio Apacible House - Casa tranquila cerca del río en',
        newTitle: 'Rio Apacible House - Casa en Concepción del Uruguay'
    },
    {
        slug: 'rio-soleado-hotel-concepcion_del_uruguay',
        oldTitle: 'Rio Soleado Hotel - A una cuadra de la costanera en',
        newTitle: 'Rio Soleado Hotel - Costanera en Concepción del Uruguay'
    }
] as const;

/**
 * Shape of the subset of an accommodation row this migration cares about:
 * its `seo` JSONB column (may be `null`/`undefined` on a legacy row).
 */
interface AccommodationSeoRow {
    readonly id: string;
    readonly seo?: Seo | null;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const accommodationModel = new ctx.models.AccommodationModel();

    const counts: Record<string, number> = {
        updated: 0,
        alreadyCorrect: 0,
        notFound: 0
    };

    for (const { slug, oldTitle, newTitle } of SEO_TITLE_BACKFILLS) {
        const accommodation = (await accommodationModel.findOne(
            { slug },
            ctx.db
        )) as AccommodationSeoRow | null;

        if (!accommodation) {
            counts.notFound = (counts.notFound ?? 0) + 1;
            continue;
        }

        const currentSeo = accommodation.seo ?? undefined;

        // Idempotent: only touch a row still carrying the exact OLD truncated
        // title. Already-backfilled rows (second run) and rows an operator
        // independently edited to a different title are both left alone.
        if (currentSeo?.title !== oldTitle) {
            counts.alreadyCorrect = (counts.alreadyCorrect ?? 0) + 1;
            continue;
        }

        await accommodationModel.update(
            { slug },
            { seo: { ...currentSeo, title: newTitle } },
            ctx.db
        );
        counts.updated = (counts.updated ?? 0) + 1;
    }

    return {
        summary: `BETA-175 seo.title backfill: ${counts.updated} accommodation(s) updated, ${counts.alreadyCorrect} already correct/edited, ${counts.notFound} not found.`,
        counts
    };
}
