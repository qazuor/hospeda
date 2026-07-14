import type { z } from 'zod';
import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import {
    type PointOfInterest,
    PointOfInterestListItemSchema
} from '../schemas/points-of-interest.schemas';
import { createPointOfInterestColumns } from './points-of-interest.columns';

export const pointOfInterestConfig: EntityConfig<PointOfInterest> = {
    name: 'points-of-interest',
    entityKey: 'pointOfInterest',
    entityType: EntityType.POINT_OF_INTEREST,

    // API
    apiEndpoint: '/api/v1/admin/points-of-interest',

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
                paramKey: 'hasOwnPage',
                labelKey: 'admin-filters.hasOwnPage.label',
                type: 'boolean',
                order: 2
            },
            {
                paramKey: 'verified',
                labelKey: 'admin-filters.verified.label',
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
    basePath: '/content/points-of-interest',
    detailPath: '/content/points-of-interest/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<PointOfInterest>, but PointOfInterestListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: PointOfInterestListItemSchema as unknown as z.ZodSchema<PointOfInterest>,

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
        createButtonPath: '/content/points-of-interest/new'
    },

    // Columns
    createColumns: createPointOfInterestColumns
};

const { component, route } = createEntityListPage(pointOfInterestConfig);

export { component as PointsOfInterestPageComponent, route as PointsOfInterestRoute };
