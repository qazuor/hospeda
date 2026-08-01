/**
 * @fileoverview
 * Data migration: 0031-poi-has-own-page
 *
 * Opens the first three point-of-interest detail pages by flipping
 * `points_of_interest.has_own_page` on a curated set of landmarks.
 *
 * ## Background
 *
 * `has_own_page` shipped with HOS-138 as a forward-looking flag ("marks POIs
 * that get a dedicated detail page") and stayed `false` on all 842 rows,
 * because no such page existed. It does now, at `/destinos/lugar/{slug}/`, and
 * the flag is its gate: a POI without it 404s and is absent from the sitemap.
 *
 * ## Why a curated set and not the whole catalog
 *
 * Generating 842 pages would be textbook doorway content. 60% of the catalog is
 * typed `OTHER`, 156 rows have no coordinates, and the median description is
 * 115 characters — and because a POI's "nearby accommodations" are in practice
 * its destination's accommodations, most pages would restate
 * `/destinos/{slug}/alojamientos/` under a different URL. The long tail is
 * already indexed on the destination page (HOS-146), which is where it belongs.
 *
 * `is_featured` cannot be reused as the curation signal: 597 of 842 rows carry
 * it, including entries like "Hospital Paranacito". Hence a separate,
 * deliberately small flag.
 *
 * ## The three
 *
 * Each is a nationally or provincially significant landmark, `verified`, with
 * real coordinates and at least three destination associations:
 *
 * - `palacio_san_jose` — Museo Nacional, Urquiza's former residence
 * - `castillo_san_carlos` — Castillo San Carlos, Concordia
 * - `molino_forclaz` — Monumento Histórico Nacional, Colonia San José
 *
 * The set is expected to grow through the admin panel, one editorially-reviewed
 * landmark at a time — NOT by widening a predicate here.
 *
 * ## Scope guards
 *
 * Matches the three slugs exactly and only writes rows where the flag is still
 * `false`, so a POI an operator already opened (or deliberately closed again) is
 * never touched. A slug missing from the target database is skipped silently —
 * the returned counts report how many actually flipped.
 *
 * ## Idempotency
 *
 * Re-running is a no-op: after the first pass no targeted row still has
 * `has_own_page = false`.
 *
 * ## `destructive` flag decision
 *
 * `false` — flips one boolean on three identified rows, deletes nothing, and is
 * reversible by setting the same three back to `false`.
 */
import { and, eq, inArray, pointsOfInterest } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0031-poi-has-own-page',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The curated landmarks that get a detail page. Mirrors `"hasOwnPage": true` in
 * the matching `src/data/pointOfInterest/*.json` baseline fixtures (dual-write
 * rule) — keep both sides in sync.
 */
const POI_SLUGS_WITH_OWN_PAGE = [
    'palacio_san_jose',
    'castillo_san_carlos',
    'molino_forclaz'
] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const opened = await ctx.db
        .update(pointsOfInterest)
        .set({ hasOwnPage: true, updatedAt: new Date() })
        .where(
            and(
                inArray(pointsOfInterest.slug, [...POI_SLUGS_WITH_OWN_PAGE]),
                eq(pointsOfInterest.hasOwnPage, false)
            )
        )
        .returning({ slug: pointsOfInterest.slug });

    const openedSlugs = opened.map((row) => row.slug).sort();

    return {
        summary:
            openedSlugs.length > 0
                ? `Opened detail pages for ${openedSlugs.length} point(s) of interest: ${openedSlugs.join(', ')}.`
                : 'No point of interest needed opening (all targeted rows already had hasOwnPage set).',
        counts: {
            poisOpened: openedSlugs.length,
            poisTargeted: POI_SLUGS_WITH_OWN_PAGE.length
        }
    };
}
