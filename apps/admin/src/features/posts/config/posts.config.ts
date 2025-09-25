import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Post, PostListItemSchema } from '../schemas/posts.schemas';
import { createPostsColumns } from './posts.columns';

export const postsConfig: EntityConfig<Post> = {
    name: 'posts',
    displayName: 'Post',
    pluralDisplayName: 'Posts',
    entityType: EntityType.POST,

    // API
    apiEndpoint: '/api/v1/public/posts',

    // Routes
    basePath: '/posts',
    detailPath: '/posts/[slug]',

    // Schemas
    listItemSchema: PostListItemSchema as unknown as z.ZodSchema<Post>,

    // Search configuration
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
        placeholder: 'Search posts...',
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
        title: 'Posts - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Post',
        createButtonPath: '/posts/new'
    },

    // Columns
    createColumns: createPostsColumns
};

const { component, route } = createEntityListPage(postsConfig);
export { component as PostsPageComponent, route as PostsRoute };
