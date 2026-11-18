import type { z } from 'zod';
import { loadHostTradeCategoryFilterOptions } from '@/components/entity-form/fields/entity-selects/utils';
import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { type HostTradeListItem, HostTradeListItemSchema } from '../schemas/host-trades.schemas';
import { createHostTradesColumns } from './host-trades.columns';

/**
 * Entity configuration for the host-trades admin list page.
 *
 * Endpoint: `GET /api/v1/admin/host-trades`
 * Supports filter params: page, pageSize, search, destinationId, categories (comma-separated slugs, any-of), isActive,
 * is24h, includeDeleted.
 */
export const hostTradesConfig: EntityConfig<HostTradeListItem> = {
    name: 'host-trades',
    entityKey: 'hostTrade',
    entityType: EntityType.HOST_TRADE,

    // API
    apiEndpoint: '/api/v1/admin/host-trades',

    // Filter bar
    filterBarConfig: {
        filters: [
            {
                paramKey: 'destinationId',
                labelKey: 'admin-filters.destination.label',
                type: 'text',
                order: 0,
                debounceMs: 400,
                maxLength: 36
            },
            {
                // Catalog-driven any-of filter (HOS-919): options are loaded from
                // the admin catalog and the API receives comma-separated slugs.
                paramKey: 'categories',
                labelKey: 'admin-filters.hostTradeCategories.label',
                type: 'multi-select',
                order: 1,
                optionsQueryKey: ['host-trade-category-filter-options'],
                loadOptions: loadHostTradeCategoryFilterOptions
            },
            {
                paramKey: 'isActive',
                labelKey: 'admin-filters.isActive.label',
                type: 'boolean',
                order: 2
            },
            {
                paramKey: 'is24h',
                labelKey: 'admin-filters.is24h.label',
                type: 'boolean',
                order: 3
            },
            {
                paramKey: 'includeDeleted',
                labelKey: 'admin-filters.includeDeleted.label',
                type: 'boolean',
                order: 99
            }
        ]
    },

    // Routes
    basePath: '/platform/host-trades',
    detailPath: '/platform/host-trades/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<HostTradeListItem>, but HostTradeListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: HostTradeListItemSchema as unknown as z.ZodSchema<HostTradeListItem>,

    // Search
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        enabled: true
    },

    // View
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: false
    },

    // Pagination
    paginationConfig: {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 50, 100]
    },

    // Layout
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/platform/host-trades/new'
    },

    // Columns
    createColumns: createHostTradesColumns
};

const { component, route } = createEntityListPage(hostTradesConfig);

export { component as HostTradesPageComponent, route as HostTradesRoute };
