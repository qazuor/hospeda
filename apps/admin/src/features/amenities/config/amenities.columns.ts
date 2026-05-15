import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Amenity } from '../schemas/amenities.schemas';

export const createAmenitiesColumns = (t: ColumnTFunction): readonly ColumnConfig<Amenity>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.AMENITY,
            color: BadgeColor.CYAN
        },
        linkHandler: (row) => ({ to: `/content/accommodation-amenities/${row.id}` })
    },
    {
        id: 'slug',
        header: t('admin-entities.columns.slug'),
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'type',
        header: t('admin-entities.columns.type'),
        accessorKey: 'type',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'BASIC',
                label: t('admin-entities.types.amenity.basic'),
                color: BadgeColor.GRAY
            },
            {
                value: 'COMFORT',
                label: t('admin-entities.types.amenity.comfort'),
                color: BadgeColor.BLUE
            },
            {
                value: 'LUXURY',
                label: t('admin-entities.types.amenity.luxury'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'TECHNOLOGY',
                label: t('admin-entities.types.amenity.technology'),
                color: BadgeColor.CYAN
            },
            {
                value: 'RECREATION',
                label: t('admin-entities.types.amenity.recreation'),
                color: BadgeColor.GREEN
            },
            {
                value: 'BUSINESS',
                label: t('admin-entities.types.amenity.business'),
                color: BadgeColor.ORANGE
            }
        ]
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
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
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
        id: 'accommodationCount',
        header: t('admin-entities.columns.accommodationsCount'),
        accessorKey: 'accommodationCount',
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
