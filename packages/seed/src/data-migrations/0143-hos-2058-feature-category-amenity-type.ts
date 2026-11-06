/**
 * @fileoverview
 * Data migration: 0143-hos-2058-feature-category-amenity-type
 *
 * Dual-write counterpart (HOS-25) for HOS-2058, stage 2 of the HOS-1016
 * catalog redesign. Two catalog changes reach already-seeded environments:
 *
 * 1. `features.category` (new, NULLABLE in this release) is backfilled for
 *    the 106 seeded feature rows, by SLUG.
 * 2. Thirty amenities move to the five new `AmenitiesTypeEnum` values
 *    (PARKING, LAUNDRY, WATER_ACTIVITIES, WELLNESS, DINING), by SLUG.
 *
 * The baseline gets the same end state from the fixtures: every
 * `src/data/feature/*.json` carries `category`, and the moved
 * `src/data/amenity/*.json` carry their new `type`. File names and fixture
 * ids still embed the old type on purpose -- they are deterministic keys, so
 * they were not renamed.
 *
 * ## Run order
 *
 * The structural migration that adds `features.category`,
 * `r_accommodation_amenity.scope/availability` and the five new
 * `amenities_type_enum` values runs first (`db:migrate`). If the column is
 * missing, `meta.requiresColumns` makes the runner refuse instead of
 * reporting zero rows and closing itself in the ledger (HOS-433). The new
 * enum values are added by the same structural migration, so the amenity
 * UPDATE fails loudly (invalid enum input) rather than silently if it has not
 * run.
 *
 * ## Out of scope
 *
 * The HOS-1787 epic rows (`dj_sets`, `karaoke` and its night amenities) are
 * NOT listed here: the epic assigns their categories itself.
 *
 * ## Idempotency
 *
 * - A feature is written only while its `category` IS NULL, so a second run
 *   matches nothing, and a category an admin already set is never overwritten.
 * - An amenity is retyped only while its `type` still equals the old value,
 *   so a second run matches nothing, and an admin re-categorization is kept.
 *
 * ## `destructive` flag decision
 *
 * `false` -- nothing is deleted. Feature rows only gain a value where there
 * was none; amenity rows change `type` only from the exact value this
 * decision retires for them.
 */
import { amenities, and, eq, features, inArray, isNull } from '@repo/db';
import type { AmenitiesTypeEnum, FeatureCategoryEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0143-hos-2058-feature-category-amenity-type',
    group: 'required',
    destructive: false,
    // HOS-433: the backfill writes `features.category`. If the column is not
    // there yet the runner refuses instead of ledgering a zero-row run.
    requiresColumns: [{ table: 'features', column: 'category' }]
} as const satisfies SeedMigrationModule['meta'];

/**
 * Feature slugs per category (owner decision on HOS-2058 OQ-1: 11 values,
 * VIEW kept, no SECURITY -- the three security rows live in OFFER_PROFILE).
 *
 * A FIXED list on purpose: a later catalog row ships its own migration
 * instead of being swept into this one.
 */
export const FEATURE_CATEGORY_BACKFILL: Readonly<
    Record<`${FeatureCategoryEnum}`, readonly string[]>
> = {
    LOCATION: [
        'river_front',
        'spa_front',
        'natural_environment',
        'rural_area',
        'central_area',
        'residential_area',
        'silent_environment',
        'isolated_no_neighbors',
        'no_cell_signal'
    ],
    VIEW: ['panoramic_view_extended', 'private_viewpoint'],
    ACCESS: ['paved_access', 'gravel_access', 'internal_parking', 'dock_access'],
    STYLE: [
        'modern_style',
        'rustic_style',
        'minimalist_style',
        'smart_home',
        'themed_rooms',
        'local_artisan_decor'
    ],
    AUDIENCE: [
        'family_suitable',
        'couple_suitable',
        'pet_suitable',
        'ideal_for_groups',
        'ideal_for_seniors',
        'disability_accessible',
        'exclusive_kids_area',
        'adults_only_area',
        'event_suitable',
        'wedding_suitable',
        'spiritual_retreat_suitable',
        'remote_coworking_suitable',
        'lgbtq_friendly',
        'family_friendly',
        'romantic_ambiance',
        'kid_friendly',
        'beginner_friendly',
        'pregnancy_safe',
        'senior_friendly'
    ],
    OFFER_PROFILE: [
        'wifi_full_property',
        'autonomous_checkin',
        'minimum_stay_required',
        'full_rental',
        'room_rental',
        'camping_area',
        'fire_pit_area',
        'covered_gallery',
        'private_grill',
        'shared_space',
        '24h_security',
        'perimeter_lighting',
        'perimeter_fence',
        'quiet_zone',
        'smoking_area',
        'pet_friendly_area',
        'tourist_info_available',
        'transfer_service',
        'laundry_service',
        'luggage_storage',
        'own_production',
        'digital_detox_zone',
        'no_tv_area',
        'satellite_wifi',
        'vehicle_rental',
        'tourism_certification',
        'camping_sector',
        'covered_barbecue_area',
        'permanent_professional_staff',
        'kids_menu',
        'organic_products',
        'craft_beer',
        'private_available'
    ],
    SUSTAINABILITY: [
        'ecological_construction',
        'renewable_energy',
        'sustainable_accommodation',
        'waste_recycling',
        'rainwater_harvesting',
        'plastic_free_policy',
        'solar_showers'
    ],
    ACTIVITIES: [
        'organized_activities',
        'animal_activities',
        'educational_farm',
        'rural_activities_stay',
        'dairy_farm_production',
        'animal_corral',
        'yoga_meditation_area',
        'walking_circuit',
        'workshop_training_space',
        'outdoor_activity'
    ],
    CUISINE: [
        'argentine_cuisine',
        'river_cuisine',
        'italian_cuisine',
        'peruvian_cuisine',
        'international_cuisine',
        'asian_cuisine',
        'mediterranean_cuisine',
        'fusion_cuisine'
    ],
    DIETARY: [
        'gluten_free_options',
        'vegan_options',
        'vegetarian_options',
        'lactose_free_options',
        'nut_free_options'
    ],
    LANGUAGE: ['bilingual_services', 'english_guide_available', 'portuguese_guide_available']
};

