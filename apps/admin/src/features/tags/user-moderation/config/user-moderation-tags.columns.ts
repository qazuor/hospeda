import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { UserTagWithOwner } from '@/hooks/use-user-tag-moderation';
import { useDeleteAnyUserTag } from '@/hooks/use-user-tag-moderation';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import { createElement } from 'react';

/**
 * Badge options for user-moderation tag lifecycle state column.
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
 * Owner cell component for user-moderation tags.
 *
 * Renders a compact multi-line cell: display name (bold), role (muted), email (muted).
 * Per D-012, there is NO edit action — only delete is permitted from the admin.
 */
function OwnerCell({ row }: { readonly row: UserTagWithOwner }) {
    return createElement(
        'div',
        { className: 'flex flex-col gap-0.5' },
        createElement(
            'span',
            { className: 'font-medium' },
            row.ownerDisplayName ?? row.ownerId ?? '—'
        ),
        row.ownerRole
            ? createElement('span', { className: 'text-muted-foreground text-xs' }, row.ownerRole)
            : null,
        row.ownerEmail
            ? createElement('span', { className: 'text-muted-foreground text-xs' }, row.ownerEmail)
            : null
    );
}

/**
 * Creates column configuration for the user-moderation tags list.
 *
 * Columns: owner (compound display), name (NO edit link per D-012), color,
 * lifecycle state, usage count, actions (DELETE only per D-012).
 *
 * Per D-012: TAG_USER_UPDATE_ANY is intentionally excluded — there is no
 * edit/rename action for USER tags from admin. Only delete is provided.
 *
 * @see D-012 (TAG_USER_UPDATE_ANY exclusion)
 * @see AC-008-01, AC-008-02
 *
 * @param t - Translation function from useTranslations()
 * @returns Readonly column config array for createEntityListPage
 */
export const createUserModerationTagsColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<UserTagWithOwner>[] =>
    [
        {
            id: 'owner',
            header: t('admin-entities.columns.owner'),
            accessorKey: 'ownerDisplayName',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => createElement(OwnerCell, { row }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'name',
            header: t('admin-entities.columns.name'),
            accessorKey: 'name',
            enableSorting: true,
            // STRING (not ENTITY/LINK) — no edit action per D-012
            columnType: ColumnType.STRING,
            entityOptions: { entityType: EntityType.TAG },
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
            id: 'usageCount',
            header: 'Usos',
            accessorKey: 'usageCount',
            enableSorting: false,
            columnType: ColumnType.NUMBER,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        },
        {
            id: 'actions',
            header: t('admin-entities.columns.actions'),
            accessorKey: 'id',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            // Per D-012: DELETE only — no edit action
            widgetRenderer: (row) =>
                createElement(DeleteRowButton, {
                    entityId: row.id,
                    entityName: row.name,
                    entityLabel: t('admin-entities.entities.tag.singular'),
                    permission: PermissionEnum.TAG_USER_DELETE_ANY,
                    useDeleteMutation: useDeleteAnyUserTag,
                    variant: 'icon',
                    entityGender: 'f'
                })
        }
    ] as const;
