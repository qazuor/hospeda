import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import {
    type InlineStateOption,
    InlineStateSelectCell
} from '@/components/entity-list/InlineStateSelectCell';
import { MailLinkCell } from '@/components/entity-list/MailLinkCell';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, CompoundLayout, EntityType } from '@/components/table/DataTable';
import { EditIcon, getUserRoleIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { AuthProviderBadge } from '../components/AuthProviderBadge';
import { ImpersonateButton } from '../components/ImpersonateButton';
import { useDeleteUserMutation, useUpdateUserMutation } from '../hooks/useUserQuery';
import type { User } from '../schemas/users.schemas';

/**
 * Role options for inline edit (7 total). SYSTEM and GUEST are kept in the
 * dropdown so users with those roles still render a labeled, colored badge,
 * but in normal operation admins won't pick them. The backend remains the
 * authoritative validation.
 */
const ROLE_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
    {
        value: 'SUPER_ADMIN',
        label: t('admin-entities.types.userRole.superAdmin'),
        color: BadgeColor.RED,
        icon: getUserRoleIcon({ role: 'super_admin' })
    },
    {
        value: 'ADMIN',
        label: t('admin-entities.types.userRole.admin'),
        color: BadgeColor.ORANGE,
        icon: getUserRoleIcon({ role: 'admin' })
    },
    {
        value: 'EDITOR',
        label: t('admin-entities.types.userRole.editor'),
        color: BadgeColor.BLUE,
        icon: getUserRoleIcon({ role: 'editor' })
    },
    {
        value: 'HOST',
        label: t('admin-entities.types.userRole.host'),
        color: BadgeColor.PURPLE,
        icon: getUserRoleIcon({ role: 'host' })
    },
    {
        value: 'USER',
        label: t('admin-entities.types.userRole.user'),
        color: BadgeColor.GREEN,
        icon: getUserRoleIcon({ role: 'user' })
    },
    {
        value: 'GUEST',
        label: t('admin-entities.types.userRole.guest'),
        color: BadgeColor.GRAY,
        icon: getUserRoleIcon({ role: 'guest' })
    },
    {
        value: 'SYSTEM',
        label: t('admin-entities.types.userRole.system'),
        color: BadgeColor.SLATE,
        icon: getUserRoleIcon({ role: 'system' })
    }
];

/**
 * Visibility options. Single source for both read-only badge and dropdown.
 */
const VISIBILITY_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
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
];

/** Lifecycle options. ARCHIVED is the destructive transition. */
const LIFECYCLE_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
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
];

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
        // SPEC-135 F-030: fullName duplicates the displayName entity column on
        // mobile (same first+last name text rendered twice). Keep it available
        // via the column toggle but hide by default so mobile shows email/role
        // among the first surviving columns instead of two redundant names.
        id: 'fullName',
        header: t('admin-entities.columns.fullName'),
        accessorKey: 'firstName',
        enableSorting: false,
        columnType: ColumnType.COMPOUND,
        startVisibleOnTable: false,
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
        // SPEC-135 F-030: slug is low signal next to email/role on mobile.
        // Hide by default; users can re-enable from the column toggle.
        id: 'slug',
        header: t('admin-entities.columns.slug'),
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING,
        startVisibleOnTable: false
    },
    {
        id: 'role',
        header: t('admin-entities.columns.role'),
        accessorKey: 'role',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell, {
                entityId: row.id,
                entityName:
                    row.displayName ||
                    `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() ||
                    row.slug ||
                    row.email ||
                    '',
                entityLabelKey: 'admin-entities.entities.user.singular',
                field: 'role',
                currentValue: row.role,
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: ROLE_OPTIONS(t),
                permission: PermissionEnum.USER_UPDATE_ROLES,
                useUpdateMutation: useUpdateUserMutation,
                confirmValues: ['SUPER_ADMIN', 'ADMIN'],
                confirmCopyKey: 'roleChange'
            })
    },
    {
        id: 'authProvider',
        header: t('admin-entities.columns.authProvider'),
        accessorKey: 'authProvider',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(AuthProviderBadge, { row })
    },
    {
        id: 'email',
        header: t('admin-entities.columns.email'),
        accessorKey: 'email',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(MailLinkCell, { email: row.email })
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
        enableSorting: false,
        columnType: ColumnType.NUMBER,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'eventsCount',
        header: t('admin-entities.columns.eventsCount'),
        accessorKey: 'eventsCount',
        enableSorting: false,
        columnType: ColumnType.NUMBER,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'postsCount',
        header: t('admin-entities.columns.postsCount'),
        accessorKey: 'postsCount',
        enableSorting: false,
        columnType: ColumnType.NUMBER,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'visibility',
        header: t('admin-entities.columns.visibility'),
        accessorKey: 'visibility',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell, {
                entityId: row.id,
                entityName:
                    row.displayName ||
                    `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() ||
                    row.slug ||
                    row.email ||
                    '',
                entityLabelKey: 'admin-entities.entities.user.singular',
                field: 'visibility',
                currentValue: row.visibility,
                successMessageKey: 'admin-entities.messages.visibilityChanged',
                options: VISIBILITY_OPTIONS(t),
                permission: PermissionEnum.USER_VISIBILITY_CHANGE,
                useUpdateMutation: useUpdateUserMutation
            })
    },
    {
        id: 'lifecycleState',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell, {
                entityId: row.id,
                entityName:
                    row.displayName ||
                    `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() ||
                    row.slug ||
                    row.email ||
                    '',
                entityLabelKey: 'admin-entities.entities.user.singular',
                field: 'lifecycleState',
                currentValue: row.lifecycleState,
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: LIFECYCLE_OPTIONS(t),
                permission: PermissionEnum.USER_LIFECYCLE_CHANGE,
                useUpdateMutation: useUpdateUserMutation,
                confirmValues: ['ARCHIVED'],
                confirmCopyKey: 'archive'
            })
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
            // SPEC-117 D-USERS.2 — Edit row action alongside Impersonate.
            // SPEC-117 D-USERS.5 — Delete row action with confirmation dialog.
            // Cast bypasses TanStack Router's strict path-param overload typing;
            // route is known to exist (apps/admin/src/routes/_authed/access/users/$id_.edit.tsx).
            createElement(
                Fragment,
                null,
                createElement(
                    Link,
                    {
                        to: '/access/users/$id/edit' as never,
                        params: { id: row.id } as never,
                        className:
                            'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                        'aria-label': t('admin-entities.actions.edit')
                    } as never,
                    createElement(EditIcon, { size: 16 })
                ),
                createElement(ImpersonateButton, { userId: row.id, variant: 'icon' }),
                createElement(DeleteRowButton, {
                    entityId: row.id,
                    entityName:
                        row.displayName ||
                        `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() ||
                        row.slug,
                    entityLabel: t('admin-entities.entities.user.singular'),
                    permission: PermissionEnum.USER_DELETE,
                    useDeleteMutation: useDeleteUserMutation,
                    variant: 'icon'
                })
            )
    }
];
