import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type HostTradeListItem, HostTradeListItemSchema } from '../schemas/host-trades.schemas';
import { createHostTradesColumns } from './host-trades.columns';

/**
 * Entity configuration for the host-trades admin list page.
 *
 * Endpoint: `GET /api/v1/admin/host-trades`
 * Supports filter params: page, pageSize, search, destinationId, category, isActive,
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
                paramKey: 'category',
                labelKey: 'admin-filters.hostTradeCategory.label',
                type: 'select',
                order: 1,
                options: [
                    {
                        value: 'CERRAJERIA',
                        labelKey: 'admin-filters.hostTradeCategory.cerrajeria'
                    },
                    {
                        value: 'PLOMERIA',
                        labelKey: 'admin-filters.hostTradeCategory.plomeria'
                    },
                    {
                        value: 'ELECTRICIDAD',
                        labelKey: 'admin-filters.hostTradeCategory.electricidad'
                    },
                    { value: 'GAS', labelKey: 'admin-filters.hostTradeCategory.gas' },
                    {
                        value: 'CLIMATIZACION',
                        labelKey: 'admin-filters.hostTradeCategory.climatizacion'
                    },
                    {
                        value: 'LIMPIEZA',
                        labelKey: 'admin-filters.hostTradeCategory.limpieza'
                    },
                    {
                        value: 'FLETES',
                        labelKey: 'admin-filters.hostTradeCategory.fletes'
                    },
                    {
                        value: 'VIDRIERIA',
                        labelKey: 'admin-filters.hostTradeCategory.vidrieria'
                    },
                    {
                        value: 'CARPINTERIA',
                        labelKey: 'admin-filters.hostTradeCategory.carpinteria'
                    },
                    {
                        value: 'PILETA_JARDIN',
                        labelKey: 'admin-filters.hostTradeCategory.piletaJardin'
                    },
                    {
                        value: 'PLAGAS',
                        labelKey: 'admin-filters.hostTradeCategory.plagas'
                    },
                    {
                        value: 'INTERNET',
                        labelKey: 'admin-filters.hostTradeCategory.internet'
                    },
                    {
                        value: 'ALBANILERIA',
                        labelKey: 'admin-filters.hostTradeCategory.albanileria'
                    }
                ]
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

    // Schema — cast required because HostTradeListItemSchema has branded effects
    // from @repo/schemas that are structurally compatible but brand-only mismatched.
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
