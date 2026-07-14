import { EditIcon } from '@repo/icons';
import { PermissionEnum, PointOfInterestTypeEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { createElement, Fragment } from 'react';
import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import {
    type InlineStateOption,
    InlineStateSelectCell
} from '@/components/entity-list/InlineStateSelectCell';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { WeightBarCell } from '@/components/entity-list/WeightBarCell';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { resolveI18nText } from '@/utils/i18n-text';
import {
    useDeletePointOfInterestMutation,
    useUpdatePointOfInterestMutation
} from '../hooks/usePointOfInterestQuery';
import type { PointOfInterest } from '../schemas/points-of-interest.schemas';

/** Spanish labels for each PointOfInterestTypeEnum value. */
const TYPE_LABELS: Record<PointOfInterestTypeEnum, string> = {
    [PointOfInterestTypeEnum.BEACH]: 'Playa',
    [PointOfInterestTypeEnum.STADIUM]: 'Estadio',
    [PointOfInterestTypeEnum.PARK]: 'Parque',
    [PointOfInterestTypeEnum.MUSEUM]: 'Museo',
    [PointOfInterestTypeEnum.PLAZA]: 'Plaza',
    [PointOfInterestTypeEnum.MONUMENT]: 'Monumento',
    [PointOfInterestTypeEnum.VIEWPOINT]: 'Mirador',
    [PointOfInterestTypeEnum.NATURAL]: 'Natural',
    [PointOfInterestTypeEnum.OTHER]: 'Otro'
};

/** Badge colour options for the `type` column (single flat colour — closed 9-value enum). */
const TYPE_BADGE_OPTIONS = Object.values(PointOfInterestTypeEnum).map((value) => ({
    value,
    label: TYPE_LABELS[value] ?? value,
    color: BadgeColor.INDIGO
}));

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

/**
 * Creates the DataTable column definitions for the points-of-interest list.
 *
 * HOS-144 §6.7: mirrors `attractions.columns.ts` structurally, with deltas
 * required by the v2 model — POI has no plain `name` column (resolved via
 * `resolveI18nText(row.nameI18n)`), gains `hasOwnPage`, and has NO
 * `destinationCount` column (the admin `list`/`getById` routes call the base
 * `service.adminList()`, not the POI service's relation-count-computing
 * `searchForList()` — HOS-143 follow-up OQ-3, not worked around here).
 */
export const createPointOfInterestColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<PointOfInterest>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'nameI18n',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        entityOptions: {
            entityType: EntityType.POINT_OF_INTEREST,
            color: BadgeColor.TEAL
        },
        linkHandler: (row) =>
            row.id
                ? {
                      to: '/content/points-of-interest/$id',
                      params: { id: row.id }
                  }
                : undefined,
        widgetRenderer: (row) => {
            const displayName = resolveI18nText(row.nameI18n) || row.slug;
            return createElement(
                Link,
                {
                    to: '/content/points-of-interest/$id' as never,
                    params: { id: row.id } as never,
                    className:
                        'inline-flex max-w-xs items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-sm ring-1 ring-inset bg-teal-50 text-teal-700 ring-teal-700/20 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-400 dark:ring-teal-400/30 dark:hover:bg-teal-900/30 truncate'
                } as never,
                displayName
            );
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
        id: 'type',
        header: t('admin-entities.columns.type'),
        accessorKey: 'type',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: TYPE_BADGE_OPTIONS
    },
    {
        id: 'hasOwnPage',
        header: t('admin-entities.columns.hasOwnPage'),
        accessorKey: 'hasOwnPage',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'displayWeight',
        header: t('admin-entities.columns.weight'),
        accessorKey: 'displayWeight',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(WeightBarCell, { value: row.displayWeight })
    },
    {
        id: 'lifecycleState',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell<Partial<PointOfInterest>>, {
                entityId: row.id,
                entityName: resolveI18nText(row.nameI18n) || row.slug,
                entityLabelKey: 'admin-entities.entities.pointOfInterest.singular',
                field: 'lifecycleState',
                currentValue: row.lifecycleState,
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: LIFECYCLE_OPTIONS(t),
                permission: PermissionEnum.POINT_OF_INTEREST_LIFECYCLE_CHANGE,
                useUpdateMutation: useUpdatePointOfInterestMutation,
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
        // Row actions: Edit + Delete with confirmation.
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
                        to: '/content/points-of-interest/$id/edit' as never,
                        params: { id: row.id } as never,
                        className:
                            'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                        'aria-label': t('admin-entities.actions.edit')
                    } as never,
                    createElement(EditIcon, { size: 16 })
                ),
                createElement(DeleteRowButton, {
                    entityId: row.id,
                    entityName: resolveI18nText(row.nameI18n) || row.slug,
                    entityLabel: t('admin-entities.entities.pointOfInterest.singular'),
                    permission: PermissionEnum.POINT_OF_INTEREST_DELETE,
                    useDeleteMutation: useDeletePointOfInterestMutation,
                    variant: 'icon',
                    entityGender: 'm'
                })
            )
    }
];
