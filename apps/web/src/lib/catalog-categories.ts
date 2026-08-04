/**
 * @file catalog-categories.ts
 * @description Shared amenity-category grouping for the owner-facing editors.
 *
 * The canonical order + label mapping mirrors the admin panel's
 * `AmenityTypeBadge` (`admin-entities.types.amenity.*`) so the same category
 * reads identically in both apps even when a translation is missing.
 *
 * Extracted from `components/host/editor/AmenitiesSection.client.tsx` (BETA-133)
 * when the commerce editor adopted the same collapsible accordions (HOS-371) —
 * two copies of the order/label tables would drift the moment a new
 * `AmenitiesTypeEnum` value lands.
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
    'GENERAL_APPLIANCES'
];

/** Catch-all bucket key for amenities with a null/unrecognized category. */
export const OTHER_CATEGORY_KEY = '__other__';

/**
 * Maps an `AmenitiesTypeEnum` value to its i18n key suffix (camelCase) and a
 * Spanish fallback label.
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
    GENERAL_APPLIANCES: { i18nKey: 'generalAppliances', fallback: 'Electrodomésticos' }
};

/** A single amenity category group, ready to render as a collapsible section. */
export interface AmenityGroup {
    readonly key: string;
    readonly label: string;
    readonly items: readonly AmenityData[];
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
    const buckets = new Map<string, AmenityData[]>();

    for (const amenity of amenities) {
        const key =
            amenity.category && AMENITY_CATEGORY_LABELS[amenity.category]
                ? amenity.category
                : OTHER_CATEGORY_KEY;
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.push(amenity);
        } else {
            buckets.set(key, [amenity]);
        }
    }

    const orderedKeys = [...AMENITY_CATEGORY_ORDER, OTHER_CATEGORY_KEY];
    const groups: AmenityGroup[] = [];

    for (const key of orderedKeys) {
        const items = buckets.get(key);
        if (!items || items.length === 0) continue;

        const label =
            key === OTHER_CATEGORY_KEY
                ? t('accommodations.amenityCategories.other', 'Otros')
                : t(
                      `accommodations.amenityCategories.${AMENITY_CATEGORY_LABELS[key].i18nKey}`,
                      AMENITY_CATEGORY_LABELS[key].fallback
                  );

        groups.push({ key, label, items });
    }

    return groups;
}
