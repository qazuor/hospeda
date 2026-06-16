import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { EditIcon } from '@repo/icons';
import { HostTradeCategoryEnum, PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { useDeleteHostTradeMutation } from '../hooks/useHostTradeQuery';
import type { HostTradeListItem } from '../schemas/host-trades.schemas';

/**
 * Localized labels for each HostTradeCategoryEnum value.
 * Keys mirror the enum values; translations live in admin-entities.
 */
const CATEGORY_LABELS: Record<HostTradeCategoryEnum, string> = {
    [HostTradeCategoryEnum.CERRAJERIA]: 'Cerrajería',
    [HostTradeCategoryEnum.PLOMERIA]: 'Plomería',
    [HostTradeCategoryEnum.ELECTRICIDAD]: 'Electricidad',
    [HostTradeCategoryEnum.GAS]: 'Gas',
    [HostTradeCategoryEnum.CLIMATIZACION]: 'Climatización',
    [HostTradeCategoryEnum.LIMPIEZA]: 'Limpieza',
    [HostTradeCategoryEnum.FLETES]: 'Fletes',
    [HostTradeCategoryEnum.VIDRIERIA]: 'Vidriería',
    [HostTradeCategoryEnum.CARPINTERIA]: 'Carpintería',
    [HostTradeCategoryEnum.PILETA_JARDIN]: 'Pileta / Jardín',
    [HostTradeCategoryEnum.PLAGAS]: 'Plagas',
    [HostTradeCategoryEnum.INTERNET]: 'Internet',
    [HostTradeCategoryEnum.ALBANILERIA]: 'Albañilería'
};

/**
 * Badge color mapping for host-trade categories.
 */
const CATEGORY_BADGE_OPTIONS = Object.values(HostTradeCategoryEnum).map((value) => ({
    value,
    label: CATEGORY_LABELS[value] ?? value,
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
        badgeOptions: CATEGORY_BADGE_OPTIONS
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
