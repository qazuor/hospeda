/**
 * @file AmenityCatalogBrowser.client.tsx
 * @description The accommodation editor's amenity/feature browser (HOS-2123,
 * owner-chosen mockup variant B, with the owner's one change):
 *
 * - **Categories on the left, tiles on the right.** One list of categories
 *   (amenity categories, then feature categories), each with its selected
 *   count. The panel shows every item of the active category, selected or
 *   not — the whole catalog stays browsable. On narrow screens the list turns
 *   into a horizontal, scrollable chip row above the tiles (CSS only).
 * - **Search across categories.** The box filters every category at once over
 *   the localized labels (same matcher as the shared picker); results are
 *   listed grouped by category.
 * - **Tiles toggle.** Each item is a `<button aria-pressed>`, so it is
 *   reachable with Tab and toggled with Enter/Space.
 * - **Details on demand.** A selected amenity shows an "Agregar detalles"
 *   link (or "Detalles" plus a compact summary once something is declared)
 *   that opens {@link AmenityDetailsDialog}. There is no always-visible
 *   details table (owner's change to the mockup).
 *
 * Accommodation only. The venue/experience editors keep the shared
 * `CatalogPicker`, whose behavior this component does not touch.
 */

import { AddIcon, CheckIcon, EditIcon } from '@repo/icons';
import { type JSX, useId, useState } from 'react';
import {
    buildCatalogBrowserCategories,
    type CatalogBrowserCategory,
    type CatalogBrowserKind,
    type CatalogBrowserLabeler,
    countCatalogBrowserSelection,
    isCatalogBrowserSearching,
    resolveActiveCatalogCategory,
    searchCatalogBrowserCategories
} from '@/lib/amenity-catalog-browser';
import type { AmenityAttributeValue, AmenityData } from '@/lib/api/types';
import { groupAmenitiesByCategory, groupFeaturesByCategory } from '@/lib/catalog-categories';
import { translateAmenityName } from '@/lib/catalog-names';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AmenityCatalogBrowser.module.css';
import { AmenityDetailsDialog, type AmenityDetailsTarget } from './AmenityDetailsDialog.client';
import { summarizeAmenityAttributes } from './amenity-attribute-summary';

/** i18n namespace of the browser. */
const KEY = 'host.properties.editor.catalog';

/** Props for {@link AmenityCatalogBrowser}. */
export interface AmenityCatalogBrowserProps {
    readonly locale: SupportedLocale;
    /** Amenity catalog, already scoped to the accommodation vertical. */
    readonly amenities: readonly AmenityData[];
    /** Feature catalog, already scoped to the accommodation vertical. */
    readonly features: readonly AmenityData[];
    readonly selectedAmenityIds: ReadonlySet<string>;
    readonly selectedFeatureIds: ReadonlySet<string>;
    readonly onToggleAmenity: (id: string) => void;
    readonly onToggleFeature: (id: string) => void;
    /** Declared relation attributes, keyed by amenity id. */
    readonly amenityAttributes?: Readonly<Record<string, AmenityAttributeValue>>;
    /** Replaces the declared attributes of one amenity (the dialog's "Aplicar"). */
    readonly onChangeAmenityAttributes: (input: {
        readonly amenityId: string;
        readonly value: AmenityAttributeValue;
    }) => void;
}

/**
 * Accommodation amenity/feature browser. Renders nothing when both catalogs
 * are empty.
 *
 * @param props - {@link AmenityCatalogBrowserProps}
 * @returns The browser, or `null` for two empty catalogs
 */
