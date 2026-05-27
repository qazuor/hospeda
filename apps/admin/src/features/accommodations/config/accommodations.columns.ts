import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { PermissionEnum } from '@repo/schemas';
import { createElement } from 'react';
import { AccommodationFeaturedCell } from '../components/AccommodationFeaturedCell';
import { AccommodationRatingCell } from '../components/AccommodationRatingCell';
import { AccommodationReviewsCell } from '../components/AccommodationReviewsCell';
import {
    type AccommodationStateOption,
    AccommodationStateSelectCell
} from '../components/AccommodationStateSelectCell';
import { AccommodationTypeBadge } from '../components/AccommodationTypeBadge';
import type { Accommodation } from '../schemas/accommodations.schemas';

/**
 * Visibility options (value + localized label + badge color). Single source for
 * both the read-only badge fallback and the inline-edit dropdown.
 */
const VISIBILITY_OPTIONS = (t: ColumnTFunction): ReadonlyArray<AccommodationStateOption> => [
    {
        value: 'PUBLIC',
        label: t('admin-entities.states.visibility.public'),
        color: BadgeColor.PURPLE
    },
    {
        value: 'PRIVATE',
        label: t('admin-entities.states.visibility.private'),
        color: BadgeColor.CYAN
    },
    {
        value: 'RESTRICTED',
        label: t('admin-entities.states.visibility.restricted'),
        color: BadgeColor.PINK
    }
];

/** Lifecycle-state options. ARCHIVED is the destructive transition. */
const LIFECYCLE_OPTIONS = (t: ColumnTFunction): ReadonlyArray<AccommodationStateOption> => [
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

/** Moderation-state options. REJECTED is the destructive transition. */
const MODERATION_OPTIONS = (t: ColumnTFunction): ReadonlyArray<AccommodationStateOption> => [
    {
        value: 'PENDING',
        label: t('admin-entities.states.moderation.pending'),
        color: BadgeColor.YELLOW
    },
    {
        value: 'APPROVED',
        label: t('admin-entities.states.moderation.approved'),
        color: BadgeColor.GREEN
    },
    {
        value: 'REJECTED',
        label: t('admin-entities.states.moderation.rejected'),
        color: BadgeColor.RED
    }
];

/**
 * Column configuration for accommodations list
 */
export const createAccommodationsColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<Accommodation>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.ACCOMMODATION,
            color: BadgeColor.BLUE
        },
        linkHandler: (row) => ({
            to: '/accommodations/$id',
            params: { id: row.id }
        })
    },
    {
        id: 'type',
        header: t('admin-entities.columns.type'),
        accessorKey: 'type',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(AccommodationTypeBadge, { row })
    },
    {
        id: 'destination',
        header: t('admin-entities.columns.destination'),
        accessorKey: 'cityDestination.name',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.DESTINATION,
            color: BadgeColor.GREEN
        },
        linkHandler: (row) =>
            row.cityDestination?.id
                ? {
                      to: '/destinations/$id',
                      params: { id: row.cityDestination.id }
                  }
                : undefined
    },
    {
        id: 'owner',
        header: t('admin-entities.columns.owner'),
        accessorKey: 'owner.displayName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.USER,
            color: BadgeColor.PINK
        },
        linkHandler: (row) =>
            row.owner?.id
                ? {
                      to: '/access/users/$id',
                      params: { id: row.owner.id }
                  }
                : undefined
    },
    {
        id: 'price',
        header: t('admin-entities.columns.price'),
        accessorKey: 'price',
        enableSorting: true,
        columnType: ColumnType.PRICE,
        align: 'right'
    },
    {
        id: 'averageRating',
        header: t('admin-entities.columns.rating'),
        accessorKey: 'averageRating',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(AccommodationRatingCell, { row })
    },
    {
        id: 'reviewsCount',
        header: t('admin-entities.columns.reviewsCount'),
        accessorKey: 'reviewsCount',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(AccommodationReviewsCell, { row })
    },
    {
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) => createElement(AccommodationFeaturedCell, { row })
    },
    {
        id: 'visibility',
        header: t('admin-entities.columns.visibility'),
        accessorKey: 'visibility',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(AccommodationStateSelectCell, {
                row,
                field: 'visibility',
                successMessageKey: 'admin-entities.messages.visibilityChanged',
                options: VISIBILITY_OPTIONS(t),
                permission: PermissionEnum.ACCOMMODATION_VISIBILITY_CHANGE
            })
    },
    {
        id: 'lifecycleState',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(AccommodationStateSelectCell, {
                row,
                field: 'lifecycleState',
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: LIFECYCLE_OPTIONS(t),
                permission: PermissionEnum.ACCOMMODATION_LIFECYCLE_CHANGE,
                confirmValues: ['ARCHIVED'],
                confirmCopyKey: 'archive'
            })
    },
    {
        id: 'moderationState',
        header: t('admin-entities.columns.moderation'),
        accessorKey: 'moderationState',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(AccommodationStateSelectCell, {
                row,
                field: 'moderationState',
                successMessageKey: 'admin-entities.messages.moderationChanged',
                options: MODERATION_OPTIONS(t),
                permission: PermissionEnum.ACCOMMODATION_MODERATION_CHANGE,
                confirmValues: ['REJECTED'],
                confirmCopyKey: 'reject'
            })
    },
    {
        id: 'createdAt',
        header: t('admin-entities.columns.createdAt'),
        accessorKey: 'createdAt',
        enableSorting: true,
        columnType: ColumnType.TIME_AGO
    }
];
