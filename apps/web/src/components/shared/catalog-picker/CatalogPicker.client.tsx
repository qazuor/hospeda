/**
 * @file CatalogPicker.client.tsx
 * @description The ONE amenity/feature picker of the three owner editors
 * (accommodation, venue, experience — HOS-2061). It replaced two
 * near-duplicate `AmenitiesSection` components, so the verticals behave
 * identically:
 *
 * - **Featured first.** Items with `isFeatured` render above everything else,
 *   ordered by `displayWeight`.
 * - **Show all, per category.** The remaining items sit in one collapsible
 *   `<details>` accordion per category (amenity type / feature category), with
 *   a trailing "other" bucket for items whose category is missing.
 * - **Search.** One box filters both catalogs, client-side, over the LOCALIZED
 *   labels (accent- and case-insensitive). While searching, every match is
 *   listed in its open category and the featured section steps aside.
 * - **Inline attributes.** A checked amenity carries the scope/availability
 *   disclosure when the caller passes `onChangeAmenityAttribute`.
 *
 * Labels come from `@repo/i18n` by slug (SPEC-266): amenities through
 * `translateAmenityName`, features through `accommodations.featureNames.<slug>`.
 * The section wrapper (title, anchor id, sibling `PoliciesPanel`) stays with
 * each caller.
 */

import { type JSX, useId, useState } from 'react';
import type { AmenityAttributeValue, AmenityData } from '@/lib/api/types';
import {
    type CategoryGroup,
    groupAmenitiesByCategory,
    groupFeaturesByCategory
} from '@/lib/catalog-categories';
import { translateAmenityName } from '@/lib/catalog-names';
import {
    buildCatalogPickerView,
    type CatalogLabeler,
    type CatalogPickerView
} from '@/lib/catalog-picker';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    type AmenityAttributeChange,
    AmenityAttributeControls,
    NO_AMENITY_ATTRIBUTES
} from './AmenityAttributeControls.client';
import styles from './CatalogPicker.module.css';

/** Props for {@link CatalogPicker}. */
export interface CatalogPickerProps {
    readonly locale: SupportedLocale;
    /** Heading of the amenity catalog. */
    readonly amenitiesTitle: string;
    /** Heading of the feature catalog. */
    readonly featuresTitle: string;
    /** Amenity catalog, already scoped to the vertical. */
    readonly amenities: readonly AmenityData[];
    /** Feature catalog, already scoped to the vertical. */
    readonly features: readonly AmenityData[];
    readonly selectedAmenityIds: ReadonlySet<string>;
    readonly selectedFeatureIds: ReadonlySet<string>;
    readonly onToggleAmenity: (id: string) => void;
    readonly onToggleFeature: (id: string) => void;
    /** Declared relation attributes, keyed by amenity id. */
    readonly amenityAttributes?: Readonly<Record<string, AmenityAttributeValue>>;
    /** When present, a checked amenity offers the scope/availability controls. */
    readonly onChangeAmenityAttribute?: AmenityAttributeChange;
}

/** One catalog block (amenities or features) of the picker. */
function CatalogBlock({
    title,
    view,
    selectedIds,
    showAllLabel,
    featuredLabel,
    renderItem
}: {
    readonly title: string;
    readonly view: CatalogPickerView;
    readonly selectedIds: ReadonlySet<string>;
    readonly showAllLabel: string;
    readonly featuredLabel: string;
    readonly renderItem: (item: AmenityData) => JSX.Element;
}): JSX.Element | null {
    if (view.featured.length === 0 && view.groups.length === 0) return null;
    const hasFeatured = view.featured.length > 0;

    return (
        <fieldset className={styles.catalogGroup}>
            <legend className={styles.catalogTitle}>{title}</legend>

            {hasFeatured && (
                <div className={styles.featured}>
                    <p className={styles.featuredTitle}>{featuredLabel}</p>
                    <div className={styles.grid}>{view.featured.map(renderItem)}</div>
                </div>
            )}

            {view.groups.length > 0 && (
                <div className={styles.categoryList}>
                    {hasFeatured && <p className={styles.showAllTitle}>{showAllLabel}</p>}
                    {view.groups.map((group, index) => (
                        <CategoryAccordion
                            // Remount on entering/leaving search so `open` re-applies.
                            key={`${group.key}-${view.isSearching ? 'search' : 'browse'}`}
                            group={group}
                            // Without a featured block, open the first group so the
                            // catalog never reads as empty; always open while searching.
                            defaultOpen={view.isSearching || (!hasFeatured && index === 0)}
                            selectedIds={selectedIds}
                            renderItem={renderItem}
                        />
                    ))}
                </div>
            )}
        </fieldset>
    );
}

