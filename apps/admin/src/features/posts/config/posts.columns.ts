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
import { BadgeColor, ColumnType, EntityType } from '@/components/table/DataTable';
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
import { PostCategoryBadge } from '../components/PostCategoryBadge';
import { PostSponsorshipCell } from '../components/PostSponsorshipCell';
import { RelatedEntitiesCell } from '../components/RelatedEntitiesCell';
import { POST_STATE_MUTATIONS, useUpdatePostMutation } from '../hooks/usePostQuery';
import type { Post } from '../schemas/posts.schemas';

/**
 * Column configuration for posts list.
 *
 * The optional `options.hasAnalyticsView` flag controls whether the
 * display-only "Vistas (30d)" derived column is included. When absent or
 * false, the column is omitted entirely and no API call is made.
 */
export const createPostsColumns = (
    t: ColumnTFunction,
    options?: CreateColumnsOptions
): readonly ColumnConfig<Post>[] => {
    /** Display-only "Vistas (30d)" column — only included with ANALYTICS_VIEW. */
    const views30dColumn: ColumnConfig<Post> = {
        id: 'views30d',
        header: t('admin-entities.columns.views30d' as TranslationKey),
        accessorKey: 'id',
        enableSorting: false,
        columnType: ColumnType.WIDGET,
        widgetRenderer: (row) =>
            createElement(Views30dCell, {
                entityId: row.id,
                entityType: 'POST'
            })
    };

    const baseColumns: ReadonlyArray<ColumnConfig<Post>> = [
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
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => createElement(PostCategoryBadge, { row })
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
            id: 'relatedEntities',
            header: t('admin-entities.columns.relatedEntities'),
            accessorKey: 'relatedAccommodation',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => createElement(RelatedEntitiesCell, { row }),
            startVisibleOnTable: true,
            startVisibleOnGrid: true
        },
        {
            id: 'sponsorship',
            header: t('admin-entities.columns.sponsorship'),
            accessorKey: 'sponsorship',
            enableSorting: false,
            columnType: ColumnType.WIDGET,
            widgetRenderer: (row) => createElement(PostSponsorshipCell, { row }),
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
                createElement(InlineStateSelectCell<PublishStatePatch>, {
                    entityId: row.id,
                    entityName: row.title,
                    entityLabelKey: 'admin-entities.entities.post.singular',
                    field: 'visibility',
                    currentValue: row.visibility,
                    successMessageKey: 'admin-entities.messages.visibilityChanged',
                    options: CONTENT_VISIBILITY_OPTIONS(t),
                    // POST_PUBLISH_TOGGLE, not POST_VISIBILITY_CHANGE: the
                    // publish-state endpoint gates on the former, so gating the widget
                    // on the latter would show an enabled dropdown that 403s on use.
                    permission: PermissionEnum.POST_PUBLISH_TOGGLE,
                    useUpdateMutation: POST_STATE_MUTATIONS.useSetPublishStateMutation
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
                    entityName: row.title,
                    entityLabelKey: 'admin-entities.entities.post.singular',
                    field: 'lifecycleState',
                    currentValue: row.lifecycleState,
                    successMessageKey: 'admin-entities.messages.stateChanged',
                    options: CONTENT_LIFECYCLE_OPTIONS(t),
                    permission: PermissionEnum.POST_LIFECYCLE_CHANGE,
                    useUpdateMutation: POST_STATE_MUTATIONS.useSetLifecycleStateMutation,
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
                    entityName: row.title,
                    entityLabelKey: 'admin-entities.entities.post.singular',
                    field: 'moderationState',
                    currentValue: row.moderationState,
                    successMessageKey: 'admin-entities.messages.moderationChanged',
                    options: CONTENT_MODERATION_OPTIONS(t),
                    permission: PermissionEnum.POST_MODERATION_CHANGE,
                    useUpdateMutation: POST_STATE_MUTATIONS.useModerateMutation,
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
