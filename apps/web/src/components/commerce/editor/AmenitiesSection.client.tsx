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
 *
 * HOS-371: amenities are grouped into collapsible `<details>` accordions by
 * category, matching the accommodation editor's `AmenitiesSection` (BETA-133) —
 * a flat list dumped every option on screen at once. The grouping itself is the
 * shared `groupAmenitiesByCategory` in `lib/catalog-categories.ts`. Features
 * carry no category in the catalog (see `transformAmenityList` in
 * `lib/api/transforms.ts`), so they stay a single flat grid.
 */

import type { JSX } from 'react';
import type { AmenityData } from '@/lib/api/types';
import { groupAmenitiesByCategory } from '@/lib/catalog-categories';
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
    const amenityGroups = groupAmenitiesByCategory({ amenities, t });

    if (amenities.length === 0 && features.length === 0) {
        return null;
    }

    return (
        <section
            className={fieldStyles.section}
            id="editor-amenities"
        >
            <div className={styles.catalog}>
                {amenityGroups.length > 0 && (
                    <fieldset className={styles.catalogGroup}>
                        <legend className={fieldStyles.label}>
                            {t('commerce.owner.editor.sections.amenities', 'Servicios')}
                        </legend>
                        <div className={styles.categoryList}>
                            {amenityGroups.map((group, index) => {
                                const selectedCount = group.items.filter((item) =>
                                    selectedAmenityIds.has(item.id)
                                ).length;
                                // Open the first group so the section never reads
                                // as empty, plus any group holding a current
                                // selection (which would otherwise be hidden
                                // behind a collapsed summary).
                                const isFirstGroup = index === 0;

                                return (
                                    <details
                                        key={group.key}
                                        className={styles.categoryGroup}
                                        open={selectedCount > 0 || isFirstGroup}
                                    >
                                        <summary className={styles.categorySummary}>
                                            <span className={styles.categoryLabel}>
                                                {group.label}
                                            </span>
                                            {selectedCount > 0 && (
                                                <span className={styles.categoryBadge}>
                                                    {selectedCount}
                                                </span>
                                            )}
                                        </summary>
                                        <div className={styles.catalogGrid}>
                                            {group.items.map((amenity) => (
                                                <label
                                                    key={amenity.id}
                                                    className={fieldStyles.checkbox}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedAmenityIds.has(amenity.id)}
                                                        onChange={() => onToggleAmenity(amenity.id)}
                                                    />
                                                    {translateAmenityName({
                                                        t,
                                                        name: amenity.slug
                                                    })}
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
