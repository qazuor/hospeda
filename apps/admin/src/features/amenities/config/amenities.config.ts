import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Amenity, AmenityListItemSchema } from '../schemas/amenities.schemas';
import { createAmenitiesColumns } from './amenities.columns';

export const amenitiesConfig: EntityConfig<Amenity> = {
    name: 'amenities',
    entityKey: 'amenity',
    entityType: EntityType.AMENITY,

    // API
    apiEndpoint: '/api/v1/admin/amenities',

    // Routes
    basePath: '/content/accommodation-amenities',
    detailPath: '/content/accommodation-amenities/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    listItemSchema: AmenityListItemSchema as unknown as z.ZodSchema<Amenity>,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
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
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/content/accommodation-amenities/new'
    },

    // Columns
    createColumns: createAmenitiesColumns
};

const { component, route } = createEntityListPage(amenitiesConfig);
export { component as AmenitiesPageComponent, route as AmenitiesRoute };
