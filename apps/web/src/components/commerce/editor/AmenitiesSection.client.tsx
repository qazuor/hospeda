/**
 * @file AmenitiesSection.client.tsx
 * @description Amenity + feature multi-select section of the commerce owner
 * editor (SPEC-249 T-016, extracted in HOS-258).
 *
 * Two independent checkbox groups; each toggle flows up to the orchestrator so
 * `amenityIds` / `featureIds` stay separate entries in the PATCH diff.
 *
 * SPEC-266: the `name` column was removed from the catalog. Display labels are
 * resolved via the `accommodations` i18n namespace using each item's `slug`:
 *   - Amenities: `accommodations.amenityNames.<slug>`
 *   - Features:  `accommodations.featureNames.<slug>`
 * The slug falls through as raw fallback when no i18n key is found.
 *
 * Renders nothing when both catalogs are empty — the orchestrator used to carry
 * that guard inline.
 */

import type { JSX } from 'react';
import type { AmenityData } from '@/lib/api/types';
import { translateAmenityName } from '@/lib/catalog-names';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AmenitiesSection.module.css';
import fieldStyles from './editor-fields.module.css';

export interface AmenitiesSectionProps {
    readonly locale: SupportedLocale;
    /** Amenity catalog (all selectable amenities). */
    readonly amenities: readonly AmenityData[];
    /** Feature catalog (all selectable features). */
    readonly features: readonly AmenityData[];
    /** Currently-selected amenity IDs. */
    readonly selectedAmenityIds: ReadonlySet<string>;
    /** Currently-selected feature IDs. */
    readonly selectedFeatureIds: ReadonlySet<string>;
    /** Toggle a single amenity ID. */
    readonly onToggleAmenity: (id: string) => void;
    /** Toggle a single feature ID. */
    readonly onToggleFeature: (id: string) => void;
}

export function AmenitiesSection({
    locale,
    amenities,
    features,
    selectedAmenityIds,
    selectedFeatureIds,
    onToggleAmenity,
    onToggleFeature
}: AmenitiesSectionProps): JSX.Element | null {
    const { t } = createTranslations(locale);

    if (amenities.length === 0 && features.length === 0) {
        return null;
    }

    return (
        <section
            className={fieldStyles.section}
            id="editor-amenities"
        >
            <div className={styles.catalog}>
                {amenities.length > 0 && (
                    <fieldset className={styles.catalogGroup}>
                        <legend className={fieldStyles.label}>
                            {t('commerce.owner.editor.sections.amenities', 'Servicios')}
                        </legend>
                        <div className={styles.catalogGrid}>
                            {amenities.map((amenity) => (
                                <label
                                    key={amenity.id}
                                    className={fieldStyles.checkbox}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedAmenityIds.has(amenity.id)}
                                        onChange={() => onToggleAmenity(amenity.id)}
                                    />
                                    {translateAmenityName({ t, name: amenity.slug })}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}

                {features.length > 0 && (
                    <fieldset className={styles.catalogGroup}>
                        <legend className={fieldStyles.label}>
                            {t('commerce.owner.editor.sections.features', 'Características')}
                        </legend>
                        <div className={styles.catalogGrid}>
                            {features.map((feature) => (
                                <label
                                    key={feature.id}
                                    className={fieldStyles.checkbox}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedFeatureIds.has(feature.id)}
                                        onChange={() => onToggleFeature(feature.id)}
                                    />
                                    {t(`accommodations.featureNames.${feature.slug}`, feature.slug)}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}
            </div>
        </section>
    );
}
