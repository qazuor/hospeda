/**
 * @file events-filter-groups.ts
 * @description Shared `FilterGroup[]` config for the events sidebar. Used by
 * both the main `/eventos/` listing and the per-category facet landings
 * (`/eventos/categoria/{category}/`, SPEC-306) so the two pages can never
 * drift apart on the available filters.
 */

import type { FilterGroup } from '@/components/shared/filters/FilterSidebar.client';
import type { TranslationFn } from '@/lib/i18n';

/** Minimal destination shape needed to populate the "Lugar" select-search options. */
export interface EventFilterDestination {
    readonly id: string;
    readonly name: string;
    readonly isFeatured?: boolean | null;
}

interface BuildEventsFilterGroupsParams {
    /** Bound translation function for the active locale. */
    readonly t: TranslationFn;
    /** Destinations catalog used to populate the "Lugar" select-search options. */
    readonly destinations: readonly EventFilterDestination[];
    /**
     * When true, omits the category checkbox group. Used by the per-category
     * facet landings (`/eventos/categoria/{category}/`), where the category
     * is already fixed by the URL path rather than user-selectable.
     */
    readonly excludeCategory?: boolean;
}

/**
 * Builds the `filterGroups` config consumed by `FilterSidebar` on the events
 * listing: search, featured toggle, category checkbox (optional), date
 * range, destination select, and the composite price filter.
 */
export function buildEventsFilterGroups({
    t,
    destinations,
    excludeCategory = false
}: BuildEventsFilterGroupsParams): FilterGroup[] {
    const categoryGroup: FilterGroup = {
        id: 'category',
        label: t('events.filters.category', 'Categoría'),
        type: 'checkbox',
        options: [
            { value: 'MUSIC', label: t('events.categories.music', 'Música') },
            { value: 'CULTURE', label: t('events.categories.culture', 'Cultura') },
            { value: 'SPORTS', label: t('events.categories.sports', 'Deportes') },
            { value: 'GASTRONOMY', label: t('events.categories.gastronomy', 'Gastronomía') },
            { value: 'FESTIVAL', label: t('events.categories.festival', 'Festival') },
            { value: 'NATURE', label: t('events.categories.nature', 'Naturaleza') },
            { value: 'THEATER', label: t('events.categories.theater', 'Teatro') },
            { value: 'WORKSHOP', label: t('events.categories.workshop', 'Taller') },
            { value: 'OTHER', label: t('events.categories.other', 'Otros') }
        ]
    };

    return [
        {
            id: 'q',
            label: t('events.filters.search', 'Buscar'),
            type: 'search'
        },
        {
            id: 'isFeatured',
            label: t('events.filters.featured', 'Solo destacados'),
            type: 'toggle'
        },
        ...(excludeCategory ? [] : [categoryGroup]),
        {
            id: 'date',
            label: t('events.filters.date', 'Fecha'),
            type: 'date-range',
            checkInPlaceholder: t('events.filters.dateFrom', 'Desde'),
            checkOutPlaceholder: t('events.filters.dateTo', 'Hasta'),
            fromParam: 'startDateAfter',
            toParam: 'startDateBefore',
            mode: 'bounds',
            allowPastDates: true
        },
        {
            id: 'destinationId',
            label: t('events.filters.location', 'Lugar'),
            type: 'select-search',
            options: destinations.map((d) => ({
                value: d.id,
                label: d.name,
                featured: Boolean(d.isFeatured)
            })),
            maxVisible: 8,
            maxSelections: 1
        },
        {
            id: 'price',
            label: t('events.filters.price', 'Precio'),
            type: 'price-composite',
            min: 0,
            max: 10000,
            step: 100,
            format: 'currency',
            includeUnpricedLabel: t(
                'events.filters.includeUnpricedToggle',
                'Incluir eventos sin información de precio'
            ),
            isFreeLabel: t('events.filters.onlyFree', 'Solo eventos gratuitos'),
            rangeLabel: t('events.filters.priceRange', 'Rango de precio')
        }
    ];
}
