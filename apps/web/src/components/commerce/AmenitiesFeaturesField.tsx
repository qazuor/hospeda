import type { AmenityData } from '@/lib/api/types';
/**
 * @file AmenitiesFeaturesField.tsx
 * @description Controlled amenity + feature multi-select for the commerce owner
 * editor (SPEC-249 T-016). Renders two checkbox groups from the public
 * amenities/features catalogs; the parent owns the selected-ID sets and dirty
 * tracking. The current selection is seeded from the protected listing detail
 * (`amenityIds` / `featureIds`, read back from the junction tables).
 */
import { translateAmenityName } from '@/lib/catalog-names';
import type { JSX } from 'react';

/** Translator function shape (matches the editor's `createTranslations().t`). */
type Translate = (key: string, fallback?: string) => string;

interface AmenitiesFeaturesFieldProps {
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
    /** Active editor translator. */
    readonly t: Translate;
    /** Shared CSS-module classes from the hosting editor. */
    readonly classes: Readonly<Record<string, string>>;
}

/**
 * Amenity + feature multi-select. Two independent checkbox groups; each toggle
 * flows up to the parent so the editor can persist `amenityIds` / `featureIds`
 * as separate dirty field groups.
 */
export function AmenitiesFeaturesField({
    amenities,
    features,
    selectedAmenityIds,
    selectedFeatureIds,
    onToggleAmenity,
    onToggleFeature,
    t,
    classes
}: AmenitiesFeaturesFieldProps): JSX.Element {
    return (
        <div className={classes.catalog}>
            {amenities.length > 0 && (
                <fieldset className={classes.catalogGroup}>
                    <legend className={classes.label}>
                        {t('commerce.owner.editor.sections.amenities', 'Servicios')}
                    </legend>
                    <div className={classes.catalogGrid}>
                        {amenities.map((amenity) => (
                            <label
                                key={amenity.id}
                                className={classes.checkbox}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedAmenityIds.has(amenity.id)}
                                    onChange={() => onToggleAmenity(amenity.id)}
                                />
                                {translateAmenityName({ t, name: amenity.name })}
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}

            {features.length > 0 && (
                <fieldset className={classes.catalogGroup}>
                    <legend className={classes.label}>
                        {t('commerce.owner.editor.sections.features', 'Características')}
                    </legend>
                    <div className={classes.catalogGrid}>
                        {features.map((feature) => (
                            <label
                                key={feature.id}
                                className={classes.checkbox}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedFeatureIds.has(feature.id)}
                                    onChange={() => onToggleFeature(feature.id)}
                                />
                                {feature.name}
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}
        </div>
    );
}
