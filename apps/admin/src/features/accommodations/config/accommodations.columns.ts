import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Accommodation } from '../schemas/accommodations.schemas';

/**
 * Column configuration for accommodations list
 */
export const createAccommodationsColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<Accommodation>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
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
        header: t('admin-entities.columns.type'),
        accessorKey: 'type',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'HOTEL',
                label: t('admin-entities.types.accommodation.hotel'),
                color: BadgeColor.BLUE
            },
            {
                value: 'HOSTEL',
                label: t('admin-entities.types.accommodation.hostel'),
                color: BadgeColor.CYAN
            },
            {
                value: 'APARTMENT',
                label: t('admin-entities.types.accommodation.apartment'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'HOUSE',
                label: t('admin-entities.types.accommodation.house'),
                color: BadgeColor.GREEN
            },
            {
                value: 'COUNTRY_HOUSE',
                label: t('admin-entities.types.accommodation.countryHouse'),
                color: BadgeColor.TEAL
            },
            {
                value: 'CABIN',
                label: t('admin-entities.types.accommodation.cabin'),
                color: BadgeColor.ORANGE
            },
            {
                value: 'CAMPING',
                label: t('admin-entities.types.accommodation.camping'),
                color: BadgeColor.YELLOW
            },
            {
                value: 'ROOM',
                label: t('admin-entities.types.accommodation.room'),
                color: BadgeColor.PINK
            },
            {
                value: 'MOTEL',
                label: t('admin-entities.types.accommodation.motel'),
                color: BadgeColor.INDIGO
            },
            {
                value: 'RESORT',
                label: t('admin-entities.types.accommodation.resort'),
                color: BadgeColor.RED
            }
        ]
    },
    {
        id: 'destination',
        header: t('admin-entities.columns.destination'),
        accessorKey: 'destination.name',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.DESTINATION,
            color: BadgeColor.GREEN
        },
        linkHandler: (row) =>
            row.destination?.id
                ? {
                      to: '/destinations/$id',
                      params: { id: row.destination.id }
                  }
                : undefined
    },
    {
        id: 'owner',
        header: t('admin-entities.columns.owner'),
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
                      to: '/access/users/$id',
                      params: { id: row.owner.id }
                  }
                : undefined
    },
    {
        id: 'price',
        header: t('admin-entities.columns.price'),
        accessorKey: 'price.price',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'averageRating',
        header: t('admin-entities.columns.rating'),
        accessorKey: 'averageRating',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'reviewsCount',
        header: t('admin-entities.columns.reviewsCount'),
        accessorKey: 'reviewsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'visibility',
        header: t('admin-entities.columns.visibility'),
        accessorKey: 'visibility',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'PUBLIC',
                label: t('admin-entities.states.visibility.public'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'PRIVATE',
                label: t('admin-entities.states.visibility.private'),
                color: BadgeColor.CYAN
            },
            {
                value: 'RESTRICTED',
                label: t('admin-entities.states.visibility.restricted'),
                color: BadgeColor.PINK
            }
        ]
    },
    {
        id: 'lifecycleState',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
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
        ]
    },
    {
        id: 'moderationState',
        header: t('admin-entities.columns.moderation'),
        accessorKey: 'moderationState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'PENDING',
                label: t('admin-entities.states.moderation.pending'),
                color: BadgeColor.YELLOW
            },
            {
                value: 'APPROVED',
                label: t('admin-entities.states.moderation.approved'),
                color: BadgeColor.GREEN
            },
            {
                value: 'REJECTED',
                label: t('admin-entities.states.moderation.rejected'),
                color: BadgeColor.RED
            }
        ]
    },
    {
        id: 'createdAt',
        header: t('admin-entities.columns.createdAt'),
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
