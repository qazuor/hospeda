import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, CompoundLayout, EntityType } from '@/components/table/DataTable';
import { LifecycleStatusEnum } from '@repo/schemas';
import type { EventLocation } from '../schemas/event-locations.schemas';

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
                if (row.coordinates?.lat != null && row.coordinates?.long != null) {
                    return `${Number.parseFloat(row.coordinates.lat).toFixed(6)}, ${Number.parseFloat(row.coordinates.long).toFixed(6)}`;
                }
                return t('admin-common.entityPage.notAvailable');
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'lifecycleState',
            header: t('admin-entities.columns.status'),
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: LifecycleStatusEnum.ACTIVE,
                    label: t('admin-entities.states.lifecycle.active'),
                    color: BadgeColor.SUCCESS
                },
                {
                    value: LifecycleStatusEnum.DRAFT,
                    label: t('admin-entities.states.lifecycle.draft'),
                    color: BadgeColor.WARNING
                },
                {
                    value: LifecycleStatusEnum.ARCHIVED,
                    label: t('admin-entities.states.lifecycle.archived'),
                    color: BadgeColor.SECONDARY
                }
            ],
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
        }
    ] as const;
