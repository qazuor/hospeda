/**
 * @fileoverview
 * Data migration: 0157-hos-2061-towels-per-vertical
 *
 * Dual-write counterpart (HOS-25) for the owner decision of 2026-11-09 that
 * follows HOS-2061. Migration 0155 widened the amenity `towels` (type
 * `BED_AND_BATH`) to experiences, so a kayak trip or a thermal-baths visit
 * showed "Toallas" under the group "Dormitorio y baño". The decision is two
 * items, one per vertical, each in a category that fits:
 *
 * - `towels` goes back to accommodation-only, in `BED_AND_BATH`.
 * - `towels_provided` is new, experience-only, in `GENERAL_APPLIANCES` (the
 *   editor group "Equipamiento"), with the same visible label "Toallas".
 *
 * Three steps, in this order:
 *
 * 1. **Insert** `towels_provided` from the very fixture file the baseline
 *    seeder reads, `ON CONFLICT (slug) DO NOTHING`.
 * 2. **Remap** every `r_experience_amenity` row of `towels` onto
 *    `towels_provided` (attributes kept, owners verified by the shared helper).
 *    This runs BEFORE the narrowing, so no experience is left linking an
 *    amenity that no longer applies to it.
 * 3. **Narrow** `towels.applicable_verticals` to `{accommodation}`.
 *
 * No 301 is needed: `towels_provided` never had an accommodation landing page
 * and `towels` keeps its own.
 *
 * ## Idempotency
 *
 * The insert is a no-op on a second run, the remap finds no source rows, and
 * the narrowing writes only while the row still lists another vertical.
 *
 * ## `destructive` flag decision
 *
 * `true` -- the remap deletes the experience-side `towels` link rows after
 * moving them. Measured 2026-11-09: staging and production held 0 experience
 * links to `towels` (staging 109 accommodation links, which are untouched), so
 * nothing is lost in practice; the flag stays because the statement can delete.
 */
import { amenities, and, eq, isNull } from '@repo/db';
import { AmenitiesTypeEnumSchema, i18nText } from '@repo/schemas';
import { z } from 'zod';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import { remapVerticalRelations } from './helpers/catalog-relation-remap.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0157-hos-2061-towels-per-vertical',
    group: 'required',
    destructive: true,
    // HOS-433: the narrowing writes `applicable_verticals` (SPEC-266).
    requiresColumns: [{ table: 'amenities', column: 'applicable_verticals' }]
} as const satisfies SeedMigrationModule['meta'];

/** The new experience-only amenity fixture. */
export const NEW_AMENITY_FIXTURE_FILES: readonly string[] = [
    '179-amenity-general-appliances-towels-provided.json'
];

/** The accommodation row that stays and the experience row that replaces it. */
export const TOWELS_SLUG = 'towels';
export const TOWELS_PROVIDED_SLUG = 'towels_provided';

const AmenityFixtureSchema = z.object({
    slug: z.string().min(1),
    description: i18nText({ min: 10, max: 500 }),
    applicableVerticals: z.array(z.enum(['accommodation', 'venue', 'experience'])).min(1),
    type: AmenitiesTypeEnumSchema,
    icon: z.string().min(1),
    isBuiltin: z.boolean(),
    isFeatured: z.boolean(),
    displayWeight: z.number().int()
});

/** Looks up the LIVE id and verticals of an amenity by slug. */
async function findLive(
    ctx: SeedMigrationCtx,
    slug: string
): Promise<{ readonly id: string; readonly verticals: readonly string[] } | undefined> {
    const [row] = await ctx.db
        .select({ id: amenities.id, verticals: amenities.applicableVerticals })
        .from(amenities)
        .where(and(eq(amenities.slug, slug), isNull(amenities.deletedAt)));
    return row ? { id: row.id, verticals: row.verticals ?? [] } : undefined;
}

/**
 * Splits the `towels` amenity into an accommodation item and an experience item.
 *
 * @param ctx - Migration context; `ctx.db` is transaction-scoped.
 * @returns A summary plus the count of every step.
 * @throws Error when the relation move would lose an owner (the runner then
 *   rolls the transaction back).
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const rows = (
        await loadJsonFiles<unknown>('src/data/amenity', [...NEW_AMENITY_FIXTURE_FILES])
    ).map((raw) => AmenityFixtureSchema.parse(raw));
    const created = await ctx.db
        .insert(amenities)
        .values(rows)
        .onConflictDoNothing({ target: amenities.slug })
        .returning({ id: amenities.id });

    const towels = await findLive(ctx, TOWELS_SLUG);
    const provided = await findLive(ctx, TOWELS_PROVIDED_SLUG);

    let relationsMoved = 0;
    let relationsCollapsed = 0;
    if (towels && provided) {
        const counts = await remapVerticalRelations({
            db: ctx.db,
            vertical: 'experience',
            source: { kind: 'amenity', id: towels.id },
            target: { kind: 'amenity', id: provided.id }
        });
        relationsMoved = counts.moved;
        relationsCollapsed = counts.collapsed;
        logger.info(
            `[0157] towels -> towels_provided [experience]: source ${counts.sourceBefore} -> 0, ` +
                `moved ${counts.moved}, collapsed ${counts.collapsed}`
        );
    }

    let narrowed = 0;
    if (towels && (towels.verticals.length !== 1 || towels.verticals[0] !== 'accommodation')) {
        await ctx.db
            .update(amenities)
            .set({ applicableVerticals: ['accommodation'], updatedAt: new Date() })
            .where(eq(amenities.id, towels.id));
        narrowed = 1;
    }

    return {
        summary:
            `HOS-2061 towels per vertical: ${created.length} amenity created, ` +
            `${relationsMoved} experience relation(s) moved (${relationsCollapsed} collapsed), ` +
            `${narrowed} row(s) narrowed to accommodation`,
        counts: {
            amenitiesCreated: created.length,
            relationsMoved,
            relationsCollapsed,
            rowsNarrowed: narrowed
        }
    };
}
