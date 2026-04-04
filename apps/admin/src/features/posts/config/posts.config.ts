import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Post, PostListItemWithComputedFieldsSchema } from '../schemas/posts.schemas';
import { createPostsColumns } from './posts.columns';

export const postsConfig: EntityConfig<Post> = {
    name: 'posts',
    entityKey: 'post',
    entityType: EntityType.POST,

    // API
    apiEndpoint: '/api/v1/admin/posts',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'status',
                labelKey: 'admin-filters.status.label',
                type: 'select',
                order: 1,
                options: [
                    { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
                    { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
                    { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' }
                ]
            },
            {
                paramKey: 'category',
                labelKey: 'admin-filters.postCategory.label',
                type: 'select',
                order: 2,
                options: [
                    { value: 'EVENTS', labelKey: 'admin-filters.postCategory.events' },
                    { value: 'CULTURE', labelKey: 'admin-filters.postCategory.culture' },
                    { value: 'GASTRONOMY', labelKey: 'admin-filters.postCategory.gastronomy' },
                    { value: 'NATURE', labelKey: 'admin-filters.postCategory.nature' },
                    { value: 'TOURISM', labelKey: 'admin-filters.postCategory.tourism' },
                    { value: 'GENERAL', labelKey: 'admin-filters.postCategory.general' },
                    { value: 'SPORT', labelKey: 'admin-filters.postCategory.sport' },
                    { value: 'CARNIVAL', labelKey: 'admin-filters.postCategory.carnival' },
                    { value: 'NIGHTLIFE', labelKey: 'admin-filters.postCategory.nightlife' },
                    { value: 'HISTORY', labelKey: 'admin-filters.postCategory.history' },
                    { value: 'TRADITIONS', labelKey: 'admin-filters.postCategory.traditions' },
                    { value: 'WELLNESS', labelKey: 'admin-filters.postCategory.wellness' },
                    { value: 'FAMILY', labelKey: 'admin-filters.postCategory.family' },
                    { value: 'TIPS', labelKey: 'admin-filters.postCategory.tips' },
                    { value: 'ART', labelKey: 'admin-filters.postCategory.art' },
                    { value: 'BEACH', labelKey: 'admin-filters.postCategory.beach' },
                    { value: 'RURAL', labelKey: 'admin-filters.postCategory.rural' },
                    { value: 'FESTIVALS', labelKey: 'admin-filters.postCategory.festivals' }
                ]
            },
            {
                paramKey: 'isFeatured',
                labelKey: 'admin-filters.isFeatured.label',
                type: 'boolean',
                order: 3
            },
            {
                paramKey: 'isNews',
                labelKey: 'admin-filters.isNews.label',
                type: 'boolean',
                order: 4
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
    basePath: '/posts',
    detailPath: '/posts/[id]',

    // Schemas
    listItemSchema: PostListItemWithComputedFieldsSchema as unknown as z.ZodSchema<Post>,

    // Search configuration
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
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
        defaultPageSize: 15,
        allowedPageSizes: [10, 15, 30, 50]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/posts/new'
    },

    // Columns
    createColumns: createPostsColumns
};

const { component, route } = createEntityListPage(postsConfig);
export { component as PostsPageComponent, route as PostsRoute };