/** One amenity retype: the slug, the type it must still hold, and the new type. */
export interface AmenityTypeMove {
    readonly slug: string;
    readonly from: `${AmenitiesTypeEnum}`;
    readonly to: `${AmenitiesTypeEnum}`;
}

/** Amenity retypes (owner decision on HOS-2058 OQ-2). */
export const AMENITY_TYPE_MOVES: readonly AmenityTypeMove[] = [
    { slug: 'parking', from: 'GENERAL_APPLIANCES', to: 'PARKING' },
    { slug: 'covered_parking', from: 'GENERAL_APPLIANCES', to: 'PARKING' },
    { slug: 'motorhome_parking', from: 'GENERAL_APPLIANCES', to: 'PARKING' },
    { slug: 'security_parking', from: 'SAFETY', to: 'PARKING' },
    { slug: 'bike_parking', from: 'OUTDOORS', to: 'PARKING' },
    { slug: 'washer', from: 'BED_AND_BATH', to: 'LAUNDRY' },
    { slug: 'dryer', from: 'BED_AND_BATH', to: 'LAUNDRY' },
    { slug: 'iron', from: 'BED_AND_BATH', to: 'LAUNDRY' },
    { slug: 'laundry_service', from: 'SERVICES', to: 'LAUNDRY' },
    { slug: 'kayaks', from: 'GENERAL_APPLIANCES', to: 'WATER_ACTIVITIES' },
    { slug: 'fishing_equipment', from: 'GENERAL_APPLIANCES', to: 'WATER_ACTIVITIES' },
    { slug: 'beach_equipment', from: 'GENERAL_APPLIANCES', to: 'WATER_ACTIVITIES' },
    { slug: 'beach_chairs_umbrellas', from: 'OUTDOORS', to: 'WATER_ACTIVITIES' },
    { slug: 'spa', from: 'GENERAL_APPLIANCES', to: 'WELLNESS' },
    { slug: 'gym', from: 'GENERAL_APPLIANCES', to: 'WELLNESS' },
    { slug: 'relaxation_area', from: 'GENERAL_APPLIANCES', to: 'WELLNESS' },
    { slug: 'sauna', from: 'OUTDOORS', to: 'WELLNESS' },
    { slug: 'jacuzzi', from: 'OUTDOORS', to: 'WELLNESS' },
    { slug: 'breakfast', from: 'SERVICES', to: 'DINING' },
    { slug: 'full_board', from: 'SERVICES', to: 'DINING' },
    { slug: 'half_board', from: 'SERVICES', to: 'DINING' },
    { slug: 'restaurant', from: 'SERVICES', to: 'DINING' },
    { slug: 'bar', from: 'SERVICES', to: 'DINING' },
    { slug: 'bar_service', from: 'SERVICES', to: 'DINING' },
    { slug: 'mini_bar', from: 'SERVICES', to: 'DINING' },
    { slug: 'happy_hour', from: 'SERVICES', to: 'DINING' },
    { slug: 'catering', from: 'SERVICES', to: 'DINING' },
    { slug: 'takeaway', from: 'SERVICES', to: 'DINING' },
    { slug: 'delivery', from: 'SERVICES', to: 'DINING' },
    { slug: 'food_included', from: 'SERVICES', to: 'DINING' }
];

/**
 * Backfills `features.category` and retypes the moved amenities, by slug.
 *
 * @param ctx - Migration context; only `ctx.db` (transaction-scoped) is used.
 * @returns A summary plus the number of feature and amenity rows written.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let featuresCategorized = 0;
    for (const [category, slugs] of Object.entries(FEATURE_CATEGORY_BACKFILL)) {
        const rows = await ctx.db
            .update(features)
            .set({ category: category as (typeof features.$inferInsert)['category'] })
            .where(and(inArray(features.slug, [...slugs]), isNull(features.category)))
            .returning({ id: features.id });
        featuresCategorized += rows.length;
    }

    let amenitiesRetyped = 0;
    for (const move of AMENITY_TYPE_MOVES) {
        const rows = await ctx.db
            .update(amenities)
            .set({ type: move.to })
            .where(and(eq(amenities.slug, move.slug), eq(amenities.type, move.from)))
            .returning({ id: amenities.id });
        amenitiesRetyped += rows.length;
    }

    return {
        summary: `HOS-2058 catalog: ${featuresCategorized} feature(s) categorized, ${amenitiesRetyped} amenity(ies) retyped`,
        counts: { featuresCategorized, amenitiesRetyped }
    };
}
