import { EditIcon } from '@repo/icons';
import { HostTradeCategoryEnum, PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { createElement, Fragment } from 'react';
import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { useDeleteHostTradeMutation } from '../hooks/useHostTradeQuery';
import type { HostTradeListItem } from '../schemas/host-trades.schemas';

/**
 * Badge options for the category column, labelled from the shared dictionary.
 *
 * The labels used to be a hardcoded `Record<HostTradeCategoryEnum, string>` of
 * Spanish names in this file, and by the time it was removed three of the
 * thirteen had already drifted from `host-trades.categories.*`: the admin read
 * "Pileta / Jardín", "Plagas" and "Internet" where the public directory read
 * "Pileta y Jardín", "Control de plagas" and "Internet / TV". Two copies of the
 * same words only ever diverge.
 *
 * `host-trades` is a SHARED namespace, so the admin reads the same entry the
 * directory renders — the category means the same thing on both screens, and
 * translating it twice is how they stop agreeing.
 *
 * @param t - Translation function from `useTranslations()`.
 * @returns One badge option per enum value, in enum order.
 */
const buildCategoryBadgeOptions = (t: ColumnTFunction) =>
    Object.values(HostTradeCategoryEnum).map((value) => ({
        value,
        label: t(`host-trades.categories.${value}`),
        color: BadgeColor.TEAL
    }));

/**
 * Builds the TanStack Table column definitions for the host-trades list page.
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Read-only array of column configurations
 */
export const createHostTradesColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<HostTradeListItem>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.HOST_TRADE,
            color: BadgeColor.INDIGO
        },
        linkHandler: (row) =>
            row.id
                ? {
                      to: '/platform/host-trades/$id',
                      params: { id: row.id }
                  }
                : undefined
    },
    {
        id: 'category',
        header: t('admin-entities.columns.category'),
        accessorKey: 'category',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: buildCategoryBadgeOptions(t)
    },
    {
        id: 'contact',
        header: t('admin-entities.columns.contact'),
        accessorKey: 'contact',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'is24h',
        header: t('admin-entities.columns.is24h'),
        accessorKey: 'is24h',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'isActive',
        header: t('admin-entities.columns.active'),
        accessorKey: 'isActive',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
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
            createElement(
                Fragment,
                null,
                createElement(
                    Link,
                    {
                        to: '/platform/host-trades/$id/edit' as never,
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
                    entityLabel: t('admin-entities.entities.hostTrade.singular'),
                    permission: PermissionEnum.HOST_TRADE_DELETE,
                    useDeleteMutation: useDeleteHostTradeMutation,
                    variant: 'icon',
                    entityGender: 'm'
                })
            )
    }
];
