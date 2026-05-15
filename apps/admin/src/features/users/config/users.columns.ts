import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, CompoundLayout, EntityType } from '@/components/table/DataTable';
import { createElement } from 'react';
import { ImpersonateButton } from '../components/ImpersonateButton';
import type { User } from '../schemas/users.schemas';

export const createUsersColumns = (t: ColumnTFunction): readonly ColumnConfig<User>[] => [
    {
        id: 'displayName',
        header: t('admin-entities.columns.displayName'),
        accessorKey: 'displayName',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.USER,
            color: BadgeColor.PINK
        },
        linkHandler: (row) => ({
            to: '/access/users/$id',
            params: { id: row.id }
        })
    },
    {
        id: 'fullName',
        header: t('admin-entities.columns.fullName'),
        accessorKey: 'firstName',
        enableSorting: false,
        columnType: ColumnType.COMPOUND,
        compoundOptions: {
            columns: [
                { id: 'firstName', accessorKey: 'firstName', columnType: ColumnType.STRING },
                { id: 'lastName', accessorKey: 'lastName', columnType: ColumnType.STRING }
            ],
            layout: CompoundLayout.HORIZONTAL,
            separator: ' '
        }
    },
    {
        id: 'slug',
        header: t('admin-entities.columns.slug'),
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'role',
        header: t('admin-entities.columns.role'),
        accessorKey: 'role',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'SUPER_ADMIN',
                label: t('admin-entities.types.userRole.superAdmin'),
                color: BadgeColor.RED
            },
            {
                value: 'ADMIN',
                label: t('admin-entities.types.userRole.admin'),
                color: BadgeColor.ORANGE
            },
            {
                value: 'EDITOR',
                label: t('admin-entities.types.userRole.editor'),
                color: BadgeColor.BLUE
            },
            {
                value: 'HOST',
                label: t('admin-entities.types.userRole.host'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'USER',
                label: t('admin-entities.types.userRole.user'),
                color: BadgeColor.GREEN
            },
            {
                value: 'GUEST',
                label: t('admin-entities.types.userRole.guest'),
                color: BadgeColor.GRAY
            },
            {
                value: 'SYSTEM',
                label: t('admin-entities.types.userRole.system'),
                color: BadgeColor.SLATE
            }
        ]
    },
    {
        id: 'authProvider',
        header: t('admin-entities.columns.authProvider'),
        accessorKey: 'authProvider',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'LOCAL',
                label: t('admin-entities.types.authProvider.local'),
                color: BadgeColor.BLUE
            },
            {
                value: 'GOOGLE',
                label: t('admin-entities.types.authProvider.google'),
                color: BadgeColor.RED
            },
            {
                value: 'FACEBOOK',
                label: t('admin-entities.types.authProvider.facebook'),
                color: BadgeColor.INDIGO
            },
            {
                value: 'GITHUB',
                label: t('admin-entities.types.authProvider.github'),
                color: BadgeColor.GRAY
            },
            {
                value: 'BETTER_AUTH',
                label: t('admin-entities.types.authProvider.betterAuth'),
                color: BadgeColor.SLATE
            }
        ]
    },
    {
        id: 'email',
        header: t('admin-entities.columns.email'),
        accessorKey: 'email',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'location',
        header: t('admin-entities.columns.location'),
        accessorKey: 'locationCity',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'accommodationCount',
        header: t('admin-entities.columns.accommodationsCount'),
        accessorKey: 'accommodationsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'eventsCount',
        header: t('admin-entities.columns.eventsCount'),
        accessorKey: 'eventsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'postsCount',
        header: t('admin-entities.columns.postsCount'),
        accessorKey: 'postsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'visibility',
        header: t('admin-entities.columns.visibility'),
        accessorKey: 'visibility',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'PUBLIC',
                label: t('admin-entities.states.visibility.public'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'PRIVATE',
                label: t('admin-entities.states.visibility.private'),
                color: BadgeColor.CYAN
            },
            {
                value: 'RESTRICTED',
                label: t('admin-entities.states.visibility.restricted'),
                color: BadgeColor.PINK
            }
        ]
    },
    {
        id: 'lifecycleState',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'DRAFT',
                label: t('admin-entities.states.lifecycle.draft'),
                color: BadgeColor.GRAY
            },
            {
                value: 'ACTIVE',
                label: t('admin-entities.states.lifecycle.active'),
                color: BadgeColor.GREEN
            },
            {
                value: 'ARCHIVED',
                label: t('admin-entities.states.lifecycle.archived'),
                color: BadgeColor.ORANGE
            }
        ]
    },
    {
        id: 'createdAt',
        header: t('admin-entities.columns.createdAt'),
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    },
    {
        id: 'actions',
        header: t('admin-entities.columns.actions'),
        accessorKey: 'id',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(ImpersonateButton, { userId: row.id, variant: 'icon' })
    }
];
