/**
 * @fileoverview
 * Data migration: 0155-hos-2061-venue-experience-catalog-curation
 *
 * Dual-write counterpart (HOS-25) for HOS-2061, stage 5 of the HOS-1016
 * catalog redesign: the owner-approved curation of the venue and experience
 * catalog (HOS-2061 comment of 2026-11-08). The rule (D-1): an AMENITY is
 * something the visitor USES, a FEATURE is what the place IS, a POLICY is a
 * rule of the place.
 *
 * Five steps, in this order:
 *
 * 1. **New rows** (5 amenities, 5 features), read from the very fixture files
 *    the baseline seeder reads, so the two paths cannot drift. `happy_hour`
 *    arrives here as a FEATURE (offer profile) before its amenity is merged
 *    into it in step 4.
 * 2. **Vertical widenings**: existing rows gain the verticals they now serve.
 *    A UNION, never an overwrite, so a vertical an admin added stays. Where an
 *    owner-requested item already existed under another slug (`high_chair`,
 *    `towels`, `couple_suitable`, `ideal_for_groups`, `river_front`), the
 *    existing row is widened instead of creating a duplicate.
 * 3. **Description rewrites** of the three widened rows whose text named the
 *    accommodation. Matched on the OLD Spanish text, so an edited description
 *    is never overwritten.
 * 4. **Merges**: `kid_friendly` into `family_friendly`, and the `happy_hour`
 *    amenity into the `happy_hour` feature. Every relation row moves to the
 *    survivor first (verified by the shared remap helper), then the source is
 *    SOFT-deleted (its slug stays taken).
 * 5. **Policy retirements**: `accepts_reservations` (venue amenity) and
 *    `private_available` (experience feature) duplicate the venue
 *    `policies.reservations` and the experience `policies.privateGroups`. A
 *    listing that linked the row gets the policy backfilled first, only where
 *    the policy key is still unset (a value the owner chose wins), then the
 *    links are removed and the row is soft-deleted, as 0154 did.
 *
 * Public landings of the retired slugs 301 through
 * `apps/web/src/lib/catalog-retired-slugs.ts`.
 *
 * ## Idempotency
 *
 * - New rows are inserted `ON CONFLICT (slug) DO NOTHING`.
 * - A widening is a set union; re-running adds nothing.
 * - A description rewrite matches only the old text.
 * - A merge or retirement whose source has no live row is skipped.
 *
 * ## `destructive` flag decision
 *
 * `true` -- relation rows are deleted. The amenity-to-feature move of
 * `happy_hour` cannot carry relation attributes (counted in
 * `attributesDropped`), and the retired policy rows lose their links once the
 * policy is backfilled. Production therefore requires the explicit opt-in.
 * Prod and staging held 0 links on every affected row on 2026-11-08.
 */
