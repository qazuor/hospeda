import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { TranslationKey } from '@repo/i18n';
import { type ContentModerationTerm, contentModerationTermSchema } from '@repo/schemas';
import type { z } from 'zod';
import { createModerationTermColumns } from './moderation-terms.columns';

/**
 * Configuration for moderation terms entity list.
 */
export const moderationTermsConfig: EntityConfig<ContentModerationTerm> = {
    name: 'moderation-terms',
    entityKey: 'contentModerationTerm',
    entityType: EntityType.ACCOMMODATION,

    apiEndpoint: '/api/v1/admin/content-moderation/terms',

    filterBarConfig: {
        filters: [
            {
                paramKey: 'kind',
                labelKey: 'content-moderation.terms.fields.kind' as TranslationKey,
                type: 'select',
                order: 1,
                options: [
                    {
                        value: 'word',
                        labelKey: 'content-moderation.terms.kinds.word' as TranslationKey
                    },
                    {
                        value: 'domain',
                        labelKey: 'content-moderation.terms.kinds.domain' as TranslationKey
                    }
                ]
            },
            {
                paramKey: 'category',
                labelKey: 'content-moderation.terms.fields.category' as TranslationKey,
                type: 'select',
                order: 2,
                options: [
                    {
                        value: 'hate',
                        labelKey: 'content-moderation.categories.hate' as TranslationKey
                    },
                    {
                        value: 'sexual',
                        labelKey: 'content-moderation.categories.sexual' as TranslationKey
                    },
                    {
                        value: 'violence',
                        labelKey: 'content-moderation.categories.violence' as TranslationKey
                    },
                    {
                        value: 'harassment',
                        labelKey: 'content-moderation.categories.harassment' as TranslationKey
                    },
                    {
                        value: 'self_harm',
                        labelKey: 'content-moderation.categories.self_harm' as TranslationKey
                    },
                    {
                        value: 'spam',
                        labelKey: 'content-moderation.categories.spam' as TranslationKey
                    },
                    {
                        value: 'other',
                        labelKey: 'content-moderation.categories.other' as TranslationKey
                    }
                ]
            },
            {
                paramKey: 'enabled',
                labelKey: 'content-moderation.terms.fields.enabled' as TranslationKey,
                type: 'boolean',
                order: 3
            },
            {
                paramKey: 'includeDeleted',
                labelKey: 'admin-filters.includeDeleted.label' as TranslationKey,
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
            labelKey: 'admin-entities.columns.id' as TranslationKey,
            format: 'text'
        },
        {
            accessorKey: 'term',
            labelKey: 'content-moderation.terms.fields.term' as TranslationKey,
            format: 'text'
        },
        {
            accessorKey: 'kind',
            labelKey: 'content-moderation.terms.fields.kind' as TranslationKey,
            format: 'badge'
        },
        {
            accessorKey: 'category',
            labelKey: 'content-moderation.terms.fields.category' as TranslationKey,
            format: 'badge'
        },
        {
            accessorKey: 'severity',
            labelKey: 'content-moderation.terms.fields.severity' as TranslationKey,
            format: 'text'
        },
        {
            accessorKey: 'enabled',
            labelKey: 'content-moderation.terms.fields.enabled' as TranslationKey,
            format: 'badge'
        },
        {
            accessorKey: 'createdAt',
            labelKey: 'admin-entities.columns.createdAt' as TranslationKey,
            format: 'date'
        }
    ],
    peekSubtitleField: 'term'
};

const { component, route } = createEntityListPage(moderationTermsConfig);

export { component as ModerationTermsPageComponent, route as ModerationTermsRoute };
