import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { UserTagWithOwner } from '@/hooks/use-user-tag-moderation';
import { TagSchema } from '@repo/schemas';
import { z } from 'zod';
import { createUserModerationTagsColumns } from './user-moderation-tags.columns';

/**
 * Runtime Zod schema for `UserTagWithOwner`.
 *
 * Extends `TagSchema` with the owner-enriched fields added by the
 * `/api/v1/admin/tags/user` endpoint. All extra fields are optional
 * because the API may return them as null/undefined depending on whether
 * the owner account still exists.
 *
 * This schema lives here (not in @repo/schemas) because `UserTagWithOwner`
 * is an admin-only view model — it is not part of the canonical entity contract.
 */
const UserTagWithOwnerSchema = TagSchema.extend({
    ownerDisplayName: z.string().optional(),
    ownerEmail: z.string().optional(),
    ownerRole: z.string().optional(),
    usageCount: z.number().int().min(0).optional()
});

/**
 * Entity config for the user-moderation tags admin list.
 *
 * Migrates the hand-rolled `<table>` at
 * `routes/_authed/tags/user-moderation/index.tsx` onto `createEntityListPage`
 * so the list inherits FilterBar + grid view + peek drawer.
 *
 * User-moderation key constraints (per D-012):
 * - NO create button (user tags are created by users, not admins).
 * - NO edit action per row (TAG_USER_UPDATE_ANY is intentionally excluded).
 * - DELETE action only (requires TAG_USER_DELETE_ANY).
 *
 * API endpoint: `/api/v1/admin/tags/user`
 * Params: `search`, `page`, `pageSize`.
 *
 * @see SPEC-185 Phase 5 / T-015
 * @see D-012 (TAG_USER_UPDATE_ANY exclusion)
 * @see AC-008-01, AC-008-02
 * @see apps/admin/src/routes/_authed/tags/user-moderation/index.tsx
 */
export const userModerationTagsConfig: EntityConfig<UserTagWithOwner> = {
    name: 'user-moderation-tags',
    entityKey: 'tag',
    entityType: EntityType.TAG,

    // API
    apiEndpoint: '/api/v1/admin/tags/user',

    // Filter bar: no lifecycle-state filter exposed by this endpoint (all USER tags).
    // includeDeleted is the only generic filter available.
    filterBarConfig: {
        filters: [
            {
                paramKey: 'includeDeleted',
                labelKey: 'admin-filters.includeDeleted.label',
                type: 'boolean',
                order: 99
            }
        ]
    },

    // Routes
    basePath: '/tags/user-moderation',

    // Schemas.
    // TYPE-WORKAROUND: UserTagWithOwnerSchema is defined locally (not exported from
    // @repo/schemas) and carries effects; cast to satisfy EntityConfig generic.
    listItemSchema: UserTagWithOwnerSchema as unknown as z.ZodSchema<UserTagWithOwner>,

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
        defaultPageSize: 50,
        allowedPageSizes: [25, 50, 100]
    },

    // Layout configuration: NO create button (D-012 — user tags are user-owned).
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: false
    },

    // Peek drawer fields
    peekFields: [
        { accessorKey: 'id', labelKey: 'admin-entities.columns.id' },
        { accessorKey: 'name', labelKey: 'admin-entities.columns.name' },
        { accessorKey: 'ownerDisplayName', labelKey: 'admin-entities.columns.owner' },
        { accessorKey: 'ownerEmail', labelKey: 'admin-entities.columns.email' },
        { accessorKey: 'ownerRole', labelKey: 'admin-entities.columns.type' },
        { accessorKey: 'color', labelKey: 'admin-entities.columns.type' },
        {
            accessorKey: 'lifecycleState',
            labelKey: 'admin-entities.columns.status',
            format: 'badge'
        },
        { accessorKey: 'createdAt', labelKey: 'admin-entities.columns.createdAt', format: 'date' }
    ],

    // Columns
    createColumns: createUserModerationTagsColumns
};

const { component, route } = createEntityListPage(userModerationTagsConfig);
export { component as UserModerationTagsPageComponent, route as UserModerationTagsRoute };
