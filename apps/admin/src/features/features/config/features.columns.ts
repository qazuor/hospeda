import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import { IconNameCell } from '@/components/entity-list/IconNameCell';
import { InlineFeaturedCell } from '@/components/entity-list/InlineFeaturedCell';
import {
    type InlineStateOption,
    InlineStateSelectCell
} from '@/components/entity-list/InlineStateSelectCell';
import { WeightBarCell } from '@/components/entity-list/WeightBarCell';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { resolveI18nText } from '@/utils/i18n-text';
import { EditIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { useDeleteFeatureMutation, useUpdateFeatureMutation } from '../hooks/useFeatureQuery';
import type { Feature } from '../schemas/features.schemas';

const LIFECYCLE_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
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
];

export const createFeaturesColumns = (t: ColumnTFunction): readonly ColumnConfig<Feature>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        entityOptions: {
            entityType: EntityType.FEATURE,
            color: BadgeColor.INDIGO
        },
        linkHandler: (row) => ({ to: `/content/accommodation-features/${row.id}` }),
        widgetRenderer: (row) => {
            const displayName = resolveI18nText(row.name);
            return createElement(
                Link,
                {
                    to: '/content/accommodation-features/$id' as never,
                    params: { id: row.id } as never,
                    className:
                        'inline-flex max-w-xs items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-sm ring-1 ring-inset bg-indigo-50 text-indigo-700 ring-indigo-700/20 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-400/30 dark:hover:bg-indigo-900/30 truncate'
                } as never,
                displayName
            );
        }
    },
    {
        id: 'slug',
        header: t('admin-entities.columns.slug'),
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'description',
        header: t('admin-entities.columns.description'),
        accessorKey: 'description',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => {
            const text = resolveI18nText(row.description);
            if (!text) return createElement('span', { className: 'text-muted-foreground' }, '—');
            const truncated = text.length > 80 ? `${text.slice(0, 80)}…` : text;
            return createElement(
                'span',
                { className: 'text-sm text-foreground', title: text },
                truncated
            );
        }
    },
    {
        id: 'icon',
        header: t('admin-entities.columns.icon'),
        accessorKey: 'icon',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(IconNameCell, { iconName: row.icon })
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
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineFeaturedCell<Partial<Feature>>, {
                entityId: row.id,
                entityName: resolveI18nText(row.name),
                entityLabelKey: 'admin-entities.entities.feature.singular',
                checked: row.isFeatured ?? false,
                permission: PermissionEnum.FEATURE_FEATURED_TOGGLE,
                useUpdateMutation: useUpdateFeatureMutation
            })
    },
    {
        id: 'displayWeight',
        header: t('admin-entities.columns.weight'),
        accessorKey: 'displayWeight',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(WeightBarCell, { value: row.displayWeight })
    },
    {
        id: 'accommodationCount',
        header: t('admin-entities.columns.accommodationsCount'),
        accessorKey: 'accommodationCount',
        enableSorting: false,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'lifecycleState',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell<Partial<Feature>>, {
                entityId: row.id,
                entityName: resolveI18nText(row.name),
                entityLabelKey: 'admin-entities.entities.feature.singular',
                field: 'lifecycleState',
                currentValue: row.lifecycleState,
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: LIFECYCLE_OPTIONS(t),
                permission: PermissionEnum.FEATURE_LIFECYCLE_CHANGE,
                useUpdateMutation: useUpdateFeatureMutation,
                confirmValues: ['ARCHIVED'],
                confirmCopyKey: 'archive'
            })
    },
    {
        id: 'createdAt',
        header: t('admin-entities.columns.createdAt'),
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    },
    {
        // SPEC-117 D-CONTENT.1 — Row actions: Edit + Delete with confirmation.
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
                        to: '/content/accommodation-features/$id/edit' as never,
                        params: { id: row.id } as never,
                        className:
                            'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                        'aria-label': t('admin-entities.actions.edit')
                    } as never,
                    createElement(EditIcon, { size: 16 })
                ),
                createElement(DeleteRowButton, {
                    entityId: row.id,
                    entityName: resolveI18nText(row.name),
                    entityLabel: t('admin-entities.entities.feature.singular'),
                    permission: PermissionEnum.FEATURE_DELETE,
                    useDeleteMutation: useDeleteFeatureMutation,
                    variant: 'icon',
                    entityGender: 'f'
                })
            )
    }
];
