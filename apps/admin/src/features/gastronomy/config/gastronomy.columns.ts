/**
 * @file gastronomy.columns.ts
 * Column factory for the gastronomy admin list page.
 *
 * Mirrors the host-trades columns pattern.  Each column receives a translation
 * function so headers are localised at render time.
 */

import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { EditIcon } from '@repo/icons';
import { GastronomyTypeEnum, PermissionEnum, PriceRangeEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { useDeleteGastronomyMutation } from '../hooks/useGastronomyQuery';
import type { GastronomyListItem } from './gastronomy.config';

// ---------------------------------------------------------------------------
// Badge label maps
// ---------------------------------------------------------------------------

/** Spanish labels for each GastronomyTypeEnum value. */
const TYPE_LABELS: Record<GastronomyTypeEnum, string> = {
    [GastronomyTypeEnum.RESTAURANT]: 'Restaurante',
    [GastronomyTypeEnum.BAR]: 'Bar',
    [GastronomyTypeEnum.CAFE]: 'Café',
    [GastronomyTypeEnum.PARRILLA]: 'Parrilla',
    [GastronomyTypeEnum.CERVECERIA]: 'Cervecería',
    [GastronomyTypeEnum.HELADERIA]: 'Heladería',
    [GastronomyTypeEnum.PANADERIA]: 'Panadería',
    [GastronomyTypeEnum.ROTISERIA]: 'Rotisería',
    [GastronomyTypeEnum.FOOD_TRUCK]: 'Food Truck'
};

/** Spanish labels for each PriceRangeEnum value. */
const PRICE_RANGE_LABELS: Record<PriceRangeEnum, string> = {
    [PriceRangeEnum.BUDGET]: 'Económico',
    [PriceRangeEnum.MID]: 'Intermedio',
    [PriceRangeEnum.HIGH]: 'Elevado',
    [PriceRangeEnum.PREMIUM]: 'Premium'
};

/** Badge colour mapping per gastronomy type. */
const TYPE_BADGE_OPTIONS = Object.values(GastronomyTypeEnum).map((value) => ({
    value,
    label: TYPE_LABELS[value] ?? value,
    color: BadgeColor.ORANGE
}));

/** Badge colour mapping per price-range tier. */
const PRICE_RANGE_BADGE_OPTIONS = Object.values(PriceRangeEnum).map((value) => ({
    value,
    label: PRICE_RANGE_LABELS[value] ?? value,
    color: BadgeColor.TEAL
}));

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

/**
 * Builds the TanStack Table column definitions for the gastronomy admin list page.
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Read-only array of column configurations
 */
export const createGastronomyColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<GastronomyListItem>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.GASTRONOMY,
            color: BadgeColor.ORANGE
        },
        linkHandler: (row) =>
            row.id
                ? {
                      to: '/gastronomies/$id',
                      params: { id: row.id }
                  }
                : undefined
    },
    {
        id: 'type',
        header: t('admin-entities.columns.type'),
        accessorKey: 'type',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: TYPE_BADGE_OPTIONS
    },
    {
        id: 'priceRange',
        header: t('admin-entities.gastronomy.columns.priceRange'),
        accessorKey: 'priceRange',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: PRICE_RANGE_BADGE_OPTIONS
    },
    {
        id: 'destination',
        header: t('admin-entities.columns.destination'),
        accessorKey: 'destinationId',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'owner',
        header: t('admin-entities.columns.owner'),
        accessorKey: 'ownerId',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'lifecycleStatus',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleStatus',
        enableSorting: true,
        columnType: ColumnType.STRING
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
                        to: '/gastronomies/$id/edit' as never,
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
                    entityLabel: t('admin-entities.entities.gastronomy.singular'),
                    permission: PermissionEnum.COMMERCE_DELETE,
                    useDeleteMutation: useDeleteGastronomyMutation,
                    variant: 'icon',
                    entityGender: 'f'
                })
            )
    }
];
