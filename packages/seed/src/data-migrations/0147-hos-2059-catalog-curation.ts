/**
 * @fileoverview
 * Data migration: 0147-hos-2059-catalog-curation
 *
 * Dual-write counterpart (HOS-25) for HOS-2059, stage 3 of the HOS-1016
 * catalog redesign: the owner-approved curation of the accommodation amenity
 * and feature catalog (HOS-2059 comments of 2026-11-06, sections 1, 3, 4 and
 * 5; section 2, the policies, belongs to HOS-2060).
 *
 * The rule the curation applies (D-1): an AMENITY is something the guest
 * USES, a FEATURE is what the place IS, and a POLICY is a rule of the place.
 *
 * Five changes reach already-seeded environments, in this order:
 *
 * 1. **New rows** (60 amenities, 6 features), read from the very fixture files
 *    the baseline seeder reads, so the two paths cannot drift.
 * 2. **Retypes** of eight amenities to a better group, by slug.
 * 3. **Slug rename** `spa_front` -> `balneario_front` (same row, same links).
 * 4. **Vertical widening** of `panoramic_view_extended`, which absorbs the
 *    `panoramic_view` amenity and with it that amenity's verticals.
 * 5. **Merges**: nineteen rows are retired into a survivor. Every relation row
 *    (accommodation, venue and experience) moves to the survivor first, with
 *    its attributes when both rows are of the same kind, and with the forced
 *    `scope` where the duplicate encoded one (`shared_kitchen` becomes
 *    `full_kitchen` with `scope = shared`). The helper verifies that no owner
 *    lost the item and throws otherwise, so a loss rolls the transaction back.
 *    Only then is the retired catalog row SOFT-deleted (its slug stays taken).
 *
 * The baseline gets the same end state: the new fixtures exist, the retyped
 * and renamed fixtures carry their new values, and the retired fixtures are
 * gone from `src/data/{amenity,feature}` and from `manifest-required.json`.
 * Fixture ids and file names of surviving rows are NOT renamed: they are
 * deterministic keys the example accommodations reference.
 *
 * ## Idempotency
 *
 * - A new row is inserted `ON CONFLICT (slug) DO NOTHING`.
 * - A retype matches only while the row still holds the OLD type.
 * - The rename matches only while a live `spa_front` exists.
 * - A merge whose source is already gone (or soft-deleted) is skipped.
 *
 * ## `destructive` flag decision
 *
 * `true` -- relation rows of the retired catalog rows are deleted after being
 * copied onto the survivor, and that copy is lossy in two counted ways:
 *
 * - A cross-kind move cannot carry the relation's attributes (cost, scope,
 *   host notes); each such row is counted in `attributesDropped`.
 * - When the listing already linked the survivor, the survivor row is kept
 *   and only its NULL attributes are filled from the source (or the forced
 *   scope). A value the survivor already declared wins over the source's, and
 *   `isOptional` (NOT NULL) is never filled, so a source attribute can lose to
 *   the survivor's. Those collapses are counted in `collapsedWithAttributes`,
 *   and the survivor rows actually changed in `attributesFilled`; the logged
 *   numbers say how many collapses could have lost something, not exactly
 *   which value lost.
 *
 * The copy is verified before the delete, but the change cannot be undone from
 * the data alone, so production requires the explicit opt-in.
 */
