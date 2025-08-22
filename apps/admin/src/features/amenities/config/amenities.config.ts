import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { type Amenity, AmenityListItemSchema } from '../schemas/amenities.schemas';
import { createAmenitiesColumns } from './amenities.columns';

export const amenitiesConfig: EntityConfig<Amenity> = {
    name: 'amenities',
    displayName: 'Amenity',
    pluralDisplayName: 'Amenities',
    entityType: EntityType.AMENITY,

    // API
    apiEndpoint: '/api/v1/public/amenities',

    // Routes
    basePath: '/amenities',
    detailPath: '/amenities/[slug]',

    // Schemas
    listItemSchema: AmenityListItemSchema,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        placeholder: 'Search amenities...',
        enabled: true
    },

    // View configuration
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 9,
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
        allowedPageSizes: [10, 20, 50, 100]
    },

    // Layout configuration
    layoutConfig: {
        title: 'Amenities - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Amenity',
        createButtonPath: '/amenities/new'
    },

    // Columns
    createColumns: createAmenitiesColumns
};

const { component, route } = createEntityListPage(amenitiesConfig);
export { component as AmenitiesPageComponent, route as AmenitiesRoute };
