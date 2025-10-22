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
        id: 'category',
        header: 'Category',
        accessorKey: 'category',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'CULTURE', label: 'Culture', color: BadgeColor.YELLOW },
            { value: 'SPORTS', label: 'Sports', color: BadgeColor.ORANGE },
            { value: 'FESTIVAL', label: 'Festival', color: BadgeColor.PURPLE },
            { value: 'WORKSHOP', label: 'Workshop', color: BadgeColor.CYAN },
            { value: 'MUSIC', label: 'Music', color: BadgeColor.BLUE },
            { value: 'GASTRONOMY', label: 'Gastronomy', color: BadgeColor.PINK },
            { value: 'NATURE', label: 'Nature', color: BadgeColor.GREEN },
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
        accessorKey: 'date.start',
        enableSorting: true,
        columnType: ColumnType.DATE
    },
    {
        id: 'location',
        header: 'Location',
        accessorKey: 'locationName',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'ticketPrice',
        header: 'Price',
        accessorKey: 'pricing.price',
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
