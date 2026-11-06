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
 * BETA-133: amenities are grouped by category into collapsible `<details>`
 * accordions (one per `AmenitiesTypeEnum` value, plus a catch-all "Otros"
 * bucket), so a long flat checkbox list doesn't dump every option on screen at
 * once.
 *
 * HOS-371: the grouping itself (canonical order, label mapping, bucketing)
 * lives in `lib/catalog-categories.ts` — the venue/experience owner editor
 * renders the same accordions and must not carry a second copy of those tables.
 *
 * HOS-2058: features now carry a `category` (`FeatureCategoryEnum`), so they
 * group into accordions the same way (NULL lands in "Otras"). Every CHECKED
 * amenity also gets a collapsed "Detalles" disclosure with two radio groups —
 * scope (private / shared / not specified) and availability (year-round /
 * seasonal / not specified). "Not specified" is NULL on the relation row: the
 * public page shows no badge for it and nothing is inferred.
 */

import type {
    AccommodationEditData,
    AmenityAttributeValue,
    AmenityAvailabilityValue,
    AmenityData,
    AmenityScopeValue
} from '@/lib/api/types';
import {
    type CategoryGroup,
    groupAmenitiesByCategory,
    groupFeaturesByCategory
} from '@/lib/catalog-categories';
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
    /** Sets one declared attribute of a checked amenity; `null` = not specified. */
    readonly onChangeAmenityAttribute: <K extends keyof AmenityAttributeValue>(
        amenityId: string,
        field: K,
        value: AmenityAttributeValue[K]
    ) => void;
}

/** Translator shape used by the sub-renderers. */
type Translate = (key: string, fallback?: string) => string;

/** One radio option; `value: null` is "not specified". */
interface AttributeOption<V extends string> {
    readonly value: V | null;
    readonly i18nKey: string;
    readonly fallback: string;
}

const SCOPE_OPTIONS: readonly AttributeOption<AmenityScopeValue>[] = [
    { value: 'private', i18nKey: 'private', fallback: 'Privado' },
    { value: 'shared', i18nKey: 'shared', fallback: 'Compartido' },
    { value: null, i18nKey: 'unset', fallback: 'Sin indicar' }
];

const AVAILABILITY_OPTIONS: readonly AttributeOption<AmenityAvailabilityValue>[] = [
    { value: 'year_round', i18nKey: 'yearRound', fallback: 'Todo el año' },
    { value: 'seasonal', i18nKey: 'seasonal', fallback: 'De temporada' },
    { value: null, i18nKey: 'unset', fallback: 'Sin indicar' }
];

const NO_ATTRIBUTES: AmenityAttributeValue = { scope: null, availability: null };

/**
 * A radio group for one attribute of one amenity. The radio `name` is scoped
 * to the amenity so groups never share state across amenities.
 */
function AttributeRadioGroup<V extends string>({
    amenityId,
    field,
    legendKey,
    legendFallback,
    options,
    current,
    t,
    onChange
}: {
    readonly amenityId: string;
    readonly field: keyof AmenityAttributeValue;
    readonly legendKey: string;
    readonly legendFallback: string;
    readonly options: readonly AttributeOption<V>[];
    readonly current: V | null;
    readonly t: Translate;
    readonly onChange: (value: V | null) => void;
}) {
    return (
        <fieldset className={styles.attributeGroup}>
            <legend className={styles.attributeLegend}>
                {t(`accommodations.amenityAttributes.${legendKey}.label`, legendFallback)}
            </legend>
            {options.map((option) => (
                <label
                    key={option.i18nKey}
                    className={styles.attributeOption}
                >
                    <input
                        type="radio"
                        name={`amenity-${amenityId}-${field}`}
                        checked={current === option.value}
                        onChange={() => onChange(option.value)}
                    />
                    <span>
                        {t(
                            `accommodations.amenityAttributes.${legendKey}.${option.i18nKey}`,
                            option.fallback
                        )}
                    </span>
                </label>
            ))}
        </fieldset>
    );
}