import { amenities, and, eq, features, isNull } from '@repo/db';
import {
    type AmenitiesTypeEnum,
    AmenitiesTypeEnumSchema,
    type AmenityScopeEnum,
    FeatureCategoryEnumSchema,
    i18nText
} from '@repo/schemas';
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
    name: '0147-hos-2059-catalog-curation',
    group: 'required',
    destructive: true,
    // HOS-433: the merges write `r_accommodation_amenity.scope` and the new
    // feature rows write `features.category`; both columns arrive with HOS-2058.
    requiresColumns: [
        { table: 'r_accommodation_amenity', column: 'scope' },
        { table: 'features', column: 'category' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * New amenity fixtures: section 4, plus the two services moved out of the
 * features (section 5). A FIXED list on purpose: a later catalog row ships its
 * own migration instead of being swept into this one.
 */
export const NEW_AMENITY_FIXTURE_FILES: readonly string[] = [
    '114-amenity-entertainment-streaming-services.json',
    '115-amenity-entertainment-outdoor-games.json',
    '116-amenity-entertainment-hammocks.json',
    '117-amenity-entertainment-pool-toys.json',
    '118-amenity-entertainment-soccer-field.json',
    '119-amenity-entertainment-volleyball-court.json',
    '120-amenity-entertainment-tennis-court.json',
    '121-amenity-entertainment-padel-court.json',
    '122-amenity-entertainment-basketball-court.json',
    '123-amenity-entertainment-sports-balls.json',
    '124-amenity-entertainment-ping-pong-table.json',
    '125-amenity-entertainment-foosball-table.json',
    '126-amenity-entertainment-pool-table.json',
    '127-amenity-entertainment-game-console.json',
    '128-amenity-entertainment-bluetooth-speaker.json',
    '129-amenity-kitchen-full-tableware.json',
    '130-amenity-kitchen-griddle.json',
    '131-amenity-kitchen-plow-disc-grill.json',
    '132-amenity-kitchen-gas-burner.json',
    '133-amenity-kitchen-freezer.json',
    '134-amenity-kitchen-oven.json',
    '135-amenity-kitchen-dishwasher.json',
    '136-amenity-kitchen-toaster.json',
    '137-amenity-kitchen-grill-utensils.json',
    '138-amenity-bed-and-bath-shampoo.json',
    '139-amenity-bed-and-bath-conditioner.json',
    '140-amenity-bed-and-bath-hand-towels.json',
    '141-amenity-bed-and-bath-bath-towels.json',
    '142-amenity-bed-and-bath-pool-towels.json',
    '143-amenity-bed-and-bath-bidet.json',
    '144-amenity-bed-and-bath-mosquito-nets.json',
    '145-amenity-climate-control-bathroom-underfloor-heating.json',
    '146-amenity-climate-control-underfloor-heating.json',
    '147-amenity-climate-control-gas-heater.json',
    '148-amenity-climate-control-electric-heater.json',
    '149-amenity-general-appliances-tankless-water-heater.json',
    '150-amenity-outdoors-gazebo.json',
    '151-amenity-outdoors-sun-umbrella.json',
    '152-amenity-outdoors-trestle-tables.json',
    '153-amenity-outdoors-outdoor-chairs.json',
    '154-amenity-outdoors-deck.json',
    '155-amenity-outdoors-dock.json',
    '156-amenity-outdoors-boat-moorings.json',
    '157-amenity-outdoors-boat-ramp.json',
    '158-amenity-accessibility-shower-grab-bars.json',
    '159-amenity-accessibility-adapted-bathroom.json',
    '160-amenity-accessibility-access-ramp.json',
    '161-amenity-accessibility-ground-floor-room.json',
    '162-amenity-accessibility-step-free-shower.json',
    '163-amenity-services-onsite-store.json',
    '164-amenity-services-transfer-service.json',
    '165-amenity-services-vehicle-rental.json',
    '166-amenity-laundry-clothesline.json',
    '167-amenity-wellness-hydromassage-bathtub.json',
    '168-amenity-safety-pool-fence.json',
    '169-amenity-safety-alarm-system.json',
    '170-amenity-safety-security-cameras.json',
    '171-amenity-family-friendly-baby-bathtub.json',
    '172-amenity-work-friendly-desk.json',
    '173-amenity-work-friendly-ergonomic-chair.json'
];

/** New feature fixtures: the river view and river access moved out of amenities, and four views. */
export const NEW_FEATURE_FIXTURE_FILES: readonly string[] = [
    '109-feature-river_view.json',
    '110-feature-river_access.json',
    '111-feature-lagoon_view.json',
    '112-feature-stream_view.json',
    '113-feature-countryside_view.json',
    '114-feature-pool_view.json'
];

/** One amenity retype: the slug, the type it must still hold, and the new type. */
export interface AmenityRetype {
    readonly slug: string;
    readonly from: `${AmenitiesTypeEnum}`;
    readonly to: `${AmenitiesTypeEnum}`;
}

/** Section 1: amenities that only change group. */
export const AMENITY_RETYPES: readonly AmenityRetype[] = [
    { slug: 'hair_dryer', from: 'CLIMATE_CONTROL', to: 'BED_AND_BATH' },
    { slug: 'tv_per_room', from: 'CONNECTIVITY', to: 'ENTERTAINMENT' },
    { slug: 'smart_tv', from: 'CONNECTIVITY', to: 'ENTERTAINMENT' },
    { slug: 'cable_tv', from: 'CONNECTIVITY', to: 'ENTERTAINMENT' },
    { slug: 'fireplace', from: 'OUTDOORS', to: 'CLIMATE_CONTROL' },
    { slug: 'blackout_curtains', from: 'BED_AND_BATH', to: 'GENERAL_APPLIANCES' },
    // The owner offered "Entretenimiento o Exteriores": ENTERTAINMENT, because
    // bikes are leisure gear the guest uses, not an outdoor space.
    { slug: 'bicycles', from: 'GENERAL_APPLIANCES', to: 'ENTERTAINMENT' },
    { slug: 'outdoor_lighting', from: 'GENERAL_APPLIANCES', to: 'OUTDOORS' }
];

/** One feature slug rename: same row, same relations, new slug. */
export interface FeatureSlugRename {
    readonly from: string;
    readonly to: string;
}

/** Section 5: the misnamed `spa_front` ("Frente al balneario"). */
export const FEATURE_SLUG_RENAMES: readonly FeatureSlugRename[] = [
    { from: 'spa_front', to: 'balneario_front' }
];

/** A feature that takes over the verticals of a row merged into it. */
export interface FeatureVerticalWidening {
    readonly slug: string;
    readonly verticals: readonly CatalogVertical[];
}

/** `panoramic_view_extended` absorbs `panoramic_view`, which applied to all three verticals. */
export const FEATURE_VERTICAL_WIDENINGS: readonly FeatureVerticalWidening[] = [
    { slug: 'panoramic_view_extended', verticals: ['accommodation', 'venue', 'experience'] }
];

/** A catalog row named by table and slug. */
export interface CatalogSlugRef {
    readonly kind: CatalogKind;
    readonly slug: string;
}

/** One retired catalog row and the survivor its relations move to. */
export interface CatalogMerge {
    readonly source: CatalogSlugRef;
    readonly target: CatalogSlugRef;
    /** Scope forced onto the moved accommodation-amenity relations. */
    readonly scope?: `${AmenityScopeEnum}`;
}

const amenity = (slug: string): CatalogSlugRef => ({ kind: 'amenity', slug });
const feature = (slug: string): CatalogSlugRef => ({ kind: 'feature', slug });

/** Sections 1, 3, 4 and 5: every retired row and its survivor. */
export const CATALOG_MERGES: readonly CatalogMerge[] = [
    // Section 1: what the place IS becomes a feature.
    { source: amenity('river_view'), target: feature('river_view') },
    { source: amenity('river_access'), target: feature('river_access') },
    { source: amenity('panoramic_view'), target: feature('panoramic_view_extended') },
    // Section 3: duplicates. The three pet rows are left to HOS-2060.
    { source: amenity('shared_kitchen'), target: amenity('full_kitchen'), scope: 'shared' },
    { source: amenity('shared_patio'), target: amenity('patio'), scope: 'shared' },
    { source: feature('laundry_service'), target: amenity('laundry_service') },
    { source: feature('luggage_storage'), target: amenity('luggage_storage') },
    { source: feature('wifi_full_property'), target: amenity('wifi') },
    { source: feature('satellite_wifi'), target: amenity('wifi') },
    { source: feature('internal_parking'), target: amenity('parking') },
    { source: feature('perimeter_lighting'), target: amenity('outdoor_lighting') },
    { source: feature('disability_accessible'), target: amenity('wheelchair_accessible') },
    { source: feature('remote_coworking_suitable'), target: amenity('coworking_space') },
    { source: feature('camping_sector'), target: feature('camping_area') },
    { source: feature('private_grill'), target: amenity('bbq_grill'), scope: 'private' },
    { source: feature('covered_barbecue_area'), target: amenity('quincho') },
    // Section 4: "Gazebo y Sombrilla por separado" -- the combined row becomes the gazebo.
    { source: amenity('umbrella_gazebo'), target: amenity('gazebo') },
    // Section 5: the services out of the "Perfil de la oferta" drawer.
    { source: feature('transfer_service'), target: amenity('transfer_service') },
    { source: feature('vehicle_rental'), target: amenity('vehicle_rental') }
];

/**
 * Same bounds as the amenity/feature service schemas (10-500 per locale). This
 * migration inserts directly, so without them a description the fresh-DB seed
 * (which goes through the service) rejects would still pass here.
 */
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

/** Soft-deletes one retired catalog row, stamping the migration actor. */
async function retireRow(
    ctx: SeedMigrationCtx,
    kind: CatalogKind,
    id: string,
    now: Date
): Promise<number> {
    const deletedById = ctx.actor.id;
    const rows =
        kind === 'amenity'
            ? await ctx.db
                  .update(amenities)
                  .set({ deletedAt: now, deletedById, updatedAt: now })
                  .where(and(eq(amenities.id, id), isNull(amenities.deletedAt)))
                  .returning({ id: amenities.id })
            : await ctx.db
                  .update(features)
                  .set({ deletedAt: now, deletedById, updatedAt: now })
                  .where(and(eq(features.id, id), isNull(features.deletedAt)))
                  .returning({ id: features.id });
    return rows.length;
}

/** Adds one vertical's remap counts into a running total. */
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

/**
 * Moves one merge's relations across the three verticals and retires the
 * source row. Returns `undefined` when the source is already retired.
 */
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
            `HOS-2059: merge target ${merge.target.kind} '${merge.target.slug}' for ${merge.source.kind} '${merge.source.slug}' does not exist`
        );
    }

    let total = ZERO_COUNTS;
    for (const vertical of CATALOG_VERTICALS) {
        const counts = await remapVerticalRelations({
            db: ctx.db,
            vertical,
            source: { kind: merge.source.kind, id: sourceId },
            target: { kind: merge.target.kind, id: targetId },
            scope: merge.scope
        });
        if (counts.sourceBefore > 0) {
            logger.info(
                `HOS-2059 ${merge.source.kind}:${merge.source.slug} -> ${merge.target.kind}:${merge.target.slug} [${vertical}] ` +
                    `source ${counts.sourceBefore} -> 0, target ${counts.targetBefore} -> ${counts.targetAfter} ` +
                    `(moved ${counts.moved}, collapsed ${counts.collapsed}, ` +
                    `collapsed with attributes ${counts.collapsedWithAttributes}, survivor attributes filled ${counts.attributesFilled}, ` +
                    `attributes dropped ${counts.attributesDropped})`
            );
        }
        total = addCounts(total, counts);
    }

    await retireRow(ctx, merge.source.kind, sourceId, now);
    return total;
}

