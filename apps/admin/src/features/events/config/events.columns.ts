import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { createElement } from 'react';
import { InlineFeaturedCell } from '@/components/entity-list/InlineFeaturedCell';
import { InlineStateSelectCell } from '@/components/entity-list/InlineStateSelectCell';
import type {
    ColumnConfig,
    ColumnTFunction,
    CreateColumnsOptions
} from '@/components/entity-list/types';
import { Views30dCell } from '@/components/entity-list/Views30dCell';
import { BadgeColor, ColumnType, EntityType, ListOrientation } from '@/components/table/DataTable';
import {
    CONTENT_LIFECYCLE_OPTIONS,
    CONTENT_MODERATION_OPTIONS,
    CONTENT_VISIBILITY_OPTIONS
} from '@/features/content/config/content-state-options';
import type {
    LifecycleStatePatch,
    ModerationStatePatch,
    PublishStatePatch
} from '@/features/content/hooks/useContentStateMutations';
import { EventCategoryBadge } from '../components/EventCategoryBadge';
import { EVENT_STATE_MUTATIONS, useUpdateEventMutation } from '../hooks/useEventQuery';
import type { Event } from '../schemas/events.schemas';

/**
 * Column configuration for events list.
 *
 * The optional `options.hasAnalyticsView` flag controls whether the
 * display-only "Vistas (30d)" derived column is included. When absent or
 * false, the column is omitted entirely and no API call is made.
 */
export const createEventsColumns = (
    t: ColumnTFunction,
    options?: CreateColumnsOptions
): readonly ColumnConfig<Event>[] => {
    /** Display-only "Vistas (30d)" column — only included with ANALYTICS_VIEW. */
    const views30dColumn: ColumnConfig<Event> = {
        id: 'views30d',
        header: t('admin-entities.columns.views30d' as TranslationKey),
        accessorKey: 'id',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(Views30dCell, {
                entityId: row.id,
                entityType: 'EVENT'
            })
    };

    const baseColumns: ReadonlyArray<ColumnConfig<Event>> = [
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
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => createElement(EventCategoryBadge, { row })
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
                createElement(InlineStateSelectCell<PublishStatePatch>, {
                    entityId: row.id,
                    entityName: row.name,
                    entityLabelKey: 'admin-entities.entities.event.singular',
                    field: 'visibility',
                    currentValue: row.visibility,
                    successMessageKey: 'admin-entities.messages.visibilityChanged',
                    options: CONTENT_VISIBILITY_OPTIONS(t),
                    // EVENT_PUBLISH_TOGGLE, not EVENT_VISIBILITY_CHANGE: the
                    // publish-state endpoint gates on the former, so gating the widget
                    // on the latter would show an enabled dropdown that 403s on use.
                    permission: PermissionEnum.EVENT_PUBLISH_TOGGLE,
                    useUpdateMutation: EVENT_STATE_MUTATIONS.useSetPublishStateMutation
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
                createElement(InlineStateSelectCell<LifecycleStatePatch>, {
                    entityId: row.id,
                    entityName: row.name,
                    entityLabelKey: 'admin-entities.entities.event.singular',
                    field: 'lifecycleState',
                    currentValue: row.lifecycleState,
                    successMessageKey: 'admin-entities.messages.stateChanged',
                    options: CONTENT_LIFECYCLE_OPTIONS(t),
                    permission: PermissionEnum.EVENT_LIFECYCLE_CHANGE,
                    useUpdateMutation: EVENT_STATE_MUTATIONS.useSetLifecycleStateMutation,
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
                createElement(InlineStateSelectCell<ModerationStatePatch>, {
                    entityId: row.id,
                    entityName: row.name,
                    entityLabelKey: 'admin-entities.entities.event.singular',
                    field: 'moderationState',
                    currentValue: row.moderationState,
                    successMessageKey: 'admin-entities.messages.moderationChanged',
                    options: CONTENT_MODERATION_OPTIONS(t),
                    permission: PermissionEnum.EVENT_MODERATION_CHANGE,
                    useUpdateMutation: EVENT_STATE_MUTATIONS.useModerateMutation,
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

    return options?.hasAnalyticsView ? [...baseColumns, views30dColumn] : baseColumns;
};
