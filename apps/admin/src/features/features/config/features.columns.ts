import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Feature } from '../schemas/features.schemas';

export const createFeaturesColumns = (): readonly ColumnConfig<Feature>[] => [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.FEATURE,
            color: BadgeColor.INDIGO
        },
        linkHandler: (row) => ({
            to: '/features/$slug',
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
        id: 'is_featured',
        header: 'Featured',
        accessorKey: 'is_featured',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'accommodationCount',
        header: 'Accommodations',
        accessorKey: 'accommodationCount',
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
