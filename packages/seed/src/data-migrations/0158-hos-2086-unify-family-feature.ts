/**
 * @fileoverview
 * Data migration: 0158-hos-2086-unify-family-feature
 *
 * Dual-write counterpart (HOS-25) for the owner decision of 2026-11-09 (HOS-2086).
 * Two features meant the same thing: `family_suitable` ("Apto para familias",
 * accommodation) and `family_friendly` (venue and experience, since 0155).
 * The catalog now carries ONE item, `family_suitable`, for all three verticals.
 *
 * Three steps, in this order:
 *
 * 1. **Widen** `family_suitable.applicable_verticals` to
 *    `{accommodation, venue, experience}`.
 * 2. **Remap** every relation row of `family_friendly` (accommodation, venue,
 *    experience) onto `family_suitable`. Both rows are features, so the host's
 *    rewritten name and comments travel; owners are verified by the shared
 *    helper, which throws (rolling the transaction back) when one would be lost.
 * 3. **Retire** `family_friendly` with a soft delete, the way 0155 retires its
 *    rows.
 *
 * No 301 is needed: `family_friendly` never applied to accommodation, so it
 * never had a `/alojamientos/caracteristicas/` landing.
 *
 * ## Idempotency
 *
 * The widening writes only while a vertical is missing, the remap finds no
 * source rows once `family_friendly` is retired, and a retired source is skipped.
 *
 * ## `destructive` flag decision
 *
 * `true` -- the remap deletes the `family_friendly` link rows after moving them,
 * and the source row is soft-deleted.
 */
import { and, eq, features, isNull } from '@repo/db';
import { logger } from '../utils/logger.js';
import { CATALOG_VERTICALS, remapVerticalRelations } from './helpers/catalog-relation-remap.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0158-hos-2086-unify-family-feature',
    group: 'required',
    destructive: true,
    // HOS-433: the widening writes `applicable_verticals` (SPEC-266).
    requiresColumns: [{ table: 'features', column: 'applicable_verticals' }]
} as const satisfies SeedMigrationModule['meta'];

/** The survivor, applicable to all three verticals. */
export const SURVIVOR_SLUG = 'family_suitable';

/** The retired duplicate. */
export const RETIRED_SLUG = 'family_friendly';

/** Looks up the LIVE id and verticals of a feature by slug. */
async function findLive(
    ctx: SeedMigrationCtx,
    slug: string
): Promise<{ readonly id: string; readonly verticals: readonly string[] } | undefined> {
    const [row] = await ctx.db
        .select({ id: features.id, verticals: features.applicableVerticals })
        .from(features)
        .where(and(eq(features.slug, slug), isNull(features.deletedAt)));
    return row ? { id: row.id, verticals: row.verticals ?? [] } : undefined;
}

/**
 * Unifies the family feature on `family_suitable`.
 *
 * @param ctx - Migration context; `ctx.db` is transaction-scoped.
 * @returns A summary plus the count of every step.
 * @throws Error when the survivor is missing while the source still exists, or
 *   when the relation move would lose an owner (the runner rolls back).
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const survivor = await findLive(ctx, SURVIVOR_SLUG);
    const source = await findLive(ctx, RETIRED_SLUG);
    if (source && !survivor) {
        throw new Error(
            `HOS-2086: survivor feature '${SURVIVOR_SLUG}' does not exist, cannot retire '${RETIRED_SLUG}'`
        );
    }

    let rowsWidened = 0;
    if (survivor && CATALOG_VERTICALS.some((vertical) => !survivor.verticals.includes(vertical))) {
        await ctx.db
            .update(features)
            .set({ applicableVerticals: [...CATALOG_VERTICALS], updatedAt: new Date() })
            .where(eq(features.id, survivor.id));
        rowsWidened = 1;
    }

    let relationsMoved = 0;
    let relationsCollapsed = 0;
    let rowsRetired = 0;
    if (source && survivor) {
        for (const vertical of CATALOG_VERTICALS) {
            const counts = await remapVerticalRelations({
                db: ctx.db,
                vertical,
                source: { kind: 'feature', id: source.id },
                target: { kind: 'feature', id: survivor.id }
            });
            relationsMoved += counts.moved;
            relationsCollapsed += counts.collapsed;
            logger.info(
                `[0158] ${RETIRED_SLUG} -> ${SURVIVOR_SLUG} [${vertical}]: source ${counts.sourceBefore} -> 0, ` +
                    `moved ${counts.moved}, collapsed ${counts.collapsed}`
            );
        }
        const now = new Date();
        await ctx.db
            .update(features)
            .set({ deletedAt: now, deletedById: ctx.actor.id, updatedAt: now })
            .where(and(eq(features.id, source.id), isNull(features.deletedAt)));
        rowsRetired = 1;
    }

    return {
        summary:
            `HOS-2086 family feature unified: ${rowsWidened} row(s) widened, ` +
            `${relationsMoved} relation(s) moved (${relationsCollapsed} collapsed), ` +
            `${rowsRetired} row(s) retired`,
        counts: { rowsWidened, relationsMoved, relationsCollapsed, rowsRetired }
    };
}
