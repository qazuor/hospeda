import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { ClientTypeEnum, LifecycleStatusEnum } from '@repo/schemas';
import type { Sponsor } from '../schemas/sponsors.schemas';

/**
 * Creates column configuration for sponsors list
 */
export const createSponsorsColumns = (t: ColumnTFunction): readonly ColumnConfig<Sponsor>[] =>
    [
        {
            id: 'name',
            header: t('admin-entities.columns.name'),
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
            header: t('admin-entities.columns.type'),
            accessorKey: 'type',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: ClientTypeEnum.POST_SPONSOR,
                    label: t('admin-entities.types.sponsor.postSponsor'),
                    color: BadgeColor.BLUE
                },
                {
                    value: ClientTypeEnum.ADVERTISER,
                    label: t('admin-entities.types.sponsor.advertiser'),
                    color: BadgeColor.GREEN
                },
                {
                    value: ClientTypeEnum.HOST,
                    label: t('admin-entities.types.sponsor.host'),
                    color: BadgeColor.PURPLE
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'description',
            header: t('admin-entities.columns.description'),
            accessorKey: 'description',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        },
        {
            id: 'email',
            header: t('admin-entities.columns.email'),
            accessorKey: 'contact.email',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'phone',
            header: t('admin-entities.columns.phone'),
            accessorKey: 'contact.phone',
            enableSorting: false,
            columnType: ColumnType.STRING,
            startVisibleOnTable: false,
            startVisibleOnGrid: false
        },
        {
            id: 'website',
            header: t('admin-entities.columns.website'),
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
            header: t('admin-entities.columns.status'),
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: LifecycleStatusEnum.ACTIVE,
                    label: t('admin-entities.states.lifecycle.active'),
                    color: BadgeColor.SUCCESS
                },
                {
                    value: LifecycleStatusEnum.DRAFT,
                    label: t('admin-entities.states.lifecycle.draft'),
                    color: BadgeColor.WARNING
                },
                {
                    value: LifecycleStatusEnum.ARCHIVED,
                    label: t('admin-entities.states.lifecycle.archived'),
                    color: BadgeColor.SECONDARY
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'createdAt',
            header: t('admin-entities.columns.createdAt'),
            accessorKey: 'createdAt',
            enableSorting: true,
            columnType: ColumnType.TIME_AGO,
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        }
    ] as const;
