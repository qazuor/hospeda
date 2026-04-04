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
    createColumns: createUsersColumns
};

const { component, route } = createEntityListPage(usersConfig);
export { component as UsersPageComponent, route as UsersRoute };