export function AmenityCatalogBrowser({
    locale,
    amenities,
    features,
    selectedAmenityIds,
    selectedFeatureIds,
    onToggleAmenity,
    onToggleFeature,
    amenityAttributes,
    onChangeAmenityAttributes
}: AmenityCatalogBrowserProps): JSX.Element | null {
    const { t, tPlural } = createTranslations(locale);
    const idPrefix = useId();
    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [detailsTarget, setDetailsTarget] = useState<AmenityDetailsTarget | null>(null);

    if (amenities.length === 0 && features.length === 0) return null;

    const getLabel: CatalogBrowserLabeler = (item, kind) =>
        kind === 'amenity'
            ? translateAmenityName({ t, name: item.slug })
            : t(`accommodations.featureNames.${item.slug}`, item.slug);

    const categories = buildCatalogBrowserCategories({
        amenityGroups: groupAmenitiesByCategory({ amenities, t }),
        featureGroups: groupFeaturesByCategory({ features, t }),
        selectedAmenityIds,
        selectedFeatureIds
    });
    const isSearching = isCatalogBrowserSearching({ query });
    const results = searchCatalogBrowserCategories({ categories, query, getLabel });
    const resultCount = results.reduce((total, category) => total + category.items.length, 0);
    const active = resolveActiveCatalogCategory({ categories, activeId });
    const totalSelected = countCatalogBrowserSelection({ categories });
    const attributes = amenityAttributes ?? {};

    const searchId = `${idPrefix}-search`;
    const panelId = `${idPrefix}-panel`;
    const panelTitleId = `${idPrefix}-panel-title`;

    const isSelected = (item: AmenityData, kind: CatalogBrowserKind): boolean =>
        kind === 'amenity' ? selectedAmenityIds.has(item.id) : selectedFeatureIds.has(item.id);

    const renderTile = (item: AmenityData, kind: CatalogBrowserKind): JSX.Element => {
        const label = getLabel(item, kind);
        const selected = isSelected(item, kind);
        const summary =
            kind === 'amenity' ? summarizeAmenityAttributes({ value: attributes[item.id], t }) : [];
        const hasDetails = summary.length > 0;

        return (
            <li
                key={item.id}
                className={styles.tileItem}
            >
                <button
                    type="button"
                    className={styles.tile}
                    aria-pressed={selected}
                    data-kind={kind}
                    onClick={() =>
                        kind === 'amenity' ? onToggleAmenity(item.id) : onToggleFeature(item.id)
                    }
                >
                    <span
                        className={styles.tileCheck}
                        aria-hidden="true"
                    >
                        {selected && (
                            <CheckIcon
                                size={14}
                                weight="bold"
                            />
                        )}
                    </span>
                    <span className={styles.tileLabel}>{label}</span>
                </button>
                {selected && kind === 'amenity' && (
                    <div className={styles.details}>
                        <button
                            type="button"
                            className={styles.detailsLink}
                            aria-label={
                                hasDetails
                                    ? t(`${KEY}.editDetailsFor`, `Detalles de ${label}`, {
                                          name: label
                                      })
                                    : t(`${KEY}.addDetailsFor`, `Agregar detalles a ${label}`, {
                                          name: label
                                      })
                            }
                            onClick={() => setDetailsTarget({ id: item.id, name: label })}
                        >
                            {hasDetails ? (
                                <EditIcon
                                    size={14}
                                    weight="regular"
                                    aria-hidden="true"
                                />
                            ) : (
                                <AddIcon
                                    size={14}
                                    weight="bold"
                                    aria-hidden="true"
                                />
                            )}
                            <span>
                                {hasDetails
                                    ? t(`${KEY}.editDetails`, 'Detalles')
                                    : t(`${KEY}.addDetails`, 'Agregar detalles')}
                            </span>
                        </button>
                        {hasDetails && (
                            <span className={styles.detailsSummary}>{summary.join(' · ')}</span>
                        )}
                    </div>
                )}
            </li>
        );
    };

    const renderGrid = (category: CatalogBrowserCategory): JSX.Element => (
        <ul className={styles.grid}>
            {category.items.map((item) => renderTile(item, category.kind))}
        </ul>
    );

    const renderNavGroup = (kind: CatalogBrowserKind, title: string): JSX.Element | null => {
        const own = categories.filter((category) => category.kind === kind);
        if (own.length === 0) return null;
        const titleId = `${idPrefix}-nav-${kind}`;
        return (
            <div className={styles.navGroup}>
                <p
                    id={titleId}
                    className={styles.navGroupTitle}
                >
                    {title}
                </p>
                <ul
                    className={styles.navList}
                    aria-labelledby={titleId}
                >
                    {own.map((category) => {
                        const isActive = !isSearching && category.id === active?.id;
                        return (
                            <li key={category.id}>
                                <button
                                    type="button"
                                    className={styles.navButton}
                                    aria-current={isActive ? 'true' : undefined}
                                    aria-controls={panelId}
                                    onClick={() => {
                                        setActiveId(category.id);
                                        setQuery('');
                                    }}
                                >
                                    <span className={styles.navLabel}>{category.label}</span>
                                    {category.selectedCount > 0 && (
                                        <>
                                            <span
                                                className={styles.navCount}
                                                aria-hidden="true"
                                            >
                                                {category.selectedCount}
                                            </span>
                                            <span className="sr-only">
                                                {tPlural(
                                                    `${KEY}.selectedCount`,
                                                    category.selectedCount,
                                                    { count: category.selectedCount }
                                                )}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    return (
        <div className={styles.browser}>
            <div className={styles.toolbar}>
                <div className={styles.search}>
                    <label
                        htmlFor={searchId}
                        className={styles.searchLabel}
                    >
                        {t(`${KEY}.searchLabel`, 'Buscar en todo el catálogo')}
                    </label>
                    <input
                        id={searchId}
                        type="search"
                        className={styles.searchInput}
                        value={query}
                        placeholder={t(`${KEY}.searchPlaceholder`, 'Ej.: pileta, wifi, parrilla')}
                        autoComplete="off"
                        onChange={(event) => setQuery(event.target.value)}
                        // The browser lives inside the page <form>: Enter here
                        // must filter, never submit the section.
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') event.preventDefault();
                        }}
                    />
                </div>
                <p
                    className={styles.total}
                    aria-live="polite"
                >
                    {tPlural(`${KEY}.selectedCount`, totalSelected, { count: totalSelected })}
                </p>
            </div>

            {/* The ONE live region of the search: only the result count is
                announced, never the heading or the empty state as well. */}
            <p
                className="sr-only"
                role="status"
            >
                {isSearching
                    ? tPlural(`${KEY}.resultCount`, resultCount, { count: resultCount })
                    : ''}
            </p>

            <div className={styles.layout}>
                <nav
                    className={styles.nav}
                    aria-label={t(`${KEY}.categoriesLabel`, 'Categorías')}
                >
                    {renderNavGroup(
                        'amenity',
                        t('host.properties.editor.field.amenities', 'Comodidades')
                    )}
                    {renderNavGroup(
                        'feature',
                        t('host.properties.editor.field.features', 'Características')
                    )}
                </nav>

                <section
                    id={panelId}
                    className={styles.panel}
                    aria-labelledby={panelTitleId}
                >
                    {isSearching ? (
                        <>
                            <div className={styles.panelHeader}>
                                <h3
                                    id={panelTitleId}
                                    className={styles.panelTitle}
                                >
                                    {tPlural(`${KEY}.resultCount`, resultCount, {
                                        count: resultCount
                                    })}
                                </h3>
                            </div>
                            {results.length === 0 ? (
                                <p className={styles.noResults}>
                                    {t(
                                        'listing.owner.editor.amenities.picker.noResults',
                                        `No encontramos nada con "${query}".`,
                                        { query }
                                    )}
                                </p>
                            ) : (
                                results.map((category) => (
                                    <div
                                        key={category.id}
                                        className={styles.resultGroup}
                                    >
                                        <h4 className={styles.resultGroupTitle}>
                                            {category.label}
                                        </h4>
                                        {renderGrid(category)}
                                    </div>
                                ))
                            )}
                        </>
                    ) : (
                        active && (
                            <>
                                <div className={styles.panelHeader}>
                                    <h3
                                        id={panelTitleId}
                                        className={styles.panelTitle}
                                    >
                                        {active.label}
                                    </h3>
                                    <span className={styles.panelCount}>
                                        {t(
                                            `${KEY}.categoryProgress`,
                                            `${active.selectedCount} de ${active.items.length}`,
                                            {
                                                selected: active.selectedCount,
                                                total: active.items.length
                                            }
                                        )}
                                    </span>
                                </div>
                                {renderGrid(active)}
                            </>
                        )
                    )}
                </section>
            </div>

            <AmenityDetailsDialog
                locale={locale}
                target={detailsTarget}
                declared={detailsTarget ? attributes[detailsTarget.id] : undefined}
                onApply={onChangeAmenityAttributes}
                onClose={() => setDetailsTarget(null)}
            />
        </div>
    );
}