/**
 * Applies the HOS-2059 catalog curation.
 *
 * @param ctx - Migration context; `ctx.db` is transaction-scoped and
 *   `ctx.actor` stamps the soft deletes.
 * @returns A summary plus the count of every step. Relation counts before and
 *   after each merge go to the log, one line per merge and vertical.
 * @throws Error when a merge target is missing, or when a relation move would
 *   lose an owner (the runner then rolls the transaction back).
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const created = await insertNewRows(ctx);

    let amenitiesRetyped = 0;
    for (const retype of AMENITY_RETYPES) {
        const rows = await ctx.db
            .update(amenities)
            .set({ type: retype.to })
            .where(and(eq(amenities.slug, retype.slug), eq(amenities.type, retype.from)))
            .returning({ id: amenities.id });
        amenitiesRetyped += rows.length;
    }

    let featuresRenamed = 0;
    for (const rename of FEATURE_SLUG_RENAMES) {
        const rows = await ctx.db
            .update(features)
            .set({ slug: rename.to })
            .where(and(eq(features.slug, rename.from), isNull(features.deletedAt)))
            .returning({ id: features.id });
        featuresRenamed += rows.length;
    }

    let featuresWidened = 0;
    for (const widening of FEATURE_VERTICAL_WIDENINGS) {
        const rows = await ctx.db
            .update(features)
            .set({ applicableVerticals: [...widening.verticals] })
            .where(and(eq(features.slug, widening.slug), isNull(features.deletedAt)))
            .returning({ id: features.id });
        featuresWidened += rows.length;
    }

    const now = new Date();
    let rowsRetired = 0;
    let mergesSkipped = 0;
    let total = ZERO_COUNTS;
    for (const merge of CATALOG_MERGES) {
        const counts = await applyMerge(ctx, merge, now);
        if (!counts) {
            mergesSkipped += 1;
            continue;
        }
        rowsRetired += 1;
        total = addCounts(total, counts);
    }

    return {
        summary:
            `HOS-2059 catalog curation: ${created.amenities} amenity(ies) and ${created.features} feature(s) created, ` +
            `${amenitiesRetyped} retyped, ${featuresRenamed} renamed, ${rowsRetired} retired ` +
            `(${mergesSkipped} already retired); ${total.sourceBefore} relation(s) on retired rows: ` +
            `${total.moved} moved, ${total.collapsed} collapsed into an existing link ` +
            `(${total.collapsedWithAttributes} carrying attributes, ${total.attributesFilled} survivor row(s) filled), ` +
            `${total.attributesDropped} cross-kind attribute(s) dropped`,
        counts: {
            amenitiesCreated: created.amenities,
            featuresCreated: created.features,
            amenitiesRetyped,
            featuresRenamed,
            featuresWidened,
            rowsRetired,
            mergesSkipped,
            relationsOnRetiredRows: total.sourceBefore,
            relationsMoved: total.moved,
            relationsCollapsed: total.collapsed,
            relationsCollapsedWithAttributes: total.collapsedWithAttributes,
            survivorAttributesFilled: total.attributesFilled,
            attributesDropped: total.attributesDropped,
            survivorRelationsBefore: total.targetBefore,
            survivorRelationsAfter: total.targetAfter
        }
    };
}
