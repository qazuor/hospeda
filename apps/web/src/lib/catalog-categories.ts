/**
 * @file catalog-categories.ts
 * @description Shared amenity-category and feature-category grouping for the
 * owner-facing editors and the public detail grids.
 *
 * The canonical order + label mapping mirrors the admin panel's
 * `AmenityTypeBadge` (`admin-entities.types.amenity.*`) so the same category
 * reads identically in both apps even when a translation is missing.
 *
 * Extracted from `components/host/editor/AmenitiesSection.client.tsx` (BETA-133)
 * when the venue/experience editor adopted the same collapsible accordions (HOS-371) —
 * two copies of the order/label tables would drift the moment a new
 * `AmenitiesTypeEnum` value lands.
 *
 * HOS-2058 added five amenity types (PARKING, LAUNDRY, WATER_ACTIVITIES,
 * WELLNESS, DINING) and a `category` on features (`FeatureCategoryEnum`), so
 * features now group the same way amenities do.
 *
 * @module lib/catalog-categories
 */

import type { AmenityData } from '@/lib/api/types';

/** Translator function shape (matches `createTranslations().t`). */
type Translate = (key: string, fallback?: string) => string;

/**
 * Canonical display order for amenity categories (`AmenitiesTypeEnum` values
 * in `@repo/schemas`).
 */
export const AMENITY_CATEGORY_ORDER: readonly string[] = [
    'CLIMATE_CONTROL',
    'CONNECTIVITY',
    'ENTERTAINMENT',
    'KITCHEN',
    'BED_AND_BATH',
    'OUTDOORS',
    'ACCESSIBILITY',
    'SERVICES',
    'SAFETY',
    'FAMILY_FRIENDLY',
    'WORK_FRIENDLY',
    'PARKING',
    'LAUNDRY',
    'WATER_ACTIVITIES',
    'WELLNESS',
    'DINING',
    // The catch-all stays last, after every named category.
    'GENERAL_APPLIANCES'
];

/** Catch-all bucket key for amenities with a null/unrecognized category. */
export const OTHER_CATEGORY_KEY = '__other__';

/**
 * Maps an `AmenitiesTypeEnum` value to its i18n key suffix (camelCase) and a
 * Spanish fallback label.
 *
 * `GENERAL_APPLIANCES` deliberately reads "Equipamiento" here and in
 * `accommodations.amenityCategories.generalAppliances`, while the admin panel
 * keeps "Electrodomesticos" (HOS-823). The enum value is a catch-all: it groups
 * bikes, pet policy and an experience's included gear, none of which is an
 * appliance (parking used to live here too, until HOS-2058 gave it its own
 * PARKING type). On an experience listing that heading was the most misleading
 * one on the page. "Equipamiento" covers a fridge and a kayak alike, so ONE
 * string serves both verticals -- a per-vertical key would add a layer for a
 * naming problem, which is why it was rejected.
 */
export const AMENITY_CATEGORY_LABELS: Readonly<
    Record<string, { readonly i18nKey: string; readonly fallback: string }>
> = {
    CLIMATE_CONTROL: { i18nKey: 'climateControl', fallback: 'Climatización' },
    CONNECTIVITY: { i18nKey: 'connectivity', fallback: 'Conectividad' },
    ENTERTAINMENT: { i18nKey: 'entertainment', fallback: 'Entretenimiento' },
    KITCHEN: { i18nKey: 'kitchen', fallback: 'Cocina' },
    BED_AND_BATH: { i18nKey: 'bedAndBath', fallback: 'Dormitorio y baño' },
    OUTDOORS: { i18nKey: 'outdoors', fallback: 'Exteriores' },
    ACCESSIBILITY: { i18nKey: 'accessibility', fallback: 'Accesibilidad' },
    SERVICES: { i18nKey: 'services', fallback: 'Servicios' },
    SAFETY: { i18nKey: 'safety', fallback: 'Seguridad' },
    FAMILY_FRIENDLY: { i18nKey: 'familyFriendly', fallback: 'Apto familia' },
    WORK_FRIENDLY: { i18nKey: 'workFriendly', fallback: 'Apto trabajo' },
    PARKING: { i18nKey: 'parking', fallback: 'Estacionamiento' },
    LAUNDRY: { i18nKey: 'laundry', fallback: 'Lavandería' },
    WATER_ACTIVITIES: { i18nKey: 'waterActivities', fallback: 'Actividades acuáticas' },
    WELLNESS: { i18nKey: 'wellness', fallback: 'Bienestar' },
    DINING: { i18nKey: 'dining', fallback: 'Gastronomía' },
    GENERAL_APPLIANCES: { i18nKey: 'generalAppliances', fallback: 'Equipamiento' }
};

/**
 * Canonical display order for feature categories (`FeatureCategoryEnum` values
 * in `@repo/schemas`, HOS-2058). Features with a NULL category (not yet
 * classified) fall into the trailing "Otras" bucket.
 */
