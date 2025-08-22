import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { type Accommodation, AccommodationListItemSchema } from '../schemas/accommodations.schemas';
import { createAccommodationsColumns } from './accommodations.columns';

/**
 * Configuration for accommodations entity list
 */
export const accommodationsConfig: EntityConfig<Accommodation> = {
    // Metadata
    name: 'accommodations',
    displayName: 'Accommodation',
    pluralDisplayName: 'Accommodations',
    entityType: EntityType.ACCOMMODATION,

    // API
    apiEndpoint: '/api/v1/public/accommodations',

    // Routes
    basePath: '/accommodations',
    detailPath: '/accommodations/[slug]',

    // Schemas
    listItemSchema: AccommodationListItemSchema,

    // Search configuration
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
        placeholder: 'Search accommodations...',
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
        title: 'Accommodations - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Accommodation',
        createButtonPath: '/accommodations/new'
    },

    // Columns
    createColumns: createAccommodationsColumns
};

// Generate the component and route
const { component, route } = createEntityListPage(accommodationsConfig);

export { component as AccommodationsPageComponent, route as AccommodationsRoute };
