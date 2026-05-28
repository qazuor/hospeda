import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { InlineFeaturedCell } from '@/components/entity-list/InlineFeaturedCell';
import {
    type InlineStateOption,
    InlineStateSelectCell
} from '@/components/entity-list/InlineStateSelectCell';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { EditIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { useDeleteAmenityMutation, useUpdateAmenityMutation } from '../hooks/useAmenityQuery';
import type { Amenity } from '../schemas/amenities.schemas';

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

export const createAmenitiesColumns = (t: ColumnTFunction): readonly ColumnConfig<Amenity>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.AMENITY,
            color: BadgeColor.CYAN
        },
        linkHandler: (row) => ({ to: `/content/accommodation-amenities/${row.id}` })
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
        badgeOptions: [
            {
                value: 'BASIC',
                label: t('admin-entities.types.amenity.basic'),
                color: BadgeColor.GRAY
            },
            {
                value: 'COMFORT',
                label: t('admin-entities.types.amenity.comfort'),
                color: BadgeColor.BLUE
            },
            {
                value: 'LUXURY',
                label: t('admin-entities.types.amenity.luxury'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'TECHNOLOGY',
                label: t('admin-entities.types.amenity.technology'),
                color: BadgeColor.CYAN
            },
            {
                value: 'RECREATION',
                label: t('admin-entities.types.amenity.recreation'),
                color: BadgeColor.GREEN
            },
            {
                value: 'BUSINESS',
                label: t('admin-entities.types.amenity.business'),
                color: BadgeColor.ORANGE
            }
        ]
    },
    {
        id: 'description',
        header: t('admin-entities.columns.description'),
        accessorKey: 'description',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'icon',
        header: t('admin-entities.columns.icon'),
        accessorKey: 'icon',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'isBuiltin',
        header: t('admin-entities.columns.builtIn'),
        accessorKey: 'isBuiltin',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineFeaturedCell<Partial<Amenity>>, {
                entityId: row.id,
                entityName: row.name,
                entityLabelKey: 'admin-entities.entities.amenity.singular',
                checked: row.isFeatured ?? false,
                permission: PermissionEnum.AMENITY_FEATURED_TOGGLE,
                useUpdateMutation: useUpdateAmenityMutation
            })
    },
    {
        id: 'displayWeight',
        header: t('admin-entities.columns.weight'),
        accessorKey: 'displayWeight',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'accommodationCount',
        header: t('admin-entities.columns.accommodationsCount'),
        accessorKey: 'accommodationCount',
        enableSorting: false,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'lifecycleState',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell<Partial<Amenity>>, {
                entityId: row.id,
                entityName: row.name,
                entityLabelKey: 'admin-entities.entities.amenity.singular',
                field: 'lifecycleState',
                currentValue: row.lifecycleState,
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: LIFECYCLE_OPTIONS(t),
                permission: PermissionEnum.AMENITY_LIFECYCLE_CHANGE,
                useUpdateMutation: useUpdateAmenityMutation,
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
        // SPEC-117 D-CONTENT.1 — Row actions: Edit + Delete with confirmation.
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
                        to: '/content/accommodation-amenities/$id/edit' as never,
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
                    entityLabel: t('admin-entities.entities.amenity.singular'),
                    permission: PermissionEnum.AMENITY_DELETE,
                    useDeleteMutation: useDeleteAmenityMutation,
                    variant: 'icon',
                    entityGender: 'f'
                })
            )
    }
];
