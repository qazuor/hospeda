import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, CompoundLayout, EntityType } from '@/components/table/DataTable';
import { LifecycleStatusEnum } from '@repo/types';
import type { EventLocation } from '../schemas/event-locations.schemas';

/**
 * Creates column configuration for event locations list
 */
export const createEventLocationsColumns = (): readonly ColumnConfig<EventLocation>[] =>
    [
        {
            id: 'placeName',
            header: 'Place Name',
            accessorKey: 'placeName',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: { entityType: EntityType.EVENT_LOCATION },
            linkHandler: (row) => ({ to: `/event-locations/${row.id}` }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'address',
            header: 'Address',
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
            header: 'City',
            accessorKey: 'city',
            enableSorting: true,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'department',
            header: 'Department',
            accessorKey: 'department',
            enableSorting: true,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'country',
            header: 'Country',
            accessorKey: 'country',
            enableSorting: true,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'neighborhood',
            header: 'Neighborhood',
            accessorKey: 'neighborhood',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'coordinates',
            header: 'Coordinates',
            accessorKey: 'latitude',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => {
                if (row.latitude != null && row.longitude != null) {
                    return `${row.latitude.toFixed(6)}, ${row.longitude.toFixed(6)}`;
                }
                return 'Not available';
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'lifecycleState',
            header: 'Status',
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: LifecycleStatusEnum.ACTIVE, label: 'Active', color: BadgeColor.SUCCESS },
                {
                    value: LifecycleStatusEnum.DRAFT,
                    label: 'Draft',
                    color: BadgeColor.WARNING
                },
                {
                    value: LifecycleStatusEnum.ARCHIVED,
                    label: 'Archived',
                    color: BadgeColor.SECONDARY
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'createdAt',
            header: 'Created',
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        }
    ] as const;
