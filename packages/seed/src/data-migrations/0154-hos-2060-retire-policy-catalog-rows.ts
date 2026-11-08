/**
 * @fileoverview
 * Data migration: 0154-hos-2060-retire-policy-catalog-rows
 *
 * Dual-write counterpart (HOS-25) for HOS-2060, stage 4 of the HOS-1016
 * catalog redesign: house rules are `policies` now, so the catalog rows that
 * used to stand in for them are retired.
 *
 * Retired AMENITIES: `pet_friendly`, `smoke_free`, `accepts_cards`,
 * `private_events`. Retired FEATURES: `pet_suitable`, `pet_friendly_area`,
 * `autonomous_checkin`, `minimum_stay_required`, `smoking_area`.
 *
 * Unlike the HOS-2059 merges (0147) there is no survivor row: the signal these
 * rows carried was folded into `policies` by the schema migration
 * `0194_hos_2060_listing_policies.sql`, which `db:migrate` applies before any
 * `db:seed:migrate` step. So this migration only removes the relation rows of
 * every vertical and then SOFT-deletes the catalog row (its slug stays taken,
 * and the public landing 301s, see `apps/web/src/lib/catalog-retired-slugs.ts`).
 *
 * The baseline gets the same end state: the nine fixtures are gone from
 * `src/data/{amenity,feature}` and from `manifest-required.json`.
 *
 * ## Idempotency
 *
 * A slug with no live row (already retired, or never seeded) is skipped.
 *
 * ## `destructive` flag decision
 *
 * `true` -- relation rows are deleted. Seven of the nine rows were folded into
 * `policies` first, but `autonomous_checkin` and `minimum_stay_required` have
 * no policy equivalent that the backfill could fill from a bare tick (the
 * check-in window and the minimum stay need a value), so those links are lost.
 * Production therefore requires the explicit opt-in.
 */
import { amenities, and, eq, features, isNull, sql } from '@repo/db';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0154-hos-2060-retire-policy-catalog-rows',
    group: 'required',
    destructive: true,
    // HOS-433: the retirement assumes the policies backfill already ran.
    requiresColumns: [
        { table: 'accommodations', column: 'policies' },
        { table: 'venues', column: 'policies' },
        { table: 'experiences', column: 'policies' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/** Amenity slugs retired by HOS-2060. A FIXED list: a later retirement ships its own migration. */
export const RETIRED_POLICY_AMENITY_SLUGS: readonly string[] = [
    'pet_friendly',
    'smoke_free',
    'accepts_cards',
    'private_events'
] as const;

/** Feature slugs retired by HOS-2060. */
export const RETIRED_POLICY_FEATURE_SLUGS: readonly string[] = [
    'pet_suitable',
    'pet_friendly_area',
    'autonomous_checkin',
    'minimum_stay_required',
    'smoking_area'
] as const;

type CatalogKind = 'amenity' | 'feature';

/** The relation tables of each catalog kind, one per vertical. Constants, never input. */
const RELATION_TABLES: Readonly<
    Record<CatalogKind, readonly { readonly table: string; readonly fk: string }[]>
> = {
    amenity: [
        { table: 'r_accommodation_amenity', fk: 'amenity_id' },
        { table: 'r_venue_amenity', fk: 'amenity_id' },
        { table: 'r_experience_amenity', fk: 'amenity_id' }
    ],
    feature: [
        { table: 'r_accommodation_feature', fk: 'feature_id' },
        { table: 'r_venue_feature', fk: 'feature_id' },
        { table: 'r_experience_feature', fk: 'feature_id' }
    ]
};

/** Finds the live row of `slug`, or undefined when it is already retired or absent. */
async function findLiveId(
    ctx: SeedMigrationCtx,
    kind: CatalogKind,
    slug: string
): Promise<string | undefined> {
    switch (kind) {
        case 'amenity': {
            const [row] = await ctx.db
                .select({ id: amenities.id })
                .from(amenities)
                .where(and(eq(amenities.slug, slug), isNull(amenities.deletedAt)));
            return row?.id;
        }
        case 'feature': {
            const [row] = await ctx.db
                .select({ id: features.id })
                .from(features)
                .where(and(eq(features.slug, slug), isNull(features.deletedAt)));
            return row?.id;
        }
        default: {
            const unknownKind: never = kind;
            throw new Error(`Unknown catalog kind: ${String(unknownKind)}`);
        }
    }
}

/** Deletes every relation row of one catalog row, across the three verticals. */
async function removeLinks(ctx: SeedMigrationCtx, kind: CatalogKind, id: string): Promise<number> {
    let removed = 0;
    for (const { table, fk } of RELATION_TABLES[kind]) {
        const result = await ctx.db.execute(
            sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.identifier(fk)} = ${id}`
        );
        removed += result.rowCount ?? 0;
    }
    return removed;
}

/** Soft-deletes one catalog row, stamping the migration actor. */
async function retireRow(
    ctx: SeedMigrationCtx,
    kind: CatalogKind,
    id: string,
    now: Date
): Promise<void> {
    const deletedById = ctx.actor.id;
    switch (kind) {
        case 'amenity':
            await ctx.db
                .update(amenities)
                .set({ deletedAt: now, deletedById, updatedAt: now })
                .where(and(eq(amenities.id, id), isNull(amenities.deletedAt)));
            return;
        case 'feature':
            await ctx.db
                .update(features)
                .set({ deletedAt: now, deletedById, updatedAt: now })
                .where(and(eq(features.id, id), isNull(features.deletedAt)));
            return;
        default: {
            const unknownKind: never = kind;
            throw new Error(`Unknown catalog kind: ${String(unknownKind)}`);
        }
    }
}

/**
 * Retires the HOS-2060 policy catalog rows.
 *
 * @param ctx - Migration context; `ctx.db` is transaction-scoped and
 *   `ctx.actor` stamps the soft deletes.
 * @returns A summary plus the rows retired, skipped and links removed.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const now = new Date();
    const targets: readonly { readonly kind: CatalogKind; readonly slug: string }[] = [
        ...RETIRED_POLICY_AMENITY_SLUGS.map((slug) => ({ kind: 'amenity' as const, slug })),
        ...RETIRED_POLICY_FEATURE_SLUGS.map((slug) => ({ kind: 'feature' as const, slug }))
    ];
    let rowsRetired = 0;
    let rowsSkipped = 0;
    let linksRemoved = 0;
    for (const { kind, slug } of targets) {
        const id = await findLiveId(ctx, kind, slug);
        if (!id) {
            rowsSkipped += 1;
            continue;
        }
        const removed = await removeLinks(ctx, kind, id);
        await retireRow(ctx, kind, id, now);
        logger.info(`[0154] retired ${kind} ${slug}: ${removed} link(s) removed`);
        linksRemoved += removed;
        rowsRetired += 1;
    }
    return {
        summary: `HOS-2060: ${rowsRetired} policy catalog row(s) retired (${rowsSkipped} already gone), ${linksRemoved} link(s) removed`,
        counts: { rowsRetired, rowsSkipped, linksRemoved }
    };
}
