import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { TagSchema } from '@repo/schemas';
import type { Tag } from '@repo/schemas';
import type { z } from 'zod';
import { createInternalTagsColumns } from './internal-tags.columns';

/**
 * Entity config for the internal-tags admin list.
 *
 * Migrates the hand-rolled `<table>` at
 * `routes/_authed/platform/tags/internal/index.tsx` onto `createEntityListPage`
 * so the list inherits FilterBar + grid view + peek drawer.
 *
 * INTERNAL tags are only visible to admin users with `TAG_INTERNAL_VIEW`
 * permission — they are never shown to regular users.
 *
 * API endpoint: `/api/v1/admin/tags/internal`
 * Params: `status` (lifecycle state), `search` (name substring), `page`, `pageSize`.
 *
 * Existing create/edit navigation (`new.tsx` and `$id_.edit.tsx`) is preserved —
 * this config does NOT change those routes.
 *
 * @see SPEC-185 Phase 5 / T-014
 * @see apps/admin/src/routes/_authed/platform/tags/internal/index.tsx
 */
export const internalTagsConfig: EntityConfig<Tag> = {
    name: 'internal-tags',
    entityKey: 'tag',
    entityType: EntityType.TAG,

    // API
    apiEndpoint: '/api/v1/admin/tags/internal',

    // Filter bar configuration.
    // status → lifecycle state filter (ACTIVE / INACTIVE / ARCHIVED / DRAFT).
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
    basePath: '/platform/tags/internal',

    // Schemas.
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Tag>, but
    // TagSchema carries branded effects from @repo/schemas; structurally compatible,
    // brand-only mismatch.
    listItemSchema: TagSchema as unknown as z.ZodSchema<Tag>,

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
            maxFields: 5,
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
        createButtonPath: '/platform/tags/internal/new'
    },

    // Peek drawer fields
    peekFields: [
        { accessorKey: 'id', labelKey: 'admin-entities.columns.id' },
        { accessorKey: 'name', labelKey: 'admin-entities.columns.name' },
        { accessorKey: 'color', labelKey: 'admin-entities.columns.type' },
        {
            accessorKey: 'lifecycleState',
            labelKey: 'admin-entities.columns.status',
            format: 'badge'
        },
        { accessorKey: 'description', labelKey: 'admin-entities.columns.description' },
        { accessorKey: 'createdAt', labelKey: 'admin-entities.columns.createdAt', format: 'date' }
    ],

    // Columns
    createColumns: createInternalTagsColumns
};

const { component, route } = createEntityListPage(internalTagsConfig);
export { component as InternalTagsPageComponent, route as InternalTagsRoute };
