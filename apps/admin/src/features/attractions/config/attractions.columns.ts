import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Attraction } from '../schemas/attractions.schemas';

export const createAttractionsColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<Attraction>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.ATTRACTION,
            color: BadgeColor.TEAL
        },
        linkHandler: (row) =>
            row.id
                ? {
                      to: '/content/destination-attractions/$id',
                      params: { id: row.id }
                  }
                : undefined
    },
    {
        id: 'slug',
        header: t('admin-entities.columns.slug'),
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'description',
        header: t('admin-entities.columns.description'),
        accessorKey: 'description',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'icon',
        header: t('admin-entities.columns.icon'),
        accessorKey: 'icon',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'isBuiltin',
        header: t('admin-entities.columns.builtIn'),
        accessorKey: 'isBuiltin',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'displayWeight',
        header: t('admin-entities.columns.weight'),
        accessorKey: 'displayWeight',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'destinationCount',
        header: t('admin-entities.columns.destinationsCount'),
        accessorKey: 'destinationCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
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
        id: 'createdAt',
        header: t('admin-entities.columns.createdAt'),
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
