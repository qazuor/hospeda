import { InlineFeaturedCell } from '@/components/entity-list/InlineFeaturedCell';
import {
    type InlineStateOption,
    InlineStateSelectCell
} from '@/components/entity-list/InlineStateSelectCell';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
import { PermissionEnum } from '@repo/schemas';
import { createElement } from 'react';
import { useUpdatePostMutation } from '../hooks/usePostQuery';
import type { Post } from '../schemas/posts.schemas';

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
        value: 'RESTRICTED',
        label: t('admin-entities.states.visibility.restricted'),
        color: BadgeColor.PINK
    }
];

/** Lifecycle-state options. ARCHIVED is the destructive transition. */
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
    }
];

export const createPostsColumns = (t: ColumnTFunction): readonly ColumnConfig<Post>[] => [
    {
        id: 'title',
        header: t('admin-entities.columns.title'),
        accessorKey: 'title',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.POST,
            color: BadgeColor.INDIGO
        },
        linkHandler: (row) => ({
            to: '/posts/$id',
            params: { id: row.id }
        })
    },
    {
        id: 'category',
        header: t('admin-entities.columns.category'),
        accessorKey: 'category',
        enableSorting: true,
        columnType: ColumnType.BADGE,
        badgeOptions: [
            {
                value: 'EVENTS',
                label: t('admin-entities.types.postCategory.events'),
                color: BadgeColor.BLUE
            },
            {
                value: 'CULTURE',
                label: t('admin-entities.types.postCategory.culture'),
                color: BadgeColor.RED
            },
            {
                value: 'GASTRONOMY',
                label: t('admin-entities.types.postCategory.gastronomy'),
                color: BadgeColor.GREEN
            },
            {
                value: 'NATURE',
                label: t('admin-entities.types.postCategory.nature'),
                color: BadgeColor.YELLOW
            },
            {
                value: 'TOURISM',
                label: t('admin-entities.types.postCategory.tourism'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'GENERAL',
                label: t('admin-entities.types.postCategory.general'),
                color: BadgeColor.PINK
            },
            {
                value: 'SPORT',
                label: t('admin-entities.types.postCategory.sport'),
                color: BadgeColor.INDIGO
            },
            {
                value: 'CARNIVAL',
                label: t('admin-entities.types.postCategory.carnival'),
                color: BadgeColor.CYAN
            },
            {
                value: 'NIGHTLIFE',
                label: t('admin-entities.types.postCategory.nightlife'),
                color: BadgeColor.TEAL
            },
            {
                value: 'HISTORY',
                label: t('admin-entities.types.postCategory.history'),
                color: BadgeColor.ORANGE
            },
            {
                value: 'TRADITIONS',
                label: t('admin-entities.types.postCategory.traditions'),
                color: BadgeColor.GRAY
            },
            {
                value: 'WELLNESS',
                label: t('admin-entities.types.postCategory.wellness'),
                color: BadgeColor.SLATE
            },
            {
                value: 'FAMILY',
                label: t('admin-entities.types.postCategory.family'),
                color: BadgeColor.BLUE
            },
            {
                value: 'TIPS',
                label: t('admin-entities.types.postCategory.tips'),
                color: BadgeColor.RED
            },
            {
                value: 'ART',
                label: t('admin-entities.types.postCategory.art'),
                color: BadgeColor.GREEN
            },
            {
                value: 'BEACH',
                label: t('admin-entities.types.postCategory.beach'),
                color: BadgeColor.YELLOW
            },
            {
                value: 'RURAL',
                label: t('admin-entities.types.postCategory.rural'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'FESTIVALS',
                label: t('admin-entities.types.postCategory.festivals'),
                color: BadgeColor.PINK
            }
        ]
    },
    {
        id: 'author',
        header: t('admin-entities.columns.author'),
        accessorKey: 'authorName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.USER,
            color: BadgeColor.PINK
        },
        linkHandler: (row) =>
            row.author?.id
                ? {
                      to: '/access/users/$id',
                      params: { id: row.author.id }
                  }
                : undefined
    },
    {
        id: 'relatedAccommodation',
        header: t('admin-entities.columns.relatedAccommodation'),
        accessorKey: 'accommodationName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.ACCOMMODATION,
            color: BadgeColor.BLUE
        },
        linkHandler: (row) =>
            row.relatedAccommodation?.id
                ? {
                      to: '/accommodations/$id',
                      params: { id: row.relatedAccommodation.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    {
        id: 'relatedDestination',
        header: t('admin-entities.columns.relatedDestination'),
        accessorKey: 'destinationName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.DESTINATION,
            color: BadgeColor.GREEN
        },
        linkHandler: (row) =>
            row.relatedDestination?.id
                ? {
                      to: '/destinations/$id',
                      params: { id: row.relatedDestination.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    {
        id: 'relatedEvent',
        header: t('admin-entities.columns.relatedEvent'),
        accessorKey: 'eventName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.EVENT,
            color: BadgeColor.ORANGE
        },
        linkHandler: (row) =>
            row.relatedEvent?.id
                ? {
                      to: '/events/$id',
                      params: { id: row.relatedEvent.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    {
        id: 'sponsorship',
        header: t('admin-entities.columns.sponsorship'),
        accessorKey: 'sponsorshipInfo',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.SPONSORSHIP,
            color: BadgeColor.PURPLE
        },
        linkHandler: (row) =>
            row.sponsorship?.id
                ? {
                      to: '/sponsorships/$id',
                      params: { id: row.sponsorship.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    {
        id: 'sponsor',
        header: t('admin-entities.columns.sponsor'),
        accessorKey: 'sponsorName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.SPONSOR,
            color: BadgeColor.ORANGE
        },
        linkHandler: (row) =>
            row.sponsorship?.sponsor?.id
                ? {
                      to: '/sponsors/$id',
                      params: { id: row.sponsorship.sponsor.id }
                  }
                : undefined,
        startVisibleOnTable: true,
        startVisibleOnGrid: true
    },
    {
        id: 'publishedAt',
        header: t('admin-entities.columns.published'),
        accessorKey: 'publishedAt',
        enableSorting: true,
        columnType: ColumnType.DATE
    },
    {
        id: 'readingTimeMinutes',
        header: t('admin-entities.columns.readingTime'),
        accessorKey: 'readingTimeMinutes',
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
        id: 'isFeatured',
        header: t('admin-entities.columns.featured'),
        accessorKey: 'isFeatured',
        enableSorting: true,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(InlineFeaturedCell, {
                entityId: row.id,
                entityName: row.title,
                entityLabelKey: 'admin-entities.entities.post.singular',
                checked: Boolean(row.isFeatured),
                permission: PermissionEnum.POST_FEATURED_TOGGLE,
                useUpdateMutation: useUpdatePostMutation
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
                entityName: row.title,
                entityLabelKey: 'admin-entities.entities.post.singular',
                field: 'visibility',
                currentValue: row.visibility,
                successMessageKey: 'admin-entities.messages.visibilityChanged',
                options: VISIBILITY_OPTIONS(t),
                permission: PermissionEnum.POST_VISIBILITY_CHANGE,
                useUpdateMutation: useUpdatePostMutation
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
                entityName: row.title,
                entityLabelKey: 'admin-entities.entities.post.singular',
                field: 'lifecycleState',
                currentValue: row.lifecycleState,
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: LIFECYCLE_OPTIONS(t),
                permission: PermissionEnum.POST_LIFECYCLE_CHANGE,
                useUpdateMutation: useUpdatePostMutation,
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
                entityName: row.title,
                entityLabelKey: 'admin-entities.entities.post.singular',
                field: 'moderationState',
                currentValue: row.moderationState,
                successMessageKey: 'admin-entities.messages.moderationChanged',
                options: MODERATION_OPTIONS(t),
                permission: PermissionEnum.POST_MODERATION_CHANGE,
                useUpdateMutation: useUpdatePostMutation,
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
