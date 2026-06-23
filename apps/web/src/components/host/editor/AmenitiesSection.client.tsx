/**
 * @file AmenitiesSection.client.tsx
 * @description Form section for amenity and feature multi-checkbox selection.
 * Displays checkbox groups loaded from the public amenities/features endpoints.
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
 * Amenities and features form section.
 * Renders two checkbox groups: one for amenities, one for features.
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
                                    {translateAmenityName({ t, name: amenity.name })}
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
                                <span className={styles.checkboxText}>{feature.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </fieldset>
    );
}