/** One collapsible category accordion. */
function CategoryAccordion({
    group,
    defaultOpen,
    selectedIds,
    renderItem
}: {
    readonly group: CategoryGroup<AmenityData>;
    readonly defaultOpen: boolean;
    readonly selectedIds: ReadonlySet<string>;
    readonly renderItem: (item: AmenityData) => JSX.Element;
}): JSX.Element {
    const selectedCount = group.items.filter((item) => selectedIds.has(item.id)).length;
    return (
        <details
            className={styles.categoryGroup}
            // A group holding a selection opens too: a collapsed summary would
            // hide the owner's current choices.
            open={defaultOpen || selectedCount > 0}
        >
            <summary className={styles.categorySummary}>
                <span className={styles.categoryLabel}>{group.label}</span>
                {selectedCount > 0 && <span className={styles.categoryBadge}>{selectedCount}</span>}
            </summary>
            <div className={styles.grid}>{group.items.map(renderItem)}</div>
        </details>
    );
}

/**
 * Shared amenity/feature catalog picker. Renders nothing when both catalogs
 * are empty.
 *
 * @param props - {@link CatalogPickerProps}
 * @returns The picker, or `null` for two empty catalogs
 */
export function CatalogPicker({
    locale,
    amenitiesTitle,
    featuresTitle,
    amenities,
    features,
    selectedAmenityIds,
    selectedFeatureIds,
    onToggleAmenity,
    onToggleFeature,
    amenityAttributes,
    onChangeAmenityAttribute
}: CatalogPickerProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const idPrefix = useId();
    const [query, setQuery] = useState('');

    if (amenities.length === 0 && features.length === 0) return null;

    const amenityLabel: CatalogLabeler = (item) => translateAmenityName({ t, name: item.slug });
    const featureLabel: CatalogLabeler = (item) =>
        t(`accommodations.featureNames.${item.slug}`, item.slug);

    const amenityView = buildCatalogPickerView({
        items: amenities,
        query,
        getLabel: amenityLabel,
        group: (items) => groupAmenitiesByCategory({ amenities: items, t })
    });
    const featureView = buildCatalogPickerView({
        items: features,
        query,
        getLabel: featureLabel,
        group: (items) => groupFeaturesByCategory({ features: items, t })
    });
    const attributes = amenityAttributes ?? {};
    const pickerKey = 'listing.owner.editor.amenities.picker';
    const featuredLabel = t(`${pickerKey}.featured`, 'Destacados');
    const showAllLabel = t(`${pickerKey}.showAll`, 'Ver todos');
    const searchId = `${idPrefix}-catalog-search`;
    const noResults =
        amenityView.isSearching && amenityView.matchCount === 0 && featureView.matchCount === 0;

    const renderAmenity = (amenity: AmenityData): JSX.Element => {
        const isChecked = selectedAmenityIds.has(amenity.id);
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
                    <span className={styles.checkboxText}>{amenityLabel(amenity)}</span>
                </label>
                {isChecked && onChangeAmenityAttribute && (
                    <AmenityAttributeControls
                        idPrefix={idPrefix}
                        amenityId={amenity.id}
                        declared={attributes[amenity.id] ?? NO_AMENITY_ATTRIBUTES}
                        t={t}
                        onChange={onChangeAmenityAttribute}
                    />
                )}
            </div>
        );
    };

    const renderFeature = (feature: AmenityData): JSX.Element => (
        <div
            key={feature.id}
            className={styles.item}
        >
            <label className={styles.checkboxLabel}>
                <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={selectedFeatureIds.has(feature.id)}
                    onChange={() => onToggleFeature(feature.id)}
                />
                <span className={styles.checkboxText}>{featureLabel(feature)}</span>
            </label>
        </div>
    );

    return (
        <div className={styles.picker}>
            <div className={styles.search}>
                <label
                    htmlFor={searchId}
                    className={styles.searchLabel}
                >
                    {t(`${pickerKey}.searchLabel`, 'Buscar servicios y características')}
                </label>
                <input
                    id={searchId}
                    type="search"
                    className={styles.searchInput}
                    value={query}
                    placeholder={t(`${pickerKey}.searchPlaceholder`, 'Ej.: wifi, pileta, vegano')}
                    autoComplete="off"
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>

            {noResults && (
                <p
                    className={styles.noResults}
                    role="status"
                >
                    {t(`${pickerKey}.noResults`, `No encontramos nada con "${query}".`, {
                        query
                    })}
                </p>
            )}

            <CatalogBlock
                title={amenitiesTitle}
                view={amenityView}
                selectedIds={selectedAmenityIds}
                showAllLabel={showAllLabel}
                featuredLabel={featuredLabel}
                renderItem={renderAmenity}
            />
            <CatalogBlock
                title={featuresTitle}
                view={featureView}
                selectedIds={selectedFeatureIds}
                showAllLabel={showAllLabel}
                featuredLabel={featuredLabel}
                renderItem={renderFeature}
            />
        </div>
    );
}
