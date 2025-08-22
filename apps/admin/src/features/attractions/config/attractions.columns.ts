import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Attraction } from '../schemas/attractions.schemas';

export const createAttractionsColumns = (): readonly ColumnConfig<Attraction>[] => [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.ATTRACTION,
            color: BadgeColor.TEAL
        },
        linkHandler: (row) => ({
            to: '/attractions/$slug',
            params: { slug: row.slug }
        })
    },
    {
        id: 'slug',
        header: 'Slug',
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'description',
        header: 'Description',
        accessorKey: 'description',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'icon',
        header: 'Icon',
        accessorKey: 'icon',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'isBuiltin',
        header: 'Built-in',
        accessorKey: 'isBuiltin',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'destinationCount',
        header: 'Destinations',
        accessorKey: 'destinationCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
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
        id: 'createdAt',
        header: 'Created',
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