export const FEATURE_CATEGORY_ORDER: readonly string[] = [
    'LOCATION',
    'VIEW',
    'ACCESS',
    'STYLE',
    'AUDIENCE',
    'OFFER_PROFILE',
    'SUSTAINABILITY',
    'ACTIVITIES',
    'CUISINE',
    'DIETARY',
    'LANGUAGE'
];

/**
 * Maps a `FeatureCategoryEnum` value to its i18n key suffix under
 * `accommodations.featureCategories` and a Spanish fallback label.
 */
export const FEATURE_CATEGORY_LABELS: Readonly<
    Record<string, { readonly i18nKey: string; readonly fallback: string }>
> = {
    LOCATION: { i18nKey: 'location', fallback: 'Ubicación' },
    VIEW: { i18nKey: 'view', fallback: 'Vistas' },
    ACCESS: { i18nKey: 'access', fallback: 'Acceso' },
    STYLE: { i18nKey: 'style', fallback: 'Estilo' },
    AUDIENCE: { i18nKey: 'audience', fallback: 'Ideal para' },
    OFFER_PROFILE: { i18nKey: 'offerProfile', fallback: 'Perfil de la oferta' },
    SUSTAINABILITY: { i18nKey: 'sustainability', fallback: 'Sustentabilidad' },
    ACTIVITIES: { i18nKey: 'activities', fallback: 'Actividades' },
    CUISINE: { i18nKey: 'cuisine', fallback: 'Cocina' },
    DIETARY: { i18nKey: 'dietary', fallback: 'Opciones alimentarias' },
    LANGUAGE: { i18nKey: 'language', fallback: 'Idiomas' }
};

/** A single category group, ready to render as a collapsible section. */
export interface CategoryGroup<T> {
    readonly key: string;
    readonly label: string;
    readonly items: readonly T[];
}

/** A single amenity category group, ready to render as a collapsible section. */
export type AmenityGroup = CategoryGroup<AmenityData>;

/** Minimal shape the grouper needs: anything carrying a nullable category. */
interface Categorized {
    readonly category: string | null | undefined;
}

/**
 * Buckets items by category into `order`, with a trailing catch-all bucket for
 * null/unrecognized categories. Preserves the relative order of items within
 * each group and returns non-empty groups only.
 */
function groupByCategory<T extends Categorized>({
    items,
    order,
    labels,
    namespace,
    otherFallback,
    t
}: {
    readonly items: readonly T[];
    readonly order: readonly string[];
    readonly labels: Readonly<
        Record<string, { readonly i18nKey: string; readonly fallback: string }>
    >;
    readonly namespace: string;
    readonly otherFallback: string;
    readonly t: Translate;
}): readonly CategoryGroup<T>[] {
    const buckets = new Map<string, T[]>();

    for (const item of items) {
        const key = item.category && labels[item.category] ? item.category : OTHER_CATEGORY_KEY;
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.push(item);
        } else {
            buckets.set(key, [item]);
        }
    }

    const groups: CategoryGroup<T>[] = [];

    for (const key of [...order, OTHER_CATEGORY_KEY]) {
        const bucketItems = buckets.get(key);
        if (!bucketItems || bucketItems.length === 0) continue;

        const entry = labels[key];
        const label =
            key === OTHER_CATEGORY_KEY || !entry
                ? t(`${namespace}.other`, otherFallback)
                : t(`${namespace}.${entry.i18nKey}`, entry.fallback);

        groups.push({ key, label, items: bucketItems });
    }

    return groups;
}

/**
 * Groups amenities by category into the canonical display order, with a final
 * "Otros" bucket for null/unrecognized categories. Preserves the original
 * relative order of items within each group.
 *
 * @param params.amenities - Flat amenity list (already filtered to the caller's
 *   vertical) to group
 * @param params.t - Active locale translator
 * @returns Non-empty groups only, in canonical order
 */
export function groupAmenitiesByCategory({
    amenities,
    t
}: {
    readonly amenities: readonly AmenityData[];
    readonly t: Translate;
}): readonly AmenityGroup[] {
    return groupByCategory({
        items: amenities,
        order: AMENITY_CATEGORY_ORDER,
        labels: AMENITY_CATEGORY_LABELS,
        namespace: 'accommodations.amenityCategories',
        otherFallback: 'Otros',
        t
    });
}

/**
 * Groups features by `FeatureCategoryEnum` (HOS-2058) into the canonical
 * display order, with a final "Otras" bucket for features whose category is
 * NULL (not yet classified) or unrecognized.
 *
 * Generic over the item shape so the editor (`AmenityData`) and the public
 * detail grid (`DetailFeature`) share one ordering and one label table.
 *
 * @param params.features - Flat feature list to group
 * @param params.t - Active locale translator
 * @returns Non-empty groups only, in canonical order
 */
export function groupFeaturesByCategory<T extends Categorized>({
    features,
    t
}: {
    readonly features: readonly T[];
    readonly t: Translate;
}): readonly CategoryGroup<T>[] {
    return groupByCategory({
        items: features,
        order: FEATURE_CATEGORY_ORDER,
        labels: FEATURE_CATEGORY_LABELS,
        namespace: 'accommodations.featureCategories',
        otherFallback: 'Otras',
        t
    });
}
