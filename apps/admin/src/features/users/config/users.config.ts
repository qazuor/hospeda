import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type User, UserListItemWithComputedFieldsSchema } from '../schemas/users.schemas';
import { createUsersColumns } from './users.columns';

/**
 * Configuration for users entity list
 */
export const usersConfig: EntityConfig<User> = {
    // Metadata
    name: 'users',
    entityKey: 'user',
    entityType: EntityType.USER,

    // API
    apiEndpoint: '/api/v1/admin/users',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'role',
                labelKey: 'admin-filters.role.label',
                type: 'select',
                order: 1,
                options: [
                    { value: 'SUPER_ADMIN', labelKey: 'admin-filters.role.superAdmin' },
                    { value: 'ADMIN', labelKey: 'admin-filters.role.admin' },
                    { value: 'CLIENT_MANAGER', labelKey: 'admin-filters.role.clientManager' },
                    { value: 'EDITOR', labelKey: 'admin-filters.role.editor' },
                    { value: 'HOST', labelKey: 'admin-filters.role.host' },
                    { value: 'SPONSOR', labelKey: 'admin-filters.role.sponsor' },
                    { value: 'USER', labelKey: 'admin-filters.role.user' },
                    { value: 'GUEST', labelKey: 'admin-filters.role.guest' }
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
    basePath: '/access/users',
    detailPath: '/access/users/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<User>, but UserListItemWithComputedFieldsSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: UserListItemWithComputedFieldsSchema as unknown as z.ZodSchema<User>,

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
            maxFields: 10,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 4
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
        createButtonPath: '/access/users/new'
    },

    // Columns
    createColumns: createUsersColumns,

    /**
     * Curated peek drawer fields for users.
     *
     * Badge fields (role, authProvider, visibility, lifecycleState) all have matching
     * badge columns in users.columns.ts — badgeOptions are resolved automatically.
     *
     * Users have no `isFeatured` field, so `peekFeaturedField` is omitted.
     * `peekSubtitleField` uses `email` instead of `slug` as the identifiable subtitle.
     *
     * Only fields present on the UserListItemWithComputedFieldsSchema are used.
     * The title resolver in EntityListPage falls back to `displayName` so the
     * drawer header shows the user's display name correctly.
     * Field order follows the product-owner specification exactly.
     */
    peekFields: [
        { accessorKey: 'id', labelKey: 'admin-entities.columns.id', format: 'text' },
        {
            accessorKey: 'role',
            labelKey: 'admin-entities.columns.role',
            format: 'badge'
        },
        {
            accessorKey: 'authProvider',
            labelKey: 'admin-entities.columns.authProvider',
            format: 'badge'
        },
        {
            accessorKey: 'visibility',
            labelKey: 'admin-entities.columns.visibility',
            format: 'badge'
        },
        {
            accessorKey: 'lifecycleState',
            labelKey: 'admin-entities.columns.status',
            format: 'badge'
        },
        {
            accessorKey: 'firstName',
            labelKey: 'admin-entities.columns.firstName',
            format: 'text'
        },
        {
            accessorKey: 'lastName',
            labelKey: 'admin-entities.columns.lastName',
            format: 'text'
        },
        { accessorKey: 'slug', labelKey: 'admin-entities.columns.slug', format: 'text' },
        {
            accessorKey: 'image',
            labelKey: 'admin-entities.columns.avatar',
            format: 'image'
        },
        {
            accessorKey: 'locationCity',
            labelKey: 'admin-entities.columns.locationCity',
            format: 'text'
        },
        {
            accessorKey: 'emailVerified',
            labelKey: 'admin-entities.columns.emailVerified',
            format: 'boolean'
        },
        {
            accessorKey: 'banned',
            labelKey: 'admin-entities.columns.banned',
            format: 'boolean'
        },
        {
            accessorKey: 'banReason',
            labelKey: 'admin-entities.columns.banReason',
            format: 'text'
        },
        {
            accessorKey: 'banExpires',
            labelKey: 'admin-entities.columns.banExpires',
            format: 'date'
        },
        {
            accessorKey: 'createdAt',
            labelKey: 'admin-entities.columns.createdAt',
            format: 'date'
        },
        {
            accessorKey: 'updatedAt',
            labelKey: 'admin-entities.columns.updatedAt',
            format: 'date'
        }
    ],
    // Header: email as subtitle (users have no isFeatured field).
    peekSubtitleField: 'email'
};

const { component, route } = createEntityListPage(usersConfig);
export { component as UsersPageComponent, route as UsersRoute };
