import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { type Feature, FeatureListItemSchema } from '../schemas/features.schemas';
import { createFeaturesColumns } from './features.columns';

export const featuresConfig: EntityConfig<Feature> = {
    name: 'features',
    displayName: 'Feature',
    pluralDisplayName: 'Features',
    entityType: EntityType.FEATURE,

    // API
    apiEndpoint: '/api/v1/public/features',

    // Routes
    basePath: '/features',
    detailPath: '/features/[slug]',

    // Schemas
    listItemSchema: FeatureListItemSchema,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        placeholder: 'Search features...',
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
        title: 'Features - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Feature',
        createButtonPath: '/features/new'
    },

    // Columns
    createColumns: createFeaturesColumns
};

const { component, route } = createEntityListPage(featuresConfig);
export { component as FeaturesPageComponent, route as FeaturesRoute };
