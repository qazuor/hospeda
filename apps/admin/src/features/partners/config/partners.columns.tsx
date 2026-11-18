import type { TranslationKey } from '@repo/i18n';
import { Link } from '@tanstack/react-router';
import { type ComponentProps, createElement, Fragment } from 'react';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { partnerTypeName } from '@/hooks/use-partner-types';
import type { Partner } from '../schemas/partners.schemas';

/**
 * Renders a partner's catalog type as a badge labelled from the type's own
 * `nameI18n`; a partner the release-N backfill has not reached shows nothing.
 *
 * @param row - The partner list row, carrying the hydrated `partnerType` ref.
 */
const renderPartnerType = (row: Partner) =>
    row.partnerType
        ? createElement(
              Badge,
              {
                  variant: 'secondary',
                  'data-testid': 'partner-type-badge'
              } as ComponentProps<typeof Badge>,
              partnerTypeName(row.partnerType)
          )
        : null;

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
            // HOS-2336 AC-4.2: the type's own catalog name (data, not copy).
            id: 'type',
            header: t('admin-filters.partnerType.label' as TranslationKey),
            accessorKey: 'partnerType',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: renderPartnerType,
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'lifecycleState',
            header: t('admin-entities.columns.lifecycleState'),
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
