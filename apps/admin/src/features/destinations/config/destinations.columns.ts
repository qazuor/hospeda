import { InlineFeaturedCell } from '@/components/entity-list/InlineFeaturedCell';
import {
    type InlineStateOption,
    InlineStateSelectCell
} from '@/components/entity-list/InlineStateSelectCell';
import { ReviewsCell } from '@/components/entity-list/ReviewsCell';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType, ListOrientation } from '@/components/table/DataTable';
import { PermissionEnum } from '@repo/schemas';
import { createElement } from 'react';
import { useUpdateDestinationMutation } from '../hooks/useDestinationQuery';
import type { Destination } from '../schemas/destinations.schemas';

/**
 * Visibility options (value + localized label + badge color). Single source for
 * both the read-only badge fallback and the inline-edit dropdown.
 */
const VISIBILITY_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
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
        value: 'HIDDEN',
        label: t('admin-entities.states.visibility.hidden'),
        color: BadgeColor.PINK
    }
];

/**
 * Lifecycle-state options. ARCHIVED is the destructive transition. DELETED is
 * intentionally excluded from the editable set — soft-deletion happens via the
 * dedicated delete action, not this dropdown.
 */
const LIFECYCLE_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
    {
        value: 'ACTIVE',
        label: t('admin-entities.states.lifecycle.active'),
        color: BadgeColor.GREEN
    },
    {
        value: 'INACTIVE',
        label: t('admin-entities.states.lifecycle.inactive'),
        color: BadgeColor.GRAY
    },
    {
        value: 'ARCHIVED',
        label: t('admin-entities.states.lifecycle.archived'),
        color: BadgeColor.ORANGE
    }
];

/** Moderation-state options. REJECTED is the destructive transition. */
const MODERATION_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
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
    },
    {
        value: 'UNDER_REVIEW',
        label: t('admin-entities.states.moderation.underReview'),
        color: BadgeColor.BLUE
    }
];

/**
 * Column configuration for destinations list
 */
export const createDestinationsColumns = (
    t: ColumnTFunction
): readonly ColumnConfig<Destination>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.DESTINATION,
            color: BadgeColor.GREEN
        },
        linkHandler: (row) => ({
            to: '/destinations/$id',
            params: { id: row.id }
        })
    },
    {
        id: 'accommodationsCount',
        header: t('admin-entities.columns.accommodationsCount'),
        accessorKey: 'accommodationsCount',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'featuredImage',
        header: t('admin-entities.columns.featuredImage'),
        accessorKey: 'media.featuredImage',
        enableSorting: false,
        columnType: ColumnType.IMAGE,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'gallery',
        header: t('admin-entities.columns.gallery'),
        accessorKey: 'media.gallery',
        enableSorting: false,
        columnType: ColumnType.GALLERY,
        startVisibleOnTable: false,
        startVisibleOnGrid: true
    },
    {
        id: 'attractions',
        header: t('admin-entities.columns.attractions'),
        accessorKey: 'attractions',
        enableSorting: false,
        columnType: ColumnType.LIST,
        listSeparator: ' • ',
        listOrientation: ListOrientation.COLUMN
    },
    {
        id: 'averageRating',
        header: t('admin-entities.columns.rating'),
        accessorKey: 'averageRating',
        enableSorting: true,
        columnType: ColumnType.NUMBER
    },
    {
        id: 'reviewsCount',
        header: t('admin-entities.columns.reviewsCount'),
        accessorKey: 'reviewsCount',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(ReviewsCell, {
                entityId: row.id,
                entityName: row.name,
                count: typeof row.reviewsCount === 'number' ? row.reviewsCount : 0,
                reviewsPath: '/api/v1/admin/destinations/reviews',
                idParamName: 'destinationId',
                queryKeyPrefix: 'destination-reviews'
            })
    },
    {
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineFeaturedCell, {
                entityId: row.id,
                entityName: row.name,
                entityLabelKey: 'admin-entities.entities.destination.singular',
                checked: Boolean(row.isFeatured),
                permission: PermissionEnum.DESTINATION_FEATURED_TOGGLE,
                useUpdateMutation: useUpdateDestinationMutation
            })
    },
    {
        id: 'visibility',
        header: t('admin-entities.columns.visibility'),
        accessorKey: 'visibility',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell, {
                entityId: row.id,
                entityName: row.name,
                entityLabelKey: 'admin-entities.entities.destination.singular',
                field: 'visibility',
                currentValue: row.visibility,
                successMessageKey: 'admin-entities.messages.visibilityChanged',
                options: VISIBILITY_OPTIONS(t),
                permission: PermissionEnum.DESTINATION_VISIBILITY_TOGGLE,
                useUpdateMutation: useUpdateDestinationMutation
            })
    },
    {
        id: 'lifecycleState',
        header: t('admin-entities.columns.status'),
        accessorKey: 'lifecycleState',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        startVisibleOnTable: false,
        startVisibleOnGrid: true,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell, {
                entityId: row.id,
                entityName: row.name,
                entityLabelKey: 'admin-entities.entities.destination.singular',
                field: 'lifecycleState',
                currentValue: row.lifecycleState,
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: LIFECYCLE_OPTIONS(t),
                permission: PermissionEnum.DESTINATION_LIFECYCLE_CHANGE,
                useUpdateMutation: useUpdateDestinationMutation,
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
        startVisibleOnTable: false,
        startVisibleOnGrid: false,
        widgetRenderer: (row) =>
            createElement(InlineStateSelectCell, {
                entityId: row.id,
                entityName: row.name,
                entityLabelKey: 'admin-entities.entities.destination.singular',
                field: 'moderationState',
                currentValue: row.moderationState,
                successMessageKey: 'admin-entities.messages.moderationChanged',
                options: MODERATION_OPTIONS(t),
                permission: PermissionEnum.DESTINATION_MODERATION_CHANGE,
                useUpdateMutation: useUpdateDestinationMutation,
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
