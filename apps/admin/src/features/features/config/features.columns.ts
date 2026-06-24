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
import { defaultLocale, trans } from '@repo/i18n';
import { EditIcon } from '@repo/icons';
import type { ApplicableVertical } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { useDeleteFeatureMutation, useUpdateFeatureMutation } from '../hooks/useFeatureQuery';
import type { Feature } from '../schemas/features.schemas';

/**
 * Converts a slug to a human-readable Title Case label.
 * Used as fallback when the i18n key is missing.
 */
const humanizeSlug = (slug: string): string =>
    slug
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

/**
 * Resolves a feature display label from its slug via @repo/i18n.
 * Key: `accommodations.featureNames.<slug>` in the default locale.
 * Falls back to humanizeSlug() so the UI never shows a raw slug or [MISSING:…].
 */
const resolveFeatureLabel = (slug: string | null | undefined, fallback: string): string => {
    if (!slug) return fallback;
    const key = `accommodations.featureNames.${slug}`;
    const translated = trans[defaultLocale as keyof typeof trans]?.[key];
    if (translated && !translated.startsWith('[MISSING:')) return translated;
    return humanizeSlug(slug);
};

/**
 * Per-vertical badge styles (matching the amenities columns convention).
 */
const VERTICAL_BADGE_STYLES: Record<ApplicableVertical, string> = {
    accommodation:
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/20 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/30',
    gastronomy:
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-700/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-400/30',
    experience:
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-700/20 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-400/30'
};

const VERTICAL_LABELS: Record<ApplicableVertical, string> = {
    accommodation: 'Alojamiento',
    gastronomy: 'Gastronomía',
    experience: 'Experiencia'
};

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
        id: 'slug',
        header: t('admin-entities.columns.name'),
        accessorKey: 'slug',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        entityOptions: {
            entityType: EntityType.FEATURE,
            color: BadgeColor.INDIGO
        },
        linkHandler: (row) => ({ to: `/content/accommodation-features/${row.id}` }),
        widgetRenderer: (row) => {
            const displayName = resolveFeatureLabel(row.slug, row.id);
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
        id: 'description',
        header: t('admin-entities.columns.description'),
        accessorKey: 'description',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => {
            const desc = row.description;
            const text = desc?.es || desc?.en || desc?.pt || '';
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
        id: 'applicableVerticals',
        header: 'Verticales',
        accessorKey: 'applicableVerticals',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => {
            const verticals = row.applicableVerticals ?? [];
            if (verticals.length === 0) {
                return createElement('span', { className: 'text-muted-foreground text-xs' }, '—');
            }
            return createElement(
                'div',
                { className: 'flex flex-wrap gap-1' },
                ...verticals.map((v: ApplicableVertical) =>
                    createElement(
                        'span',
                        { key: v, className: VERTICAL_BADGE_STYLES[v] },
                        VERTICAL_LABELS[v]
                    )
                )
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
                entityName: resolveFeatureLabel(row.slug, row.id),
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
                entityName: resolveFeatureLabel(row.slug, row.id),
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
                    entityName: resolveFeatureLabel(row.slug, row.id),
                    entityLabel: t('admin-entities.entities.feature.singular'),
                    permission: PermissionEnum.FEATURE_DELETE,
                    useDeleteMutation: useDeleteFeatureMutation,
                    variant: 'icon',
                    entityGender: 'f'
                })
            )
    }
];
