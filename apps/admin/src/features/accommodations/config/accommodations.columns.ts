import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Accommodation } from '../schemas/accommodations.schemas';

/**
 * Column configuration for accommodations list
 */
export const createAccommodationsColumns = (): readonly ColumnConfig<Accommodation>[] => [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.ACCOMMODATION,
            color: BadgeColor.BLUE
        },
        linkHandler: (row) => ({
            to: '/accommodations/$id',
            params: { id: row.id }
        })
    },
    {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'HOTEL', label: 'Hotel', color: BadgeColor.BLUE },
            { value: 'HOSTEL', label: 'Hostel', color: BadgeColor.CYAN },
            { value: 'APARTMENT', label: 'Apartment', color: BadgeColor.PURPLE },
            { value: 'HOUSE', label: 'House', color: BadgeColor.GREEN },
            { value: 'COUNTRY_HOUSE', label: 'Country House', color: BadgeColor.TEAL },
            { value: 'CABIN', label: 'Cabin', color: BadgeColor.ORANGE },
            { value: 'CAMPING', label: 'Camping', color: BadgeColor.YELLOW },
            { value: 'ROOM', label: 'Room', color: BadgeColor.PINK },
            { value: 'MOTEL', label: 'Motel', color: BadgeColor.INDIGO },
            { value: 'RESORT', label: 'Resort', color: BadgeColor.RED }
        ]
    },
    {
        id: 'destination',
        header: 'Destination',
        accessorKey: 'destination.name',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.DESTINATION,
            color: BadgeColor.GREEN
        },
        linkHandler: (row) =>
            row.destination?.slug
                ? {
                      to: '/destinations/$slug',
                      params: { slug: row.destination.slug }
                  }
                : undefined
    },
    {
        id: 'owner',
        header: 'Owner',
        accessorKey: 'owner.displayName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.USER,
            color: BadgeColor.PINK
        },
        linkHandler: (row) =>
            row.owner?.id
                ? {
                      to: '/users/$id',
                      params: { id: row.owner.id }
                  }
                : undefined
    },
    {
        id: 'price',
        header: 'Price',
        accessorKey: 'basePrice',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'averageRating',
        header: 'Rating',
        accessorKey: 'averageRating',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'reviewsCount',
        header: 'Reviews',
        accessorKey: 'reviewsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
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
            { value: 'RESTRICTED', label: 'Restricted', color: BadgeColor.PINK }
        ]
    },
    {
        id: 'lifecycleState',
        header: 'Status',
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'DRAFT', label: 'Draft', color: BadgeColor.GRAY },
            { value: 'ACTIVE', label: 'Active', color: BadgeColor.GREEN },
            { value: 'ARCHIVED', label: 'Archived', color: BadgeColor.ORANGE }
        ]
    },
    {
        id: 'moderationState',
        header: 'Moderation',
        accessorKey: 'moderationState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'PENDING', label: 'Pending', color: BadgeColor.YELLOW },
            { value: 'APPROVED', label: 'Approved', color: BadgeColor.GREEN },
            { value: 'REJECTED', label: 'Rejected', color: BadgeColor.RED }
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
