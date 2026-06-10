import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { useDeleteInternalTag } from '@/hooks/use-internal-tags';
import { EditIcon } from '@repo/icons';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import type { Tag } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';

/**
 * Badge options for internal-tag lifecycle state column.
 * Maps enum values to human-readable labels and badge colors.
 */
const LIFECYCLE_BADGE_OPTIONS = [
    {
        value: LifecycleStatusEnum.ACTIVE,
        label: 'Activo',
        color: BadgeColor.GREEN
    },
    {
        value: LifecycleStatusEnum.INACTIVE,
        label: 'Inactivo',
        color: BadgeColor.GRAY
    },
    {
        value: LifecycleStatusEnum.ARCHIVED,
        label: 'Archivado',
        color: BadgeColor.ORANGE
    },
    {
        value: LifecycleStatusEnum.DRAFT,
        label: 'Borrador',
        color: BadgeColor.YELLOW
    }
] as const;

/**
 * Creates column configuration for the internal-tags list.
 *
 * Columns: name (with edit link), color, lifecycle state, createdAt, actions.
 * Actions: Edit button link + Delete (gated by TAG_INTERNAL_DELETE permission).
 *
 * Note: The original list used `AdminTagDeleteDialog` with an impact count.
 * The framework's `DeleteRowButton` provides a simpler confirmation dialog.
 * The impact count (informational) is intentionally omitted for migration
 * simplicity — the delete action itself is fully preserved.
 *
 * @param t - Translation function from useTranslations()
 * @returns Readonly column config array for createEntityListPage
 */
export const createInternalTagsColumns = (t: ColumnTFunction): readonly ColumnConfig<Tag>[] =>
    [
        {
            id: 'name',
            header: t('admin-entities.columns.name'),
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: { entityType: EntityType.TAG },
            linkHandler: (row) => ({
                to: '/platform/tags/internal/$id/edit',
                params: { id: row.id }
            }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'color',
            header: 'Color',
            accessorKey: 'color',
            enableSorting: false,
            columnType: ColumnType.BADGE,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'lifecycleState',
            header: t('admin-entities.columns.status'),
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: LIFECYCLE_BADGE_OPTIONS,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'createdAt',
            header: t('admin-entities.columns.createdAt'),
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        },
        {
            id: 'actions',
            header: t('admin-entities.columns.actions'),
            accessorKey: 'id',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) =>
                createElement(
                    Fragment,
                    null,
                    createElement(
                        Link,
                        {
                            to: '/platform/tags/internal/$id/edit' as never,
                            params: { id: row.id } as never,
                            className:
                                'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                            'aria-label': t('admin-entities.actions.edit')
                        } as never,
                        createElement(EditIcon, { size: 16 })
                    ),
                    createElement(DeleteRowButton, {
                        entityId: row.id,
                        entityName: row.name,
                        entityLabel: t('admin-entities.entities.tag.singular'),
                        permission: PermissionEnum.TAG_INTERNAL_DELETE,
                        useDeleteMutation: useDeleteInternalTag,
                        variant: 'icon',
                        entityGender: 'f'
                    })
                )
        }
    ] as const;
