import type { JSX } from 'react';
import type { AmenityData } from '@/lib/api/types';
/**
 * @file AmenitiesFeaturesField.tsx
 * @description Controlled amenity + feature multi-select for the commerce owner
 * editor (SPEC-249 T-016). Renders two checkbox groups from the public
 * amenities/features catalogs; the parent owns the selected-ID sets and dirty
 * tracking. The current selection is seeded from the protected listing detail
 * (`amenityIds` / `featureIds`, read back from the junction tables).
 *
 * SPEC-266: the `name` column was removed from the catalog. Display labels are
 * resolved via the `accommodations` i18n namespace using each item's `slug`:
 *   - Amenities: `accommodations.amenityNames.<slug>`
 *   - Features:  `accommodations.featureNames.<slug>`
 * The slug falls through as raw fallback when no i18n key is found.
 *
 * HOS-371: amenities are grouped into collapsible `<details>` accordions by
 * category, matching the accommodation editor's `AmenitiesSection` (BETA-133) —
 * a flat list dumped every option on screen at once. The grouping itself is the
 * shared `groupAmenitiesByCategory` in `lib/catalog-categories.ts`. Features
 * carry no category in the catalog (see `transformAmenityList` in
 * `lib/api/transforms.ts`), so they stay a single flat grid.
 */
import { groupAmenitiesByCategory } from '@/lib/catalog-categories';
import { translateAmenityName } from '@/lib/catalog-names';

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
 * Amenity + feature multi-select. Two independent groups; each toggle flows up
 * to the parent so the editor can persist `amenityIds` / `featureIds` as
 * separate dirty field groups.
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
    const amenityGroups = groupAmenitiesByCategory({ amenities, t });

    return (
        <div className={classes.catalog}>
            {amenityGroups.length > 0 && (
                <fieldset className={classes.catalogGroup}>
                    <legend className={classes.label}>
                        {t('commerce.owner.editor.sections.amenities', 'Servicios')}
                    </legend>
                    <div className={classes.categoryList}>
                        {amenityGroups.map((group, index) => {
                            const selectedCount = group.items.filter((item) =>
                                selectedAmenityIds.has(item.id)
                            ).length;
                            // Open the first group so the section never reads as
                            // empty, plus any group holding a current selection
                            // (which would otherwise be hidden behind a summary).
                            const isFirstGroup = index === 0;

                            return (
                                <details
                                    key={group.key}
                                    className={classes.categoryGroup}
                                    open={selectedCount > 0 || isFirstGroup}
                                >
                                    <summary className={classes.categorySummary}>
                                        <span className={classes.categoryLabel}>{group.label}</span>
                                        {selectedCount > 0 && (
                                            <span className={classes.categoryBadge}>
                                                {selectedCount}
                                            </span>
                                        )}
                                    </summary>
                                    <div className={classes.catalogGrid}>
                                        {group.items.map((amenity) => (
                                            <label
                                                key={amenity.id}
                                                className={classes.checkbox}
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
                                </details>
                            );
                        })}
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
                                {t(`accommodations.featureNames.${feature.slug}`, feature.slug)}
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}
        </div>
    );
}
