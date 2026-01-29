import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { Tag } from '../schemas/tags.schemas';

export const createTagsColumns = (): readonly ColumnConfig<Tag>[] => [
    {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.TAG,
            color: BadgeColor.BLUE
        },
        linkHandler: (row) => ({ to: `/settings/tags/${row.id}` })
    },
    {
        id: 'slug',
        header: 'Slug',
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'color',
        header: 'Color',
        accessorKey: 'color',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            { value: 'RED', label: 'Rojo', color: BadgeColor.RED },
            { value: 'BLUE', label: 'Azul', color: BadgeColor.BLUE },
            { value: 'GREEN', label: 'Verde', color: BadgeColor.GREEN },
            { value: 'YELLOW', label: 'Amarillo', color: BadgeColor.YELLOW },
            { value: 'ORANGE', label: 'Naranja', color: BadgeColor.ORANGE },
            { value: 'PURPLE', label: 'Púrpura', color: BadgeColor.PURPLE },
            { value: 'PINK', label: 'Rosa', color: BadgeColor.PINK },
            { value: 'GREY', label: 'Gris', color: BadgeColor.GRAY },
            { value: 'CYAN', label: 'Cian', color: BadgeColor.CYAN }
        ]
    },
    {
        id: 'icon',
        header: 'Icon',
        accessorKey: 'icon',
        enableSorting: false,
        columnType: ColumnType.STRING
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
