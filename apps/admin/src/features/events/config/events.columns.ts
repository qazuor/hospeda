import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType, ListOrientation } from '@/components/table/DataTable';
import type { Event } from '../schemas/events.schemas';

export const createEventsColumns = (): readonly ColumnConfig<Event>[] => [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.EVENT,
            color: BadgeColor.ORANGE
        },
        linkHandler: (row) => ({
            to: '/events/$slug',
            params: { slug: row.slug }
        })
    },
    {
        id: 'eventType',
        header: 'Type',
        accessorKey: 'eventType',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'CONFERENCE', label: 'Conference', color: BadgeColor.BLUE },
            { value: 'WORKSHOP', label: 'Workshop', color: BadgeColor.CYAN },
            { value: 'FESTIVAL', label: 'Festival', color: BadgeColor.PURPLE },
            { value: 'CONCERT', label: 'Concert', color: BadgeColor.PINK },
            { value: 'EXHIBITION', label: 'Exhibition', color: BadgeColor.GREEN },
            { value: 'SPORTS', label: 'Sports', color: BadgeColor.ORANGE },
            { value: 'OTHER', label: 'Other', color: BadgeColor.GRAY }
        ]
    },
    {
        id: 'organizer',
        header: 'Organizer',
        accessorKey: 'organizerName',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'startDate',
        header: 'Start Date',
        accessorKey: 'startDate',
        enableSorting: true,
        columnType: ColumnType.DATE
    },
    {
        id: 'capacity',
        header: 'Capacity',
        accessorKey: 'capacity',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'attendeesCount',
        header: 'Attendees',
        accessorKey: 'attendeesCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'ticketPrice',
        header: 'Price',
        accessorKey: 'ticketPrice',
        enableSorting: true,
        columnType: ColumnType.PRICE
    },
    {
        id: 'featuredImage',
        header: 'Featured Image',
        accessorKey: 'media.featuredImage',
        enableSorting: false,
        columnType: ColumnType.IMAGE,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'tags',
        header: 'Tags',
        accessorKey: 'tags',
        enableSorting: false,
        columnType: ColumnType.LIST,
        listSeparator: ' • ',
        listOrientation: ListOrientation.ROW,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'isFeatured',
        header: 'Featured',
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'visibility',
        header: 'Visibility',
        accessorKey: 'visibility',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'PUBLIC', label: 'Public', color: BadgeColor.PURPLE },
            { value: 'PRIVATE', label: 'Private', color: BadgeColor.CYAN },
            { value: 'HIDDEN', label: 'Hidden', color: BadgeColor.PINK }
        ]
    },
    {
        id: 'lifecycleState',
        header: 'Status',
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        startVisibleOnTable: false,
        startVisibleOnGrid: true,
        badgeOptions: [
            { value: 'ACTIVE', label: 'Active', color: BadgeColor.CYAN },
            { value: 'INACTIVE', label: 'Inactive', color: BadgeColor.PURPLE },
            { value: 'ARCHIVED', label: 'Archived', color: BadgeColor.PINK },
            { value: 'DELETED', label: 'Deleted', color: BadgeColor.GREEN }
        ]
    },
    {
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
