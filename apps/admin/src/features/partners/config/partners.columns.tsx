import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import type { TranslationKey } from '@repo/i18n';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import type { Partner } from '../schemas/partners.schemas';

/**
 * Create columns for partners table
 */
export const createPartnersColumns = (t: ColumnTFunction): readonly ColumnConfig<Partner>[] =>
    [
        {
            id: 'name',
            header: t('admin-entities.columns.name' as TranslationKey),
            accessorKey: 'name',
            enableSorting: true,
            columnType: ColumnType.ENTITY,
            entityOptions: { entityType: EntityType.PARTNER },
            linkHandler: (row: Partner) => ({ to: `/partners/${row.id}` }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'type',
            header: t('admin-filters.partnerType.label' as TranslationKey),
            accessorKey: 'type',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'commerce',
                    label: t('admin-filters.partnerType.commerce' as TranslationKey),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'ngo',
                    label: t('admin-filters.partnerType.ngo' as TranslationKey),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'institution',
                    label: t('admin-filters.partnerType.institution' as TranslationKey),
                    color: BadgeColor.PURPLE
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'tier',
            header: t('admin-filters.partnerTier.label' as TranslationKey),
            accessorKey: 'tier',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'gold',
                    label: t('admin-filters.partnerTier.gold' as TranslationKey),
                    color: BadgeColor.YELLOW
                },
                {
                    value: 'silver',
                    label: t('admin-filters.partnerTier.silver' as TranslationKey),
                    color: BadgeColor.GRAY
                },
                {
                    value: 'bronze',
                    label: t('admin-filters.partnerTier.bronze' as TranslationKey),
                    color: BadgeColor.ORANGE
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'subscriptionStatus',
            header: t('admin-filters.partnerSubscriptionStatus.label' as TranslationKey),
            accessorKey: 'subscriptionStatus',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'active',
                    label: t('admin-filters.partnerSubscriptionStatus.active' as TranslationKey),
                    color: BadgeColor.SUCCESS
                },
                {
                    value: 'pending',
                    label: t('admin-filters.partnerSubscriptionStatus.pending' as TranslationKey),
                    color: BadgeColor.SECONDARY
                },
                {
                    value: 'past_due',
                    label: t('admin-filters.partnerSubscriptionStatus.past_due' as TranslationKey),
                    color: BadgeColor.ERROR
                },
                {
                    value: 'cancelled',
                    label: t('admin-filters.partnerSubscriptionStatus.cancelled' as TranslationKey),
                    color: BadgeColor.DEFAULT
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'lifecycleState',
            header: t('admin-entities.columns.lifecycleState' as TranslationKey),
            accessorKey: 'lifecycleState',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'ACTIVE',
                    label: t('admin-entities.states.lifecycle.active' as TranslationKey),
                    color: BadgeColor.SUCCESS
                },
                {
                    value: 'ARCHIVED',
                    label: t('admin-entities.states.lifecycle.archived' as TranslationKey),
                    color: BadgeColor.DEFAULT
                }
            ],
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'startsAt',
            header: 'Inicia',
            accessorKey: 'startsAt',
            enableSorting: true,
            columnType: ColumnType.DATE,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'endsAt',
            header: 'Finaliza',
            accessorKey: 'endsAt',
            enableSorting: true,
            columnType: ColumnType.DATE,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'actions',
            header: 'Acciones',
            accessorKey: 'id',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row: Partner) =>
                createElement(
                    Fragment,
                    null,
                    createElement(
                        Link,
                        {
                            to: `/partners/${row.id}`,
                            className: 'text-primary hover:underline text-sm',
                            'aria-label': 'Ver'
                        },
                        'Ver'
                    ),
                    createElement(
                        Link,
                        {
                            to: `/partners/${row.id}/edit`,
                            className: 'text-muted-foreground hover:underline text-sm',
                            'aria-label': 'Editar'
                        },
                        'Editar'
                    )
                ),
            startVisibleOnTable: true,
            startVisibleOnGrid: false
        }
    ] as const;
