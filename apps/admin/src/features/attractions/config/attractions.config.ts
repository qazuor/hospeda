import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Attraction, AttractionListItemSchema } from '../schemas/attractions.schemas';
import { createAttractionsColumns } from './attractions.columns';

export const attractionsConfig: EntityConfig<Attraction> = {
    name: 'attractions',
    displayName: 'Attraction',
    pluralDisplayName: 'Attractions',
    entityType: EntityType.ATTRACTION,

    // API
    apiEndpoint: '/api/v1/public/attractions',

    // Routes
    basePath: '/attractions',
    detailPath: '/attractions/[slug]',

    // Schemas - Use type assertion for Zod version compatibility
    listItemSchema: AttractionListItemSchema as unknown as z.ZodSchema<Attraction>,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        placeholder: 'Search attractions...',
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
        title: 'Attractions - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Attraction',
        createButtonPath: '/attractions/new'
    },

    // Columns
    createColumns: createAttractionsColumns
};

const { component, route } = createEntityListPage(attractionsConfig);
export { component as AttractionsPageComponent, route as AttractionsRoute };
