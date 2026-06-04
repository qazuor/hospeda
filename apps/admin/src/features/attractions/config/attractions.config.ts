import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Attraction, AttractionListItemSchema } from '../schemas/attractions.schemas';
import { createAttractionsColumns } from './attractions.columns';

export const attractionsConfig: EntityConfig<Attraction> = {
    name: 'attractions',
    entityKey: 'attraction',
    entityType: EntityType.ATTRACTION,

    // API
    apiEndpoint: '/api/v1/admin/attractions',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'isFeatured',
                labelKey: 'admin-filters.isFeatured.label',
                type: 'boolean',
                order: 1
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
    basePath: '/content/destination-attractions',
    detailPath: '/content/destination-attractions/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Attraction>, but AttractionListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: AttractionListItemSchema as unknown as z.ZodSchema<Attraction>,

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
            maxFields: 8,
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
        createButtonPath: '/content/destination-attractions/new'
    },

    // Columns
    createColumns: createAttractionsColumns
};

const { component, route } = createEntityListPage(attractionsConfig);
export { component as AttractionsPageComponent, route as AttractionsRoute };
