import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import {
    type InlineStateOption,
    InlineStateSelectCell
} from '@/components/entity-list/InlineStateSelectCell';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, CompoundLayout, EntityType } from '@/components/table/DataTable';
import { EditIcon } from '@repo/icons';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import {
    useDeleteEventLocationMutation,
    useUpdateEventLocationMutation
} from '../hooks/useEventLocationQuery';
import type { EventLocation } from '../schemas/event-locations.schemas';

const LIFECYCLE_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
    {
        value: LifecycleStatusEnum.DRAFT,
        label: t('admin-entities.states.lifecycle.draft'),
        color: BadgeColor.GRAY
    },
    {
        value: LifecycleStatusEnum.ACTIVE,
        label: t('admin-entities.states.lifecycle.active'),
        color: BadgeColor.GREEN
    },
    {
        value: LifecycleStatusEnum.ARCHIVED,
        label: t('admin-entities.states.lifecycle.archived'),
        color: BadgeColor.ORANGE
    }
];

/**
 * Creates column configuration for event locations list
 */
export const createEventLocationsColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<EventLocation>[] =>
    [
        {
            id: 'placeName',
            header: t('admin-entities.columns.placeName'),
            accessorKey: 'placeName',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: { entityType: EntityType.EVENT_LOCATION },
            linkHandler: (row) => ({ to: `/events/locations/${row.id}` }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'address',
            header: t('admin-entities.columns.address'),
            accessorKey: 'street',
            enableSorting: false,
            columnType: ColumnType.COMPOUND,
            compoundOptions: {
                columns: [
                    { id: 'street', accessorKey: 'street' },
                    { id: 'number', accessorKey: 'number' },
                    { id: 'floor', accessorKey: 'floor' },
                    { id: 'apartment', accessorKey: 'apartment' }
                ],
                layout: CompoundLayout.HORIZONTAL,
                separator: ' '
            },
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'city',
            header: t('admin-entities.columns.city'),
            accessorKey: 'city',
            enableSorting: true,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'department',
            header: t('admin-entities.columns.department'),
            accessorKey: 'department',
            enableSorting: true,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'country',
            header: t('admin-entities.columns.country'),
            accessorKey: 'country',
            enableSorting: true,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'neighborhood',
            header: t('admin-entities.columns.neighborhood'),
            accessorKey: 'neighborhood',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'coordinates',
            header: t('admin-entities.columns.coordinates'),
            accessorKey: 'coordinates',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => {
                const lat = row.coordinates?.lat;
                const long = row.coordinates?.long;
                if (lat == null || long == null) {
                    return createElement('span', { className: 'text-muted-foreground' }, '—');
                }
                const latNum = Number.parseFloat(lat);
                const longNum = Number.parseFloat(long);
                return createElement(
                    'a',
                    {
                        href: `https://www.google.com/maps?q=${latNum},${longNum}`,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className:
                            'inline-flex items-center gap-1 text-primary text-xs tabular-nums hover:underline',
                        onClick: (e: MouseEvent) => e.stopPropagation()
                    },
                    `${latNum.toFixed(4)}, ${longNum.toFixed(4)}`
                );
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'lifecycleState',
            header: t('admin-entities.columns.status'),
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) =>
                createElement(InlineStateSelectCell<Partial<EventLocation>>, {
                    entityId: row.id,
                    entityName: row.placeName ?? '',
                    entityLabelKey: 'admin-entities.entities.eventLocation.singular',
                    field: 'lifecycleState',
                    currentValue: row.lifecycleState,
                    successMessageKey: 'admin-entities.messages.stateChanged',
                    options: LIFECYCLE_OPTIONS(t),
                    permission: PermissionEnum.EVENT_LOCATION_LIFECYCLE_CHANGE,
                    useUpdateMutation: useUpdateEventLocationMutation,
                    confirmValues: ['ARCHIVED'],
                    confirmCopyKey: 'archive'
                }),
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
                            to: '/events/locations/$id/edit' as never,
                            params: { id: row.id } as never,
                            className:
                                'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                            'aria-label': t('admin-entities.actions.edit')
                        } as never,
                        createElement(EditIcon, { size: 16 })
                    ),
                    createElement(DeleteRowButton, {
                        entityId: row.id,
                        entityName: row.placeName ?? '',
                        entityLabel: t('admin-entities.entities.eventLocation.singular'),
                        permission: PermissionEnum.EVENT_LOCATION_DELETE,
                        useDeleteMutation: useDeleteEventLocationMutation,
                        variant: 'icon',
                        entityGender: 'f'
                    })
                )
        }
    ] as const;
