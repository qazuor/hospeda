import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Destination, DestinationListItemSchema } from '../schemas/destinations.schemas';
import { createDestinationsColumns } from './destinations.columns';

/**
 * Configuration for destinations entity list
 */
export const destinationsConfig: EntityConfig<Destination> = {
    // Metadata
    name: 'destinations',
    entityKey: 'destination',
    entityType: EntityType.DESTINATION,

    // API
    apiEndpoint: '/api/v1/admin/destinations',

    // Filter bar configuration (defaultValue: 'CITY' on destinationType replaces legacy defaultFilters)
    filterBarConfig: {
        filters: [
            {
                paramKey: 'destinationType',
                labelKey: 'admin-filters.destinationType.label',
                type: 'select',
                defaultValue: 'CITY',
                order: 1,
                options: [
                    { value: 'COUNTRY', labelKey: 'admin-filters.destinationType.country' },
                    { value: 'REGION', labelKey: 'admin-filters.destinationType.region' },
                    { value: 'PROVINCE', labelKey: 'admin-filters.destinationType.province' },
                    { value: 'DEPARTMENT', labelKey: 'admin-filters.destinationType.department' },
                    { value: 'CITY', labelKey: 'admin-filters.destinationType.city' },
                    { value: 'TOWN', labelKey: 'admin-filters.destinationType.town' },
                    {
                        value: 'NEIGHBORHOOD',
                        labelKey: 'admin-filters.destinationType.neighborhood'
                    }
                ]
            },
            {
                paramKey: 'status',
                labelKey: 'admin-filters.status.label',
                type: 'select',
                order: 2,
                options: [
                    { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
                    { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
                    { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' }
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
    basePath: '/destinations',
    detailPath: '/destinations/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    listItemSchema: DestinationListItemSchema as unknown as z.ZodSchema<Destination>,

    // Search configuration
    searchConfig: {
        minChars: 5,
        debounceMs: 500,
        enabled: true
    },

    // View configuration
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 10,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination configuration
    paginationConfig: {
        defaultPageSize: 10,
        allowedPageSizes: [10, 20, 30, 50]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/destinations/new'
    },

    // Columns
    createColumns: createDestinationsColumns
};

// Generate the component and route
const { component, route } = createEntityListPage(destinationsConfig);

export { component as DestinationsPageComponent, route as DestinationsRoute };
