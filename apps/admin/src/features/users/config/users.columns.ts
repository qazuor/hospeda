import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { User } from '../schemas/users.schemas';

export const createUsersColumns = (): readonly ColumnConfig<User>[] => [
    {
        id: 'displayName',
        header: 'Display Name',
        accessorKey: 'displayName',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.USER,
            color: BadgeColor.PINK
        },
        linkHandler: (row) => ({
            to: '/users/$id',
            params: { id: row.id }
        })
    },
    {
        id: 'slug',
        header: 'Slug',
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'firstName',
        header: 'First Name',
        accessorKey: 'firstName',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'lastName',
        header: 'Last Name',
        accessorKey: 'lastName',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'role',
        header: 'Role',
        accessorKey: 'role',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'SUPER_ADMIN', label: 'Super Admin', color: BadgeColor.RED },
            { value: 'ADMIN', label: 'Admin', color: BadgeColor.ORANGE },
            { value: 'EDITOR', label: 'Editor', color: BadgeColor.BLUE },
            { value: 'HOST', label: 'Host', color: BadgeColor.PURPLE },
            { value: 'USER', label: 'User', color: BadgeColor.GREEN },
            { value: 'GUEST', label: 'Guest', color: BadgeColor.GRAY }
        ]
    },
    {
        id: 'authProvider',
        header: 'Auth Provider',
        accessorKey: 'authProvider',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'LOCAL', label: 'Local', color: BadgeColor.BLUE },
            { value: 'GOOGLE', label: 'Google', color: BadgeColor.RED },
            { value: 'FACEBOOK', label: 'Facebook', color: BadgeColor.INDIGO },
            { value: 'GITHUB', label: 'GitHub', color: BadgeColor.GRAY }
        ]
    },
    {
        id: 'email',
        header: 'Email',
        accessorKey: 'contactInfo.email',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'location',
        header: 'Location',
        accessorKey: 'location.city',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'accommodationCount',
        header: 'Accommodations',
        accessorKey: 'accommodationCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'eventsCount',
        header: 'Events',
        accessorKey: 'eventsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'postsCount',
        header: 'Posts',
        accessorKey: 'postsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'visibility',
        header: 'Visibility',
        accessorKey: 'visibility',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'PUBLIC', label: 'Public', color: BadgeColor.PURPLE },
            { value: 'PRIVATE', label: 'Private', color: BadgeColor.CYAN },
            { value: 'RESTRICTED', label: 'Restricted', color: BadgeColor.PINK }
        ]
    },
    {
        id: 'lifecycleState',
        header: 'Status',
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'DRAFT', label: 'Draft', color: BadgeColor.GRAY },
            { value: 'ACTIVE', label: 'Active', color: BadgeColor.GREEN },
            { value: 'ARCHIVED', label: 'Archived', color: BadgeColor.ORANGE }
        ]
    },
    {
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
