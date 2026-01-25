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
    apiEndpoint: '/api/v1/public/posts',

    // Routes
    basePath: '/posts',
    detailPath: '/posts/[slug]',

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
