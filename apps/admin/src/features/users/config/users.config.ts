import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { type User, UserListItemSchema } from '../schemas/users.schemas';
import { createUsersColumns } from './users.columns';

export const usersConfig: EntityConfig<User> = {
    name: 'users',
    displayName: 'User',
    pluralDisplayName: 'Users',
    entityType: EntityType.USER,

    // API
    apiEndpoint: '/api/v1/public/users',

    // Routes
    basePath: '/users',
    detailPath: '/users/[id]',

    // Schemas
    listItemSchema: UserListItemSchema,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        placeholder: 'Search users...',
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
        title: 'Users - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New User',
        createButtonPath: '/users/new'
    },

    // Columns
    createColumns: createUsersColumns
};

const { component, route } = createEntityListPage(usersConfig);
export { component as UsersPageComponent, route as UsersRoute };
