import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType, ListOrientation } from '@/components/table/DataTable';
import type { Event } from '../schemas/events.schemas';

export const createEventsColumns = (t: ColumnTFunction): readonly ColumnConfig<Event>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.EVENT,
            color: BadgeColor.ORANGE
        },
        linkHandler: (row) => ({
            to: '/events/$id',
            params: { id: row.id }
        })
    },
    {
        id: 'category',
        header: t('admin-entities.columns.category'),
        accessorKey: 'category',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'CULTURE',
                label: t('admin-entities.types.event.culture'),
                color: BadgeColor.YELLOW
            },
            {
                value: 'SPORTS',
                label: t('admin-entities.types.event.sports'),
                color: BadgeColor.ORANGE
            },
            {
                value: 'FESTIVAL',
                label: t('admin-entities.types.event.festival'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'WORKSHOP',
                label: t('admin-entities.types.event.workshop'),
                color: BadgeColor.CYAN
            },
            {
                value: 'MUSIC',
                label: t('admin-entities.types.event.music'),
                color: BadgeColor.BLUE
            },
            {
                value: 'GASTRONOMY',
                label: t('admin-entities.types.event.gastronomy'),
                color: BadgeColor.PINK
            },
            {
                value: 'NATURE',
                label: t('admin-entities.types.event.nature'),
                color: BadgeColor.GREEN
            },
            {
                value: 'OTHER',
                label: t('admin-entities.types.event.other'),
                color: BadgeColor.GRAY
            }
        ]
    },
    {
        id: 'organizer',
        header: t('admin-entities.columns.organizer'),
        accessorKey: 'organizerName',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'startDate',
        header: t('admin-entities.columns.startDate'),
        accessorKey: 'date.start',
        enableSorting: true,
        columnType: ColumnType.DATE
    },
    {
        id: 'location',
        header: t('admin-entities.columns.location'),
        accessorKey: 'locationName',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'ticketPrice',
        header: t('admin-entities.columns.price'),
        accessorKey: 'pricing.price',
        enableSorting: true,
        columnType: ColumnType.PRICE
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
        id: 'tags',
        header: t('admin-entities.columns.tags'),
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
        id: 'createdAt',
        header: t('admin-entities.columns.createdAt'),
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
