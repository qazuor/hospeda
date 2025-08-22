import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType, ListOrientation } from '@/components/table/DataTable';
import type { Destination } from '../schemas/destinations.schemas';

/**
 * Column configuration for destinations list
 */
export const createDestinationsColumns = (): readonly ColumnConfig<Destination>[] => [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.DESTINATION,
            color: BadgeColor.GREEN
        },
        linkHandler: (row) => ({
            to: '/destinations/$slug',
            params: { slug: row.slug }
        })
    },
    {
        id: 'accommodationsCount',
        header: 'Accommodations',
        accessorKey: 'accommodationsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
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
        id: 'gallery',
        header: 'Gallery',
        accessorKey: 'media.gallery',
        enableSorting: false,
        columnType: ColumnType.GALLERY,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'attractions',
        header: 'Attractions',
        accessorKey: 'attractions',
        enableSorting: false,
        columnType: ColumnType.LIST,
        listSeparator: ' • ',
        listOrientation: ListOrientation.COLUMN
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
        id: 'moderationState',
        header: 'Moderation',
        accessorKey: 'moderationState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        startVisibleOnTable: false,
        startVisibleOnGrid: false,
        badgeOptions: [
            { value: 'PENDING', label: 'Pending', color: BadgeColor.PINK },
            { value: 'APPROVED', label: 'Approved', color: BadgeColor.CYAN },
            { value: 'REJECTED', label: 'Rejected', color: BadgeColor.PURPLE },
            { value: 'UNDER_REVIEW', label: 'Under Review', color: BadgeColor.GREEN }
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
