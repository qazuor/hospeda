/**
 * @fileoverview
 * Data migration: 0032-poi-tourism-display-weights
 *
 * Rebases every point of interest's `display_weight` on a tourism-relevance
 * scale derived from its PRIMARY category, and re-derives `is_featured` from
 * the result.
 *
 * ## The problem
 *
 * The weights that came out of the catalog import did not encode tourism
 * relevance — they were almost all 50 or 100. Measured per primary category
 * before this migration:
 *
 * | category      | avg weight |
 * |---------------|------------|
 * | health        | 100        |
 * | shopping      | 100        |
 * | transport     |  98        |
 * | museum        |  98        |
 * | services      |  94        |
 * | historic_site |  88        |
 * | government    |  80        |
 * | square        |  71        |
 * | park          |  67        |
 *
 * A hospital outranked a museum; a municipality outranked a park. Two surfaces
 * order POIs by this field — the destination page's grid and the accommodation
 * search's "near a point of interest" picker — so both led with civic
 * infrastructure instead of things a visitor travels to see.
 *
 * `is_featured` was the same kind of noise: 597 of 842 rows carried it,
 * Hospital Paranacito included, and the grid sorts on it ABOVE the weight — so
 * a featured hospital beat an unfeatured museum no matter what the weights
 * said. It is now derived (`weight >= 100`), which makes it agree with the
 * scale instead of inverting it.
 *
 * ## The scale
 *
 * Five tiers, keyed on the question "would someone travel here for this?":
 *
 * - **100** — the reason you come to the Litoral: thermal complexes, museums,
 *   historic sites, monuments, natural areas, reserves, beaches.
 * - **85** — a strong attraction in its own right.
 * - **70** — worth the visit once you are already there.
 * - **50** — civic / urban fabric: context, not a draw.
 * - **25** — a service, never an attraction: transport, government, services,
 *   health.
 *
 * The table is INLINED rather than imported so this migration stays a frozen
 * historical record (same convention as 0030). `test/poi-tourism-weights.test.ts`
 * asserts the baseline fixtures still agree with it.
 *
 * ## Three category corrections
 *
 * The scale alone could not rescue three flagship POIs whose PRIMARY category
 * was simply wrong: both of the region's best-known thermal complexes were
 * filed under `other`, and its only national park under `park` — a category
 * that otherwise holds urban plazas-with-trees. Their category is corrected
 * here (each has exactly one category row, so it is an update, not an insert),
 * which then feeds the normal scale. Fixing the data beats special-casing the
 * table.
 *
 * ## Scope guards
 *
 * Only rows whose primary category is in the table are touched, and only when
 * a value actually differs. A POI with no primary category at all (known-dirty
 * data, HOS-177) keeps whatever weight it has.
 *
 * ## Idempotency
 *
 * Re-running is a no-op: the `IS DISTINCT FROM` guard matches nothing once the
 * first pass has converged.
 *
 * ## `destructive` flag decision
 *
 * `false` — rewrites two scalar columns on catalog rows and repoints three
 * category references. Deletes nothing; reversible by re-running the previous
 * values.
 */
import { sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0032-poi-tourism-display-weights',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * Tourism-relevance weight per POI category slug. Mirrors `displayWeight` in
 * the `src/data/pointOfInterest/*.json` baseline fixtures (dual-write rule).
 */
const WEIGHT_BY_CATEGORY: Readonly<Record<string, number>> = {
    // 100 — the reason someone travels to the Litoral.
    thermal_complex: 100,
    museum: 100,
    historic_site: 100,
    monument: 100,
    natural_area: 100,
    reserve: 100,
    beach: 100,
    // 85 — a strong attraction in its own right.
    industrial_heritage: 85,
    winery: 85,
    tourist_route: 85,
    viewpoint: 85,
    waterfront: 85,
    birdwatching: 85,
    hiking: 85,
    theater: 85,
    cultural_center: 85,
    art: 85,
    architecture: 85,
    // 70 — worth the visit once you are there.
    park: 70,
    religious_site: 70,
    port: 70,
    campground: 70,
    fair: 70,
    casino: 70,
    entertainment: 70,
    recreation: 70,
    gastronomy: 70,
    wellness: 70,
    family: 70,
    nightlife: 70,
    // 50 — civic / urban fabric, context rather than a draw.
    square: 50,
    sports_venue: 50,
    shopping: 50,
    education: 50,
    community_center: 50,
    other: 50,
    // 25 — a service, never an attraction.
    transport: 25,
    government: 25,
    services: 25,
    health: 25
};

/** A POI is featured exactly when it sits in the top tier. */
const FEATURED_AT_OR_ABOVE = 100;

/**
 * POIs whose PRIMARY category is plainly wrong, and the category it should be.
 * Applied before the weights so they flow through the normal scale.
 */
const PRIMARY_CATEGORY_CORRECTIONS: ReadonlyArray<readonly [string, string]> = [
    ['termas_de_federacion', 'thermal_complex'],
    ['complejo_termal_concordia', 'thermal_complex'],
    ['parque_nacional_el_palmar', 'natural_area']
];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // ── 1. Correct the three miscategorised flagships ────────────────────
    let categoriesCorrected = 0;

    for (const [poiSlug, categorySlug] of PRIMARY_CATEGORY_CORRECTIONS) {
        const corrected = await ctx.db.execute(sql`
            UPDATE r_poi_category rc
            SET category_id = target.id
            FROM points_of_interest p, poi_categories target
            WHERE rc.point_of_interest_id = p.id
              AND rc.is_primary = true
              AND p.slug = ${poiSlug}
              AND target.slug = ${categorySlug}
              AND rc.category_id IS DISTINCT FROM target.id
        `);
        categoriesCorrected += corrected.rowCount ?? 0;
    }

    // ── 2. Rebase weight + featured off the primary category ─────────────
    // One statement over the whole catalog: a VALUES list carries the table
    // into SQL so the join does the lookup, and the IS DISTINCT FROM guard
    // makes the write idempotent.
    const weightRows = sql.join(
        Object.entries(WEIGHT_BY_CATEGORY).map(
            ([slug, weight]) => sql`(${slug}, ${weight}::integer)`
        ),
        sql`, `
    );

    const updated = await ctx.db.execute(sql`
        UPDATE points_of_interest p
        SET display_weight = w.weight,
            is_featured = (w.weight >= ${FEATURED_AT_OR_ABOVE}),
            updated_at = now()
        FROM r_poi_category rc
        JOIN poi_categories c ON c.id = rc.category_id
        JOIN (VALUES ${weightRows}) AS w(slug, weight) ON w.slug = c.slug
        WHERE rc.point_of_interest_id = p.id
          AND rc.is_primary = true
          AND p.deleted_at IS NULL
          AND (
              p.display_weight IS DISTINCT FROM w.weight
              OR p.is_featured IS DISTINCT FROM (w.weight >= ${FEATURED_AT_OR_ABOVE})
          )
    `);

    const poisReweighted = updated.rowCount ?? 0;

    return {
        summary: `Rebased ${poisReweighted} point(s) of interest onto the tourism-relevance weight scale; corrected ${categoriesCorrected} miscategorised primary category(ies).`,
        counts: {
            poisReweighted,
            categoriesCorrected,
            categoriesInScale: Object.keys(WEIGHT_BY_CATEGORY).length
        }
    };
}
