import type { ColumnConfig } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { ClientTypeEnum, LifecycleStatusEnum } from '@repo/schemas';
import type { Sponsor } from '../schemas/sponsors.schemas';

/**
 * Creates column configuration for sponsors list
 */
export const createSponsorsColumns = (): readonly ColumnConfig<Sponsor>[] =>
    [
        {
            id: 'name',
            header: 'Name',
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: { entityType: EntityType.SPONSOR },
            linkHandler: (row) => ({ to: `/sponsors/${row.id}` }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'type',
            header: 'Type',
            accessorKey: 'type',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: ClientTypeEnum.POST_SPONSOR,
                    label: 'Post Sponsor',
                    color: BadgeColor.BLUE
                },
                { value: ClientTypeEnum.ADVERTISER, label: 'Advertiser', color: BadgeColor.GREEN },
                {
                    value: ClientTypeEnum.HOST,
                    label: 'Host',
                    color: BadgeColor.PURPLE
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'description',
            header: 'Description',
            accessorKey: 'description',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        },
        {
            id: 'email',
            header: 'Email',
            accessorKey: 'contact.email',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'phone',
            header: 'Phone',
            accessorKey: 'contact.phone',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'website',
            header: 'Website',
            accessorKey: 'contact.website',
            enableSorting: false,
            columnType: ColumnType.LINK,
            linkHandler: (row) => {
                const website = row.contactInfo?.website;
                if (website) {
                    return { to: website };
                }
                return undefined;
            },
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'lifecycleState',
            header: 'Status',
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                { value: LifecycleStatusEnum.ACTIVE, label: 'Active', color: BadgeColor.SUCCESS },
                {
                    value: LifecycleStatusEnum.DRAFT,
                    label: 'Draft',
                    color: BadgeColor.WARNING
                },
                {
                    value: LifecycleStatusEnum.ARCHIVED,
                    label: 'Archived',
                    color: BadgeColor.SECONDARY
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'createdAt',
            header: 'Created',
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        }
    ] as const;
