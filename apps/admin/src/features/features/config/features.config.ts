import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Feature, FeatureListItemSchema } from '../schemas/features.schemas';
import { createFeaturesColumns } from './features.columns';

export const featuresConfig: EntityConfig<Feature> = {
    name: 'features',
    entityKey: 'feature',
    entityType: EntityType.FEATURE,

    // API
    apiEndpoint: '/api/v1/admin/features',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'isBuiltin',
                labelKey: 'admin-filters.isBuiltin.label',
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
    basePath: '/content/accommodation-features',
    detailPath: '/content/accommodation-features/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Feature>, but FeatureListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: FeatureListItemSchema as unknown as z.ZodSchema<Feature>,

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
        createButtonPath: '/content/accommodation-features/new'
    },

    // Columns
    createColumns: createFeaturesColumns
};

const { component, route } = createEntityListPage(featuresConfig);
export { component as FeaturesPageComponent, route as FeaturesRoute };