/** One collapsible category accordion of checkboxes. */
function CategoryAccordion<T extends AmenityData>({
    group,
    isFirst,
    selectedIds,
    renderItem
}: {
    readonly group: CategoryGroup<T>;
    readonly isFirst: boolean;
    readonly selectedIds: readonly string[];
    readonly renderItem: (item: T) => React.ReactNode;
}) {
    const selectedCount = group.items.filter((item) => selectedIds.includes(item.id)).length;
    return (
        <details
            className={styles.categoryGroup}
            open={selectedCount > 0 || isFirst}
        >
            <summary className={styles.categorySummary}>
                <span className={styles.categoryLabel}>{group.label}</span>
                {selectedCount > 0 && <span className={styles.categoryBadge}>{selectedCount}</span>}
            </summary>
            <div className={styles.checkboxGrid}>{group.items.map(renderItem)}</div>
        </details>
    );
}

/**
 * Amenities and features form section.
 * Renders amenities and features grouped into collapsible per-category
 * accordions; each checked amenity carries a collapsed scope/availability
 * disclosure.
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
    onToggleFeature,
    onChangeAmenityAttribute
}: AmenitiesSectionProps) {
    const { t } = createTranslations(locale);
    const amenityGroups = groupAmenitiesByCategory({ amenities, t });
    const featureGroups = groupFeaturesByCategory({ features, t });
    // Test fixtures and older callers may omit the map entirely.
    const attributes = data.amenityAttributes ?? {};

    const renderAmenity = (amenity: AmenityData) => {
        const isChecked = data.amenityIds.includes(amenity.id);
        const declared = attributes[amenity.id] ?? NO_ATTRIBUTES;
        return (
            <div
                key={amenity.id}
                className={styles.item}
            >
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        className={styles.checkboxInput}
                        checked={isChecked}
                        onChange={() => onToggleAmenity(amenity.id)}
                    />
                    <span className={styles.checkboxText}>
                        {translateAmenityName({ t, name: amenity.slug })}
                    </span>
                </label>
                {isChecked && (
                    <details className={styles.attributes}>
                        <summary className={styles.attributesSummary}>
                            {t('host.properties.editor.field.amenityDetails', 'Detalles')}
                        </summary>
                        <p className={styles.attributesHint}>
                            {t(
                                'host.properties.editor.field.amenityDetailsHint',
                                'Indicá si es de uso privado o compartido y si está disponible todo el año.'
                            )}
                        </p>
                        <AttributeRadioGroup
                            amenityId={amenity.id}
                            field="scope"
                            legendKey="scope"
                            legendFallback="Uso"
                            options={SCOPE_OPTIONS}
                            current={declared.scope}
                            t={t}
                            onChange={(value) =>
                                onChangeAmenityAttribute(amenity.id, 'scope', value)
                            }
                        />
                        <AttributeRadioGroup
                            amenityId={amenity.id}
                            field="availability"
                            legendKey="availability"
                            legendFallback="Disponibilidad"
                            options={AVAILABILITY_OPTIONS}
                            current={declared.availability}
                            t={t}
                            onChange={(value) =>
                                onChangeAmenityAttribute(amenity.id, 'availability', value)
                            }
                        />
                    </details>
                )}
            </div>
        );
    };

    const renderFeature = (feature: AmenityData) => (
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
    );

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
                        {amenityGroups.map((group, index) => (
                            <CategoryAccordion
                                key={group.key}
                                group={group}
                                isFirst={index === 0}
                                selectedIds={data.amenityIds}
                                renderItem={renderAmenity}
                            />
                        ))}
                    </div>
                </div>
            )}

            {featureGroups.length > 0 && (
                <div className={styles.group}>
                    <h4 className={styles.groupTitle}>
                        {t('host.properties.editor.field.features', 'Características')}
                    </h4>
                    <div className={styles.categoryList}>
                        {featureGroups.map((group, index) => (
                            <CategoryAccordion
                                key={`feature-${group.key}`}
                                group={group}
                                isFirst={index === 0}
                                selectedIds={data.featureIds}
                                renderItem={renderFeature}
                            />
                        ))}
                    </div>
                </div>
            )}
        </fieldset>
    );
}
