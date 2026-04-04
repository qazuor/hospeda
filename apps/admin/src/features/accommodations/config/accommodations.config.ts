import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Accommodation, AccommodationListItemSchema } from '../schemas/accommodations.schemas';
import { createAccommodationsColumns } from './accommodations.columns';

/**
 * Configuration for accommodations entity list
 */
export const accommodationsConfig: EntityConfig<Accommodation> = {
    // Metadata
    name: 'accommodations',
    entityKey: 'accommodation',
    entityType: EntityType.ACCOMMODATION,

    // API
    apiEndpoint: '/api/v1/admin/accommodations',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'status',
                labelKey: 'admin-filters.status.label',
                type: 'select',
                order: 1,
                options: [
                    { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
                    { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
                    { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' }
                ]
            },
            {
                paramKey: 'type',
                labelKey: 'admin-filters.accommodationType.label',
                type: 'select',
                order: 2,
                options: [
                    { value: 'APARTMENT', labelKey: 'admin-filters.accommodationType.apartment' },
                    { value: 'HOUSE', labelKey: 'admin-filters.accommodationType.house' },
                    {
                        value: 'COUNTRY_HOUSE',
                        labelKey: 'admin-filters.accommodationType.countryHouse'
                    },
                    { value: 'CABIN', labelKey: 'admin-filters.accommodationType.cabin' },
                    { value: 'HOTEL', labelKey: 'admin-filters.accommodationType.hotel' },
                    { value: 'HOSTEL', labelKey: 'admin-filters.accommodationType.hostel' },
                    { value: 'CAMPING', labelKey: 'admin-filters.accommodationType.camping' },
                    { value: 'ROOM', labelKey: 'admin-filters.accommodationType.room' },
                    { value: 'MOTEL', labelKey: 'admin-filters.accommodationType.motel' },
                    { value: 'RESORT', labelKey: 'admin-filters.accommodationType.resort' }
                ]
            },
            {
                paramKey: 'isFeatured',
                labelKey: 'admin-filters.isFeatured.label',
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
    basePath: '/accommodations',
    detailPath: '/accommodations/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    listItemSchema: AccommodationListItemSchema as unknown as z.ZodSchema<Accommodation>,

    // Search configuration
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
        enabled: true
    },

    // View configuration
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 12,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination configuration
    paginationConfig: {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 30, 50]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/accommodations/new'
    },

    // Columns
    createColumns: createAccommodationsColumns
};

// Generate the component and route
const { component, route } = createEntityListPage(accommodationsConfig);

export { component as AccommodationsPageComponent, route as AccommodationsRoute };
