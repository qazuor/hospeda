import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { EditIcon } from '@repo/icons';
import { ClientTypeEnum, LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { useDeleteSponsorMutation } from '../hooks/useSponsorQuery';
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
        },
        {
            id: 'actions',
            header: t('admin-entities.columns.actions'),
            accessorKey: 'id',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) =>
                createElement(
                    Fragment,
                    null,
                    createElement(
                        Link,
                        {
                            to: '/sponsors/$id/edit' as never,
                            params: { id: row.id } as never,
                            className:
                                'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                            'aria-label': t('admin-entities.actions.edit')
                        } as never,
                        createElement(EditIcon, { size: 16 })
                    ),
                    createElement(DeleteRowButton, {
                        entityId: row.id,
                        entityName: row.name,
                        entityLabel: t('admin-entities.entities.sponsor.singular'),
                        permission: PermissionEnum.POST_SPONSOR_DELETE,
                        useDeleteMutation: useDeleteSponsorMutation,
                        variant: 'icon',
                        entityGender: 'm'
                    })
                )
        }
    ] as const;
