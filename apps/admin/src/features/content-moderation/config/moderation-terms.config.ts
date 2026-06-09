import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { type ContentModerationTerm, contentModerationTermSchema } from '@repo/schemas';
import type { z } from 'zod';
import { createModerationTermColumns } from './moderation-terms.columns';

/**
 * Configuration for moderation terms entity list.
 */
export const moderationTermsConfig: EntityConfig<ContentModerationTerm> = {
    name: 'moderation-terms',
    entityKey: 'contentModerationTerm',
    // TODO: add EntityType.MODERATION_TERM when the enum is extended; TAG is the closest lightweight analog
    entityType: EntityType.TAG,

    apiEndpoint: '/api/v1/admin/content-moderation/terms',

    filterBarConfig: {
        filters: [
            {
                paramKey: 'kind',
                labelKey: 'content-moderation.terms.fields.kind',
                type: 'select',
                order: 1,
                options: [
                    {
                        value: 'word',
                        labelKey: 'content-moderation.terms.kinds.word'
                    },
                    {
                        value: 'domain',
                        labelKey: 'content-moderation.terms.kinds.domain'
                    }
                ]
            },
            {
                paramKey: 'category',
                labelKey: 'content-moderation.terms.fields.category',
                type: 'select',
                order: 2,
                options: [
                    {
                        value: 'hate',
                        labelKey: 'content-moderation.categories.hate'
                    },
                    {
                        value: 'sexual',
                        labelKey: 'content-moderation.categories.sexual'
                    },
                    {
                        value: 'violence',
                        labelKey: 'content-moderation.categories.violence'
                    },
                    {
                        value: 'harassment',
                        labelKey: 'content-moderation.categories.harassment'
                    },
                    {
                        value: 'self_harm',
                        labelKey: 'content-moderation.categories.self_harm'
                    },
                    {
                        value: 'spam',
                        labelKey: 'content-moderation.categories.spam'
                    },
                    {
                        value: 'other',
                        labelKey: 'content-moderation.categories.other'
                    }
                ]
            },
            {
                paramKey: 'enabled',
                labelKey: 'content-moderation.terms.fields.enabled',
                type: 'boolean',
                order: 3
            },
            {
                paramKey: 'includeDeleted',
                labelKey: 'admin-filters.includeDeleted.label',
                type: 'boolean',
                order: 99
            }
        ]
    },

    basePath: '/content/moderation-terms',
    detailPath: '/content/moderation-terms/[id]',

    // TYPE-WORKAROUND: contentModerationTermSchema is a ZodObject but list config expects a ZodSchema<ContentModerationTerm>; narrowed at runtime
    listItemSchema: contentModerationTermSchema as unknown as z.ZodSchema<ContentModerationTerm>,

    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        enabled: true
    },

    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 8,
            columns: { mobile: 1, tablet: 2, desktop: 3 }
        }
    },

    paginationConfig: {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 50]
    },

    defaultSort: { id: 'term', desc: false },

    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/content/moderation-terms/new'
    },

    createColumns: (t) => createModerationTermColumns(t as (key: string) => string),

    peekFields: [
        {
            accessorKey: 'id',
            labelKey: 'admin-entities.columns.id',
            format: 'text'
        },
        {
            accessorKey: 'term',
            labelKey: 'content-moderation.terms.fields.term',
            format: 'text'
        },
        {
            accessorKey: 'kind',
            labelKey: 'content-moderation.terms.fields.kind',
            format: 'badge'
        },
        {
            accessorKey: 'category',
            labelKey: 'content-moderation.terms.fields.category',
            format: 'badge'
        },
        {
            accessorKey: 'severity',
            labelKey: 'content-moderation.terms.fields.severity',
            format: 'text'
        },
        {
            accessorKey: 'enabled',
            labelKey: 'content-moderation.terms.fields.enabled',
            format: 'badge'
        },
        {
            accessorKey: 'createdAt',
            labelKey: 'admin-entities.columns.createdAt',
            format: 'date'
        }
    ],
    peekSubtitleField: 'term'
};

const { component, route } = createEntityListPage(moderationTermsConfig);

export { component as ModerationTermsPageComponent, route as ModerationTermsRoute };
