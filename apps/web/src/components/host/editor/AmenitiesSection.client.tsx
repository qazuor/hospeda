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
 */

import type { AccommodationEditData, AmenityData } from '@/lib/api/types';
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
 * Amenities and features form section.
 * Renders two checkbox groups: one for amenities, one for features.
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

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.amenities', 'Servicios y comodidades')}
            </legend>

            {amenities.length > 0 && (
                <div className={styles.group}>
                    <h4 className={styles.groupTitle}>
                        {t('host.properties.editor.field.amenities', 'Comodidades')}
                    </h4>
                    <div className={styles.checkboxGrid}>
                        {amenities.map((amenity) => (
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
                                    {t(`accommodations.amenityNames.${amenity.slug}`, amenity.slug)}
                                </span>
                            </label>
                        ))}
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
