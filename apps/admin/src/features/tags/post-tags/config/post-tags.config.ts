import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { PostTagSchema } from '@repo/schemas';
import type { PostTag } from '@repo/schemas';
import type { z } from 'zod';
import { createPostTagsColumns } from './post-tags.columns';

/**
 * Entity config for the post-tags admin list.
 *
 * Migrates the hand-rolled `<table>` at `routes/_authed/tags/post-tags/index.tsx`
 * onto `createEntityListPage` so the list inherits FilterBar + grid view + peek drawer.
 *
 * API endpoint: `/api/v1/admin/posts/tags`
 * Params: `status` (lifecycle state filter), `search` (name substring), `page`, `pageSize`.
 *
 * Existing create/edit navigation (`new.tsx` and `$id_.edit.tsx`) is preserved —
 * this config does NOT change those routes.
 *
 * @see SPEC-185 Phase 5 / T-013
 * @see apps/admin/src/routes/_authed/tags/post-tags/index.tsx
 */
export const postTagsConfig: EntityConfig<PostTag> = {
    name: 'post-tags',
    entityKey: 'tag',
    entityType: EntityType.TAG,

    // API
    apiEndpoint: '/api/v1/admin/posts/tags',

    // Filter bar configuration.
    // status → lifecycle state filter (ACTIVE / INACTIVE / ARCHIVED).
    // includeDeleted → shows soft-deleted tags.
    filterBarConfig: {
        filters: [
            {
                paramKey: 'status',
                labelKey: 'admin-filters.status.label',
                type: 'select',
                order: 1,
                options: [
                    {
                        value: 'ACTIVE',
                        labelKey: 'admin-entities.states.lifecycle.active'
                    },
                    {
                        value: 'INACTIVE',
                        labelKey: 'admin-entities.states.lifecycle.inactive'
                    },
                    {
                        value: 'ARCHIVED',
                        labelKey: 'admin-entities.states.lifecycle.archived'
                    },
                    {
                        value: 'DRAFT',
                        labelKey: 'admin-entities.states.lifecycle.draft'
                    }
                ]
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
    basePath: '/tags/post-tags',

    // Schemas.
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<PostTag>, but
    // PostTagSchema carries branded effects from @repo/schemas; structurally compatible,
    // brand-only mismatch.
    listItemSchema: PostTagSchema as unknown as z.ZodSchema<PostTag>,

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
            maxFields: 6,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination configuration
    paginationConfig: {
        defaultPageSize: 25,
        allowedPageSizes: [10, 25, 50, 100]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/tags/post-tags/new'
    },

    // Peek drawer fields
    peekFields: [
        { accessorKey: 'id', labelKey: 'admin-entities.columns.id' },
        { accessorKey: 'name', labelKey: 'admin-entities.columns.name' },
        { accessorKey: 'slug', labelKey: 'admin-entities.columns.slug' },
        { accessorKey: 'color', labelKey: 'admin-entities.columns.type' },
        {
            accessorKey: 'lifecycleState',
            labelKey: 'admin-entities.columns.status',
            format: 'badge'
        },
        { accessorKey: 'description', labelKey: 'admin-entities.columns.description' },
        { accessorKey: 'createdAt', labelKey: 'admin-entities.columns.createdAt', format: 'date' }
    ],

    peekSubtitleField: 'slug',

    // Columns
    createColumns: createPostTagsColumns
};

const { component, route } = createEntityListPage(postTagsConfig);
export { component as PostTagsPageComponent, route as PostTagsRoute };
