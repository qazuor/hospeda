/**
 * @file experience.columns.ts
 * Column factory for the experience admin list page (SPEC-240 T-028).
 *
 * Mirrors the gastronomy columns pattern. Each column receives a translation
 * function so headers are localised at render time.
 */

import { DeleteRowButton } from '@/components/entity-list/DeleteRowButton';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { EditIcon } from '@repo/icons';
import { ExperienceTypeEnum, PermissionEnum } from '@repo/schemas';
import { Link } from '@tanstack/react-router';
import { Fragment, createElement } from 'react';
import { useDeleteExperienceMutation } from '../hooks/useExperienceQuery';
import type { ExperienceListItem } from './experience.config';

// ---------------------------------------------------------------------------
// Badge label maps
// ---------------------------------------------------------------------------

/** Spanish labels for each ExperienceTypeEnum value. */
const TYPE_LABELS: Record<ExperienceTypeEnum, string> = {
    [ExperienceTypeEnum.CAR_RENTAL]: 'Alquiler de autos',
    [ExperienceTypeEnum.BIKE_RENTAL]: 'Alquiler de bicicletas',
    [ExperienceTypeEnum.KAYAK_RENTAL]: 'Alquiler de kayak',
    [ExperienceTypeEnum.QUAD_RENTAL]: 'Alquiler de cuadriciclos',
    [ExperienceTypeEnum.TOUR_GUIDE]: 'Guía turístico',
    [ExperienceTypeEnum.GUIDED_VISIT]: 'Visita guiada',
    [ExperienceTypeEnum.EXCURSION]: 'Excursión',
    [ExperienceTypeEnum.BOAT_TRIP]: 'Paseo en lancha',
    [ExperienceTypeEnum.FISHING_CHARTER]: 'Pesca deportiva',
    [ExperienceTypeEnum.BIRD_WATCHING]: 'Avistamiento de aves',
    [ExperienceTypeEnum.CULTURAL_TOUR]: 'Tour cultural',
    [ExperienceTypeEnum.WINE_TASTING]: 'Degustación de vinos',
    [ExperienceTypeEnum.OUTDOOR_ADVENTURE]: 'Aventura al aire libre',
    [ExperienceTypeEnum.OTHER]: 'Otro'
};

/** Badge colour mapping per experience type. */
const TYPE_BADGE_OPTIONS = Object.values(ExperienceTypeEnum).map((value) => ({
    value,
    label: TYPE_LABELS[value] ?? value,
    color: BadgeColor.CYAN
}));

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

/**
 * Builds the TanStack Table column definitions for the experience admin list page.
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Read-only array of column configurations
 */
export const createExperienceColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<ExperienceListItem>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.EXPERIENCE,
            color: BadgeColor.CYAN
        },
        linkHandler: (row) =>
            row.id
                ? {
                      to: '/experiences/$id',
                      params: { id: row.id }
                  }
                : undefined
    },
    {
        id: 'type',
        header: t('admin-entities.columns.type'),
        accessorKey: 'type',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: TYPE_BADGE_OPTIONS
    },
    {
        id: 'destination',
        header: t('admin-entities.columns.destination'),
        // Show the destination NAME from the eager-loaded relation (the admin
        // list response includes `destination: { id, name, slug }`), not the raw
        // FK UUID. TanStack resolves the dot-path against the row.
        accessorKey: 'destination.name',
        enableSorting: false,
        columnType: ColumnType.STRING
    },
    {
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.BOOLEAN
    },
    {
        id: 'owner',
        header: t('admin-entities.columns.owner'),
        // Show a readable owner label from the eager-loaded relation, not the raw
        // FK UUID. The users table has no single `name` column, so compose from
        // displayName → firstName+lastName → email (an admin-provisioned commerce
        // owner may only have an email until they complete their profile).
        accessorKey: 'ownerId',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => {
            const owner = (
                row as {
                    owner?: {
                        displayName?: string | null;
                        firstName?: string | null;
                        lastName?: string | null;
                        email?: string | null;
                    };
                }
            ).owner;
            if (!owner) return '—';
            const composed =
                owner.displayName?.trim() ||
                [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() ||
                owner.email ||
                '—';
            return composed;
        }
    },
    {
        id: 'lifecycleStatus',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleStatus',
        enableSorting: true,
        columnType: ColumnType.STRING
    },
    {
        id: 'createdAt',
        header: t('admin-entities.columns.createdAt'),
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
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
                        to: '/experiences/$id/edit' as never,
                        params: { id: row.id } as never,
                        className:
                            'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                        'aria-label': t('admin-entities.actions.edit')
                    } as never,
                    createElement(EditIcon, { size: 16 })
                ),
                createElement(DeleteRowButton, {
                    entityId: row.id ?? '',
                    entityName: row.name ?? row.id ?? '',
                    entityLabel: t('admin-entities.entities.experience.singular'),
                    permission: PermissionEnum.COMMERCE_DELETE,
                    useDeleteMutation: useDeleteExperienceMutation,
                    variant: 'icon',
                    entityGender: 'f'
                })
            )
    }
];
