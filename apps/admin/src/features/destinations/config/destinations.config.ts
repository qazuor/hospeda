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
    apiEndpoint: '/api/v1/public/destinations',

    // Routes
    basePath: '/destinations',
    detailPath: '/destinations/[slug]',

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
