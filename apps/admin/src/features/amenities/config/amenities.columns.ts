import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Amenity } from '../schemas/amenities.schemas';

export const createAmenitiesColumns = (): readonly ColumnConfig<Amenity>[] => [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.AMENITY,
            color: BadgeColor.CYAN
        },
        linkHandler: (row) =>
            row.slug
                ? {
                      to: '/amenities/$slug',
                      params: { slug: row.slug }
                  }
                : undefined
    },
    {
        id: 'slug',
        header: 'Slug',
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'BASIC', label: 'Basic', color: BadgeColor.GRAY },
            { value: 'COMFORT', label: 'Comfort', color: BadgeColor.BLUE },
            { value: 'LUXURY', label: 'Luxury', color: BadgeColor.PURPLE },
            { value: 'TECHNOLOGY', label: 'Technology', color: BadgeColor.CYAN },
            { value: 'RECREATION', label: 'Recreation', color: BadgeColor.GREEN },
            { value: 'BUSINESS', label: 'Business', color: BadgeColor.ORANGE }
        ]
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
        id: 'isFeatured',
        header: 'Featured',
        accessorKey: 'isFeatured',
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