import { amenities, and, eq, features, isNull, sql } from '@repo/db';
import { AmenitiesTypeEnumSchema, FeatureCategoryEnumSchema, i18nText } from '@repo/schemas';
import { z } from 'zod';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import {
    CATALOG_VERTICALS,
    type CatalogKind,
    type CatalogVertical,
    remapVerticalRelations,
    type VerticalRemapCounts
} from './helpers/catalog-relation-remap.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0155-hos-2061-venue-experience-catalog-curation',
    group: 'required',
    destructive: true,
    // HOS-433: the policy backfill writes `policies` (HOS-2060) and the new
    // feature rows write `features.category` (HOS-2058).
    requiresColumns: [
        { table: 'venues', column: 'policies' },
        { table: 'experiences', column: 'policies' },
        { table: 'features', column: 'category' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/** New amenity fixtures. A FIXED list: a later row ships its own migration. */
export const NEW_AMENITY_FIXTURE_FILES: readonly string[] = [
    '174-amenity-outdoors-outdoor-tables.json',
    '175-amenity-family-friendly-baby-changing-table.json',
    '176-amenity-general-appliances-boat-included.json',
    '177-amenity-services-changing-rooms.json',
    '178-amenity-safety-life-jacket-included.json'
];

/** New feature fixtures, `happy_hour` included (the survivor of its amenity). */
export const NEW_FEATURE_FIXTURE_FILES: readonly string[] = [
    '115-feature-happy_hour.json',
    '116-feature-thermal_waters.json',
    '117-feature-birdwatching.json',
    '118-feature-island_setting.json',
    '119-feature-parrilla_cuisine.json'
];

/** A catalog row named by table and slug. */
export interface CatalogSlugRef {
    readonly kind: CatalogKind;
    readonly slug: string;
}

/** A row that gains verticals (set union). */
export interface CatalogVerticalWidening {
    readonly row: CatalogSlugRef;
    readonly add: readonly CatalogVertical[];
}

const amenity = (slug: string): CatalogSlugRef => ({ kind: 'amenity', slug });
const feature = (slug: string): CatalogSlugRef => ({ kind: 'feature', slug });

/** Items 2, 5 and 6 of the owner decision. */
export const VERTICAL_WIDENINGS: readonly CatalogVerticalWidening[] = [
    { row: feature('river_view'), add: ['venue', 'experience'] },
    { row: feature('river_access'), add: ['venue', 'experience'] },
    { row: feature('family_friendly'), add: ['experience'] },
    // Owner-requested items that already existed under another slug.
    { row: amenity('high_chair'), add: ['venue'] },
    { row: amenity('towels'), add: ['experience'] },
    { row: feature('couple_suitable'), add: ['experience'] },
    { row: feature('ideal_for_groups'), add: ['venue', 'experience'] },
    { row: feature('river_front'), add: ['venue'] }
];

/** A description rewritten only while it still holds the old Spanish text. */
export interface FeatureDescriptionRewrite {
    readonly slug: string;
    readonly oldEs: string;
    readonly next: { readonly es: string; readonly en: string; readonly pt: string };
}

/** Widened rows whose description named the accommodation. */
export const FEATURE_DESCRIPTION_REWRITES: readonly FeatureDescriptionRewrite[] = [
    {
        slug: 'ideal_for_groups',
        oldEs: 'Capacidad y distribución de espacios optimizada para grupos grandes, con áreas comunes amplias y múltiples habitaciones',
        next: {
            es: 'Espacios y propuesta pensados para grupos grandes',
            en: 'Spaces and offer designed for large groups',
            pt: 'Espaços e proposta pensados para grupos grandes'
        }
    },
    {
        slug: 'river_access',
        oldEs: 'Acceso directo al río desde el alojamiento',
        next: {
            es: 'Acceso directo al río desde el lugar',
            en: 'Direct access to the river from the place',
            pt: 'Acesso direto ao rio a partir do local'
        }
    },
    {
        slug: 'river_view',
        oldEs: 'Vista al río desde el alojamiento',
        next: {
            es: 'Vista al río desde el lugar',
            en: 'River view from the place',
            pt: 'Vista para o rio a partir do local'
        }
    }
];

/** One retired catalog row and the survivor its relations move to. */
export interface CatalogMerge {
    readonly source: CatalogSlugRef;
    readonly target: CatalogSlugRef;
}

/** Items 2 and 3 of the owner decision. */
export const CATALOG_MERGES: readonly CatalogMerge[] = [
    { source: feature('kid_friendly'), target: feature('family_friendly') },
    { source: amenity('happy_hour'), target: feature('happy_hour') }
];

/** Amenity slugs retired into `policies` (item 1). */
export const RETIRED_POLICY_AMENITY_SLUGS: readonly string[] = ['accepts_reservations'] as const;

/** Feature slugs retired into `policies` (item 1). */
export const RETIRED_POLICY_FEATURE_SLUGS: readonly string[] = ['private_available'] as const;

/** Same bounds as the amenity/feature service schemas (10-500 per locale). */
const I18nTextSchema = i18nText({ min: 10, max: 500 });

const AmenityFixtureSchema = z.object({
    slug: z.string().min(1),
    description: I18nTextSchema,
    applicableVerticals: z.array(z.enum(['accommodation', 'venue', 'experience'])).min(1),
    type: AmenitiesTypeEnumSchema,
    icon: z.string().min(1),
    isBuiltin: z.boolean(),
    isFeatured: z.boolean(),
    displayWeight: z.number().int()
});

const FeatureFixtureSchema = AmenityFixtureSchema.omit({ type: true }).extend({
    category: FeatureCategoryEnumSchema
});

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

/** Looks up the LIVE (not soft-deleted) id of a catalog row by slug. */
async function findLiveId(ctx: SeedMigrationCtx, ref: CatalogSlugRef): Promise<string | undefined> {
    const rows =
        ref.kind === 'amenity'
            ? await ctx.db
                  .select({ id: amenities.id })
                  .from(amenities)
                  .where(and(eq(amenities.slug, ref.slug), isNull(amenities.deletedAt)))
            : await ctx.db
                  .select({ id: features.id })
                  .from(features)
                  .where(and(eq(features.slug, ref.slug), isNull(features.deletedAt)));
    return rows[0]?.id;
}

/** Inserts the new fixture rows that are not there yet. */
async function insertNewRows(
    ctx: SeedMigrationCtx
): Promise<{ readonly amenities: number; readonly features: number }> {
    const amenityRows = (
        await loadJsonFiles<unknown>('src/data/amenity', [...NEW_AMENITY_FIXTURE_FILES])
    ).map((raw) => AmenityFixtureSchema.parse(raw));
    const featureRows = (
        await loadJsonFiles<unknown>('src/data/feature', [...NEW_FEATURE_FIXTURE_FILES])
    ).map((raw) => FeatureFixtureSchema.parse(raw));

    const createdAmenities = await ctx.db
        .insert(amenities)
        .values(amenityRows)
        .onConflictDoNothing({ target: amenities.slug })
        .returning({ id: amenities.id });
    const createdFeatures = await ctx.db
        .insert(features)
        .values(featureRows)
        .onConflictDoNothing({ target: features.slug })
        .returning({ id: features.id });

    return { amenities: createdAmenities.length, features: createdFeatures.length };
}

/** Reads a live row's verticals, or undefined when it has no live row. */
async function readVerticals(
    ctx: SeedMigrationCtx,
    ref: CatalogSlugRef
): Promise<{ readonly id: string; readonly verticals: readonly string[] } | undefined> {
    const rows =
        ref.kind === 'amenity'
            ? await ctx.db
                  .select({ id: amenities.id, verticals: amenities.applicableVerticals })
                  .from(amenities)
                  .where(and(eq(amenities.slug, ref.slug), isNull(amenities.deletedAt)))
            : await ctx.db
                  .select({ id: features.id, verticals: features.applicableVerticals })
                  .from(features)
                  .where(and(eq(features.slug, ref.slug), isNull(features.deletedAt)));
    const [row] = rows;
    return row ? { id: row.id, verticals: row.verticals ?? [] } : undefined;
}

/**
 * Adds verticals to one live row (set union, canonical order). Returns 1 when
 * the row changed, 0 when it already had them or has no live row.
 */
async function widenRow(ctx: SeedMigrationCtx, widening: CatalogVerticalWidening): Promise<number> {
    const current = await readVerticals(ctx, widening.row);
    if (!current) return 0;
    const have = new Set<string>(current.verticals);
    if (widening.add.every((vertical) => have.has(vertical))) return 0;
    for (const vertical of widening.add) have.add(vertical);
    const next = CATALOG_VERTICALS.filter((vertical) => have.has(vertical));
    const updatedAt = new Date();
    if (widening.row.kind === 'amenity') {
        await ctx.db
            .update(amenities)
            .set({ applicableVerticals: next, updatedAt })
            .where(eq(amenities.id, current.id));
    } else {
        await ctx.db
            .update(features)
            .set({ applicableVerticals: next, updatedAt })
            .where(eq(features.id, current.id));
    }
    return 1;
}

/** Soft-deletes one catalog row, stamping the migration actor. */
async function retireRow(
    ctx: SeedMigrationCtx,
    kind: CatalogKind,
    id: string,
    now: Date
): Promise<void> {
    const deletedById = ctx.actor.id;
    if (kind === 'amenity') {
        await ctx.db
            .update(amenities)
            .set({ deletedAt: now, deletedById, updatedAt: now })
            .where(and(eq(amenities.id, id), isNull(amenities.deletedAt)));
        return;
    }
    await ctx.db
        .update(features)
        .set({ deletedAt: now, deletedById, updatedAt: now })
        .where(and(eq(features.id, id), isNull(features.deletedAt)));
}

const ZERO_COUNTS: VerticalRemapCounts = {
    sourceBefore: 0,
    targetBefore: 0,
    targetAfter: 0,
    moved: 0,
    collapsed: 0,
    collapsedWithAttributes: 0,
    attributesFilled: 0,
    attributesDropped: 0
};

const addCounts = (total: VerticalRemapCounts, next: VerticalRemapCounts): VerticalRemapCounts => ({
    sourceBefore: total.sourceBefore + next.sourceBefore,
    targetBefore: total.targetBefore + next.targetBefore,
    targetAfter: total.targetAfter + next.targetAfter,
    moved: total.moved + next.moved,
    collapsed: total.collapsed + next.collapsed,
    collapsedWithAttributes: total.collapsedWithAttributes + next.collapsedWithAttributes,
    attributesFilled: total.attributesFilled + next.attributesFilled,
    attributesDropped: total.attributesDropped + next.attributesDropped
});

/** Moves one merge's relations across the three verticals, then retires the source. */
async function applyMerge(
    ctx: SeedMigrationCtx,
    merge: CatalogMerge,
    now: Date
): Promise<VerticalRemapCounts | undefined> {
    const sourceId = await findLiveId(ctx, merge.source);
    if (!sourceId) return undefined;
    const targetId = await findLiveId(ctx, merge.target);
    if (!targetId) {
        throw new Error(
            `HOS-2061: merge target ${merge.target.kind} '${merge.target.slug}' for ${merge.source.kind} '${merge.source.slug}' does not exist`
        );
    }
    let total = ZERO_COUNTS;
    for (const vertical of CATALOG_VERTICALS) {
        const counts = await remapVerticalRelations({
            db: ctx.db,
            vertical,
            source: { kind: merge.source.kind, id: sourceId },
            target: { kind: merge.target.kind, id: targetId }
        });
        if (counts.sourceBefore > 0) {
            logger.info(
                `HOS-2061 ${merge.source.kind}:${merge.source.slug} -> ${merge.target.kind}:${merge.target.slug} [${vertical}] ` +
                    `source ${counts.sourceBefore} -> 0, target ${counts.targetBefore} -> ${counts.targetAfter} ` +
                    `(moved ${counts.moved}, collapsed ${counts.collapsed}, attributes dropped ${counts.attributesDropped})`
            );
        }
        total = addCounts(total, counts);
    }
    await retireRow(ctx, merge.source.kind, sourceId, now);
    return total;
}

/**
 * Backfills the policy a retired row stood in for, on the listings that
 * linked it, only where the policy key is unset or null.
 *
 * A `policies` value that is not a JSON object (SQL NULL, or a JSON `null`
 * scalar that COALESCE does not replace) is normalized to `{}` first:
 * `jsonb_set` on a scalar aborts the whole migration with "cannot set path in
 * scalar".
 */
async function backfillPolicy(
    ctx: SeedMigrationCtx,
    ref: CatalogSlugRef,
    id: string
): Promise<number> {
    if (ref.kind === 'amenity' && ref.slug === 'accepts_reservations') {
        // The row said reservations are accepted, not that they are required.
        const result = await ctx.db.execute(sql`
            UPDATE venues v
            SET policies = jsonb_set(CASE WHEN v.policies IS NULL OR jsonb_typeof(v.policies) <> 'object' THEN '{}'::jsonb ELSE v.policies END, '{reservations}', '"recommended"'::jsonb)
            WHERE EXISTS (SELECT 1 FROM r_venue_amenity r WHERE r.venue_id = v.id AND r.amenity_id = ${id})
              AND COALESCE(v.policies -> 'reservations', 'null'::jsonb) = 'null'::jsonb
        `);
        return result.rowCount ?? 0;
    }
    if (ref.kind === 'feature' && ref.slug === 'private_available') {
        const result = await ctx.db.execute(sql`
            UPDATE experiences e
            SET policies = jsonb_set(CASE WHEN e.policies IS NULL OR jsonb_typeof(e.policies) <> 'object' THEN '{}'::jsonb ELSE e.policies END, '{privateGroups}', 'true'::jsonb)
            WHERE EXISTS (SELECT 1 FROM r_experience_feature r WHERE r.experience_id = e.id AND r.feature_id = ${id})
              AND COALESCE(e.policies -> 'privateGroups', 'null'::jsonb) = 'null'::jsonb
        `);
        return result.rowCount ?? 0;
    }
    return 0;
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

/**
 * Applies the HOS-2061 venue/experience catalog curation.
 *
 * @param ctx - Migration context; `ctx.db` is transaction-scoped and
 *   `ctx.actor` stamps the soft deletes.
 * @returns A summary plus the count of every step.
 * @throws Error when a merge target is missing, or when a relation move would
 *   lose an owner (the runner then rolls the transaction back).
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const created = await insertNewRows(ctx);

    let rowsWidened = 0;
    for (const widening of VERTICAL_WIDENINGS) rowsWidened += await widenRow(ctx, widening);

    let descriptionsRewritten = 0;
    for (const rewrite of FEATURE_DESCRIPTION_REWRITES) {
        const rows = await ctx.db
            .update(features)
            .set({ description: { ...rewrite.next }, updatedAt: new Date() })
            .where(
                and(
                    eq(features.slug, rewrite.slug),
                    isNull(features.deletedAt),
                    sql`${features.description} ->> 'es' = ${rewrite.oldEs}`
                )
            )
            .returning({ id: features.id });
        descriptionsRewritten += rows.length;
    }

    const now = new Date();
    let rowsMerged = 0;
    let mergesSkipped = 0;
    let total = ZERO_COUNTS;
    for (const merge of CATALOG_MERGES) {
        const counts = await applyMerge(ctx, merge, now);
        if (!counts) {
            mergesSkipped += 1;
            continue;
        }
        rowsMerged += 1;
        total = addCounts(total, counts);
    }

    let policyRowsRetired = 0;
    let policyRowsSkipped = 0;
    let policiesBackfilled = 0;
    let policyLinksRemoved = 0;
    const policyTargets = [
        ...RETIRED_POLICY_AMENITY_SLUGS.map((slug) => amenity(slug)),
        ...RETIRED_POLICY_FEATURE_SLUGS.map((slug) => feature(slug))
    ];
    for (const ref of policyTargets) {
        const id = await findLiveId(ctx, ref);
        if (!id) {
            policyRowsSkipped += 1;
            continue;
        }
        policiesBackfilled += await backfillPolicy(ctx, ref, id);
        const removed = await removeLinks(ctx, ref.kind, id);
        await retireRow(ctx, ref.kind, id, now);
        logger.info(`[0155] retired ${ref.kind} ${ref.slug}: ${removed} link(s) removed`);
        policyLinksRemoved += removed;
        policyRowsRetired += 1;
    }

    return {
        summary:
            `HOS-2061 catalog curation: ${created.amenities} amenity(ies) and ${created.features} feature(s) created, ` +
            `${rowsWidened} widened, ${descriptionsRewritten} description(s) rewritten, ${rowsMerged} merged ` +
            `(${mergesSkipped} already gone; ${total.moved} relation(s) moved, ${total.collapsed} collapsed, ` +
            `${total.attributesDropped} attribute(s) dropped), ${policyRowsRetired} policy row(s) retired ` +
            `(${policyRowsSkipped} already gone; ${policiesBackfilled} policy backfill(s), ${policyLinksRemoved} link(s) removed)`,
        counts: {
            amenitiesCreated: created.amenities,
            featuresCreated: created.features,
            rowsWidened,
            descriptionsRewritten,
            rowsMerged,
            mergesSkipped,
            relationsMoved: total.moved,
            relationsCollapsed: total.collapsed,
            attributesDropped: total.attributesDropped,
            policyRowsRetired,
            policyRowsSkipped,
            policiesBackfilled,
            policyLinksRemoved
        }
    };
}
