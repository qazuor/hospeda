import { EditIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { type ComponentProps, createElement, Fragment } from 'react';
import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { resolveI18nText } from '@/utils/i18n-text';
import { useDeleteHostTradeMutation } from '../hooks/useHostTradeQuery';
import type { HostTradeListItem } from '../schemas/host-trades.schemas';

/**
 * Renders a provider's categories as one badge each (HOS-919 AC-4.4).
 *
 * Labels come from each category's own `nameI18n` (es, then en, then pt), the
 * same words the catalog screen and the public directory show. They are data,
 * not copy, so there is no translation key and no hardcoded label here.
 *
 * @param row - The provider list row, carrying `categories` refs.
 * @returns A wrapping group of badges, empty for a provider with none.
 */
const renderCategoryBadges = (row: HostTradeListItem) =>
    createElement(
        'div',
        { className: 'flex flex-wrap gap-1' },
        (row.categories ?? []).map((category) =>
            createElement(
                Badge,
                {
                    key: category.id,
                    variant: 'secondary',
                    'data-testid': 'provider-category-badge'
                } as ComponentProps<typeof Badge>,
                resolveI18nText(category.nameI18n) || category.slug
            )
        )
    );

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
        id: 'categories',
        header: t('admin-entities.columns.category'),
        accessorKey: 'categories',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: renderCategoryBadges
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
