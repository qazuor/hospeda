import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType, ListOrientation } from '@/components/table/DataTable';
import type { Destination } from '../schemas/destinations.schemas';

/**
 * Column configuration for destinations list
 */
export const createDestinationsColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<Destination>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.DESTINATION,
            color: BadgeColor.GREEN
        },
        linkHandler: (row) => ({
            to: '/destinations/$id',
            params: { id: row.id }
        })
    },
    {
        id: 'accommodationsCount',
        header: t('admin-entities.columns.accommodationsCount'),
        accessorKey: 'accommodationsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'featuredImage',
        header: t('admin-entities.columns.featuredImage'),
        accessorKey: 'media.featuredImage',
        enableSorting: false,
        columnType: ColumnType.IMAGE,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'gallery',
        header: t('admin-entities.columns.gallery'),
        accessorKey: 'media.gallery',
        enableSorting: false,
        columnType: ColumnType.GALLERY,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'attractions',
        header: t('admin-entities.columns.attractions'),
        accessorKey: 'attractions',
        enableSorting: false,
        columnType: ColumnType.LIST,
        listSeparator: ' • ',
        listOrientation: ListOrientation.COLUMN
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
                value: 'HIDDEN',
                label: t('admin-entities.states.visibility.hidden'),
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
        startVisibleOnTable: false,
        startVisibleOnGrid: true,
        badgeOptions: [
            {
                value: 'ACTIVE',
                label: t('admin-entities.states.lifecycle.active'),
                color: BadgeColor.CYAN
            },
            {
                value: 'INACTIVE',
                label: t('admin-entities.states.lifecycle.inactive'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'ARCHIVED',
                label: t('admin-entities.states.lifecycle.archived'),
                color: BadgeColor.PINK
            },
            {
                value: 'DELETED',
                label: t('admin-entities.states.lifecycle.deleted'),
                color: BadgeColor.GREEN
            }
        ]
    },
    {
        id: 'moderationState',
        header: t('admin-entities.columns.moderation'),
        accessorKey: 'moderationState',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        startVisibleOnTable: false,
        startVisibleOnGrid: false,
        badgeOptions: [
            {
                value: 'PENDING',
                label: t('admin-entities.states.moderation.pending'),
                color: BadgeColor.PINK
            },
            {
                value: 'APPROVED',
                label: t('admin-entities.states.moderation.approved'),
                color: BadgeColor.CYAN
            },
            {
                value: 'REJECTED',
                label: t('admin-entities.states.moderation.rejected'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'UNDER_REVIEW',
                label: t('admin-entities.states.moderation.underReview'),
                color: BadgeColor.GREEN
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
