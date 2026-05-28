import { InlineFeaturedCell } from '@/components/entity-list/InlineFeaturedCell';
import {
    type InlineStateOption,
    InlineStateSelectCell
} from '@/components/entity-list/InlineStateSelectCell';
import type { ColumnConfig, ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor, ColumnType, EntityType, ListOrientation } from '@/components/table/DataTable';
import { PermissionEnum } from '@repo/schemas';
import { createElement } from 'react';
import { useUpdateEventMutation } from '../hooks/useEventQuery';
import type { Event } from '../schemas/events.schemas';

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

export const createEventsColumns = (t: ColumnTFunction): readonly ColumnConfig<Event>[] => [
    {
        id: 'name',
        header: t('admin-entities.columns.name'),
        accessorKey: 'name',
        enableSorting: true,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.EVENT,
            color: BadgeColor.ORANGE
        },
        linkHandler: (row) => ({
            to: '/events/$id',
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
                value: 'CULTURE',
                label: t('admin-entities.types.event.culture'),
                color: BadgeColor.YELLOW
            },
            {
                value: 'SPORTS',
                label: t('admin-entities.types.event.sports'),
                color: BadgeColor.ORANGE
            },
            {
                value: 'FESTIVAL',
                label: t('admin-entities.types.event.festival'),
                color: BadgeColor.PURPLE
            },
            {
                value: 'WORKSHOP',
                label: t('admin-entities.types.event.workshop'),
                color: BadgeColor.CYAN
            },
            {
                value: 'MUSIC',
                label: t('admin-entities.types.event.music'),
                color: BadgeColor.BLUE
            },
            {
                value: 'GASTRONOMY',
                label: t('admin-entities.types.event.gastronomy'),
                color: BadgeColor.PINK
            },
            {
                value: 'NATURE',
                label: t('admin-entities.types.event.nature'),
                color: BadgeColor.GREEN
            },
            {
                value: 'OTHER',
                label: t('admin-entities.types.event.other'),
                color: BadgeColor.GRAY
            }
        ]
    },
    {
        id: 'organizer',
        header: t('admin-entities.columns.organizer'),
        accessorKey: 'organizer.name',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.EVENT_ORGANIZER,
            color: BadgeColor.PURPLE
        },
        linkHandler: (row) =>
            row.organizer?.id
                ? {
                      to: '/events/organizers/$id',
                      params: { id: row.organizer.id }
                  }
                : undefined
    },
    {
        id: 'startDate',
        header: t('admin-entities.columns.startDate'),
        accessorKey: 'date.start',
        enableSorting: true,
        columnType: ColumnType.DATE
    },
    {
        id: 'location',
        header: t('admin-entities.columns.location'),
        accessorKey: 'location.placeName',
        enableSorting: false,
        columnType: ColumnType.ENTITY,
        entityOptions: {
            entityType: EntityType.EVENT_LOCATION,
            color: BadgeColor.CYAN
        },
        linkHandler: (row) =>
            row.location?.id
                ? {
                      to: '/events/locations/$id',
                      params: { id: row.location.id }
                  }
                : undefined
    },
    {
        id: 'ticketPrice',
        header: t('admin-entities.columns.price'),
        accessorKey: 'pricing',
        enableSorting: true,
        columnType: ColumnType.PRICE,
        align: 'right'
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
        id: 'tags',
        header: t('admin-entities.columns.tags'),
        accessorKey: 'tags',
        enableSorting: false,
        columnType: ColumnType.LIST,
        listSeparator: ' • ',
        listOrientation: ListOrientation.ROW,
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
                entityName: row.name,
                entityLabelKey: 'admin-entities.entities.event.singular',
                checked: Boolean(row.isFeatured),
                permission: PermissionEnum.EVENT_FEATURED_TOGGLE,
                useUpdateMutation: useUpdateEventMutation
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
                entityLabelKey: 'admin-entities.entities.event.singular',
                field: 'visibility',
                currentValue: row.visibility,
                successMessageKey: 'admin-entities.messages.visibilityChanged',
                options: VISIBILITY_OPTIONS(t),
                permission: PermissionEnum.EVENT_VISIBILITY_CHANGE,
                useUpdateMutation: useUpdateEventMutation
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
                entityLabelKey: 'admin-entities.entities.event.singular',
                field: 'lifecycleState',
                currentValue: row.lifecycleState,
                successMessageKey: 'admin-entities.messages.stateChanged',
                options: LIFECYCLE_OPTIONS(t),
                permission: PermissionEnum.EVENT_LIFECYCLE_CHANGE,
                useUpdateMutation: useUpdateEventMutation,
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
                entityLabelKey: 'admin-entities.entities.event.singular',
                field: 'moderationState',
                currentValue: row.moderationState,
                successMessageKey: 'admin-entities.messages.moderationChanged',
                options: MODERATION_OPTIONS(t),
                permission: PermissionEnum.EVENT_MODERATION_CHANGE,
                useUpdateMutation: useUpdateEventMutation,
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
