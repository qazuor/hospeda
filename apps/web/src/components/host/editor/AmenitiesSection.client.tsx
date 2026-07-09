/**
 * @file AmenitiesSection.client.tsx
 * @description Form section for amenity and feature multi-checkbox selection.
 * Displays checkbox groups loaded from the public amenities/features catalog
 * filtered to the accommodation vertical.
 *
 * SPEC-266: the `name` column was removed from the catalog. Display labels
 * are resolved client-side via `@repo/i18n` using:
 *   - Amenities: `accommodations.amenityNames.<slug>`
 *   - Features:  `accommodations.featureNames.<slug>`
 * The `slug` falls through as the raw fallback when no i18n key is found.
 *
 * BETA-133: amenities are additionally grouped by category into collapsible
 * `<details>` accordions (one per `AmenitiesTypeEnum` value, plus a catch-all
 * "Otros" bucket), so a long flat checkbox list doesn't dump every option on
 * screen at once. Features have no category field in the catalog (see
 * `transformAmenityList` in `lib/api/transforms.ts`), so they keep rendering
 * as a single flat grid under their existing heading.
 */

import type { AccommodationEditData, AmenityData } from '@/lib/api/types';
import { translateAmenityName } from '@/lib/catalog-names';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AmenitiesSection.module.css';

/** Props for AmenitiesSection. */
export interface AmenitiesSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly amenities: readonly AmenityData[];
    readonly features: readonly AmenityData[];
    readonly onToggleAmenity: (amenityId: string) => void;
    readonly onToggleFeature: (featureId: string) => void;
}

/**
 * Canonical display order for amenity categories (`AmenitiesTypeEnum` values
 * in `@repo/schemas`), mirroring the admin panel's `AmenityTypeBadge` mapping
 * so the same category reads identically in both apps.
 */
const AMENITY_CATEGORY_ORDER: readonly string[] = [
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
const OTHER_CATEGORY_KEY = '__other__';

/**
 * Maps an `AmenitiesTypeEnum` value to its i18n key suffix (camelCase) and a
 * Spanish fallback label, mirroring the admin panel's `AmenityTypeBadge`
 * mapping (`admin-entities.types.amenity.*`) so the same category reads
 * identically in both apps even when a translation is missing.
 */
const CATEGORY_LABELS: Readonly<
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
interface AmenityGroup {
    readonly key: string;
    readonly label: string;
    readonly items: readonly AmenityData[];
}

/**
 * Groups amenities by category into the canonical display order, with a
 * final "Otros" bucket for null/unrecognized categories. Preserves the
 * original relative order of items within each group.
 *
 * @param params.amenities - Flat amenity list (already filtered to the
 *   accommodation vertical) to group
 * @param params.t - Active locale translator
 * @returns Non-empty groups only, in canonical order
 */
function groupAmenitiesByCategory({
    amenities,
    t
}: {
    readonly amenities: readonly AmenityData[];
    readonly t: (key: string, fallback?: string) => string;
}): readonly AmenityGroup[] {
    const buckets = new Map<string, AmenityData[]>();

    for (const amenity of amenities) {
        const key =
            amenity.category && CATEGORY_LABELS[amenity.category]
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
                      `accommodations.amenityCategories.${CATEGORY_LABELS[key].i18nKey}`,
                      CATEGORY_LABELS[key].fallback
                  );

        groups.push({ key, label, items });
    }

    return groups;
}

/**
 * Amenities and features form section.
 * Renders amenities grouped into collapsible per-category accordions, and
 * features as a single flat checkbox grid (features have no category data).
 *
 * Labels are resolved at render time from the `accommodations` i18n namespace
 * using each item's `slug` as the key, so they follow the active locale
 * without requiring a page reload.
 */
export function AmenitiesSection({
    locale,
    data,
    amenities,
    features,
    onToggleAmenity,
    onToggleFeature
}: AmenitiesSectionProps) {
    const { t } = createTranslations(locale);
    const amenityGroups = groupAmenitiesByCategory({ amenities, t });

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.amenities', 'Servicios y comodidades')}
            </legend>

            {amenityGroups.length > 0 && (
                <div className={styles.group}>
                    <h4 className={styles.groupTitle}>
                        {t('host.properties.editor.field.amenities', 'Comodidades')}
                    </h4>
                    <div className={styles.categoryList}>
                        {amenityGroups.map((group, index) => {
                            const selectedCount = group.items.filter((item) =>
                                data.amenityIds.includes(item.id)
                            ).length;
                            const isFirstGroup = index === 0;

                            return (
                                <details
                                    key={group.key}
                                    className={styles.categoryGroup}
                                    open={selectedCount > 0 || isFirstGroup}
                                >
                                    <summary className={styles.categorySummary}>
                                        <span className={styles.categoryLabel}>{group.label}</span>
                                        {selectedCount > 0 && (
                                            <span className={styles.categoryBadge}>
                                                {selectedCount}
                                            </span>
                                        )}
                                    </summary>
                                    <div className={styles.checkboxGrid}>
                                        {group.items.map((amenity) => (
                                            <label
                                                key={amenity.id}
                                                className={styles.checkboxLabel}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className={styles.checkboxInput}
                                                    checked={data.amenityIds.includes(amenity.id)}
                                                    onChange={() => onToggleAmenity(amenity.id)}
                                                />
                                                <span className={styles.checkboxText}>
                                                    {translateAmenityName({
                                                        t,
                                                        name: amenity.slug
                                                    })}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                </div>
            )}

            {features.length > 0 && (
                <div className={styles.group}>
                    <h4 className={styles.groupTitle}>
                        {t('host.properties.editor.field.features', 'Características')}
                    </h4>
                    <div className={styles.checkboxGrid}>
                        {features.map((feature) => (
                            <label
                                key={feature.id}
                                className={styles.checkboxLabel}
                            >
                                <input
                                    type="checkbox"
                                    className={styles.checkboxInput}
                                    checked={data.featureIds.includes(feature.id)}
                                    onChange={() => onToggleFeature(feature.id)}
                                />
                                <span className={styles.checkboxText}>
                                    {t(`accommodations.featureNames.${feature.slug}`, feature.slug)}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </fieldset>
    );
}
