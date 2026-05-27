import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { BadgeColor, EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Post, PostListItemWithComputedFieldsSchema } from '../schemas/posts.schemas';
import { createPostsColumns } from './posts.columns';

/**
 * Configuration for posts entity list
 */
export const postsConfig: EntityConfig<Post> = {
    name: 'posts',
    entityKey: 'post',
    entityType: EntityType.POST,

    // API
    apiEndpoint: '/api/v1/admin/posts',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'status',
                labelKey: 'admin-filters.status.label',
                type: 'select',
                order: 1,
                options: [
                    { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
                    { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
                    { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' }
                ]
            },
            {
                paramKey: 'category',
                labelKey: 'admin-filters.postCategory.label',
                type: 'select',
                order: 2,
                options: [
                    { value: 'EVENTS', labelKey: 'admin-filters.postCategory.events' },
                    { value: 'CULTURE', labelKey: 'admin-filters.postCategory.culture' },
                    { value: 'GASTRONOMY', labelKey: 'admin-filters.postCategory.gastronomy' },
                    { value: 'NATURE', labelKey: 'admin-filters.postCategory.nature' },
                    { value: 'TOURISM', labelKey: 'admin-filters.postCategory.tourism' },
                    { value: 'GENERAL', labelKey: 'admin-filters.postCategory.general' },
                    { value: 'SPORT', labelKey: 'admin-filters.postCategory.sport' },
                    { value: 'CARNIVAL', labelKey: 'admin-filters.postCategory.carnival' },
                    { value: 'NIGHTLIFE', labelKey: 'admin-filters.postCategory.nightlife' },
                    { value: 'HISTORY', labelKey: 'admin-filters.postCategory.history' },
                    { value: 'TRADITIONS', labelKey: 'admin-filters.postCategory.traditions' },
                    { value: 'WELLNESS', labelKey: 'admin-filters.postCategory.wellness' },
                    { value: 'FAMILY', labelKey: 'admin-filters.postCategory.family' },
                    { value: 'TIPS', labelKey: 'admin-filters.postCategory.tips' },
                    { value: 'ART', labelKey: 'admin-filters.postCategory.art' },
                    { value: 'BEACH', labelKey: 'admin-filters.postCategory.beach' },
                    { value: 'RURAL', labelKey: 'admin-filters.postCategory.rural' },
                    { value: 'FESTIVALS', labelKey: 'admin-filters.postCategory.festivals' }
                ]
            },
            {
                paramKey: 'isFeatured',
                labelKey: 'admin-filters.isFeatured.label',
                type: 'boolean',
                order: 3
            },
            {
                paramKey: 'isNews',
                labelKey: 'admin-filters.isNews.label',
                type: 'boolean',
                order: 4
            },
            {
                paramKey: 'includeDeleted',
                labelKey: 'admin-filters.includeDeleted.label',
                type: 'boolean',
                order: 99
            }
        ]
    },

    // Routes
    basePath: '/posts',
    detailPath: '/posts/[id]',

    // Schemas
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Post>, but PostListItemWithComputedFieldsSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: PostListItemWithComputedFieldsSchema as unknown as z.ZodSchema<Post>,

    // Search configuration
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
        enabled: true
    },

    // View configuration
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 12,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination configuration
    paginationConfig: {
        defaultPageSize: 15,
        allowedPageSizes: [10, 15, 30, 50]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/posts/new'
    },

    // Columns
    createColumns: createPostsColumns,

    /**
     * Curated peek drawer fields for posts.
     *
     * `category` has a matching badge column and its badgeOptions are resolved
     * automatically. `lifecycleState`, `visibility`, and `moderationState` do
     * NOT have badge columns in posts.columns.ts so badgeOptions are declared
     * inline to ensure colored rendering in the drawer.
     *
     * Only fields present on the PostListItemWithComputedFieldsSchema are used.
     * Field order follows the product-owner specification exactly.
     */
    peekFields: [
        { accessorKey: 'id', labelKey: 'admin-entities.columns.id', format: 'text' },
        {
            accessorKey: 'category',
            labelKey: 'admin-entities.columns.category',
            format: 'badge'
        },
        {
            accessorKey: 'visibility',
            labelKey: 'admin-entities.columns.visibility',
            format: 'badge',
            badgeOptions: [
                { value: 'PUBLIC', label: 'Público', color: BadgeColor.PURPLE },
                { value: 'PRIVATE', label: 'Privado', color: BadgeColor.CYAN },
                { value: 'HIDDEN', label: 'Oculto', color: BadgeColor.PINK }
            ]
        },
        {
            accessorKey: 'lifecycleState',
            labelKey: 'admin-entities.columns.status',
            format: 'badge',
            badgeOptions: [
                { value: 'DRAFT', label: 'Borrador', color: BadgeColor.GRAY },
                { value: 'ACTIVE', label: 'Activo', color: BadgeColor.CYAN },
                { value: 'INACTIVE', label: 'Inactivo', color: BadgeColor.PURPLE },
                { value: 'ARCHIVED', label: 'Archivado', color: BadgeColor.PINK }
            ]
        },
        {
            accessorKey: 'moderationState',
            labelKey: 'admin-entities.columns.moderation',
            format: 'badge',
            badgeOptions: [
                { value: 'PENDING', label: 'Pendiente', color: BadgeColor.PINK },
                { value: 'APPROVED', label: 'Aprobado', color: BadgeColor.CYAN },
                { value: 'REJECTED', label: 'Rechazado', color: BadgeColor.PURPLE },
                { value: 'UNDER_REVIEW', label: 'En revisión', color: BadgeColor.GREEN }
            ]
        },
        {
            accessorKey: 'isNews',
            labelKey: 'admin-entities.columns.isNews',
            format: 'boolean'
        },
        {
            accessorKey: 'isFeaturedInWebsite',
            labelKey: 'admin-entities.columns.featuredInWebsite',
            format: 'boolean'
        },
        {
            accessorKey: 'summary',
            labelKey: 'admin-entities.columns.summary',
            format: 'text',
            maxLength: 300
        },
        {
            accessorKey: 'authorName',
            labelKey: 'admin-entities.columns.author',
            format: 'text'
        },
        {
            accessorKey: 'destinationName',
            labelKey: 'admin-entities.columns.relatedDestination',
            format: 'text'
        },
        {
            accessorKey: 'eventName',
            labelKey: 'admin-entities.columns.relatedEvent',
            format: 'text'
        },
        {
            accessorKey: 'accommodationName',
            labelKey: 'admin-entities.columns.relatedAccommodation',
            format: 'text'
        },
        {
            accessorKey: 'sponsorName',
            labelKey: 'admin-entities.columns.sponsor',
            format: 'text'
        },
        {
            accessorKey: 'publishedAt',
            labelKey: 'admin-entities.columns.publishedAt',
            format: 'date'
        },
        {
            accessorKey: 'expiresAt',
            labelKey: 'admin-entities.columns.expiresAt',
            format: 'date'
        },
        {
            accessorKey: 'createdAt',
            labelKey: 'admin-entities.columns.createdAt',
            format: 'date'
        },
        {
            accessorKey: 'updatedAt',
            labelKey: 'admin-entities.columns.updatedAt',
            format: 'date'
        },
        {
            accessorKey: 'media.featuredImage.url',
            labelKey: 'admin-entities.columns.featuredImage',
            format: 'image'
        },
        { accessorKey: 'likes', labelKey: 'admin-entities.columns.likes', format: 'text' },
        {
            accessorKey: 'comments',
            labelKey: 'admin-entities.columns.comments',
            format: 'text'
        },
        {
            accessorKey: 'shares',
            labelKey: 'admin-entities.columns.shares',
            format: 'text'
        },
        { accessorKey: 'tags', labelKey: 'admin-entities.columns.tags', format: 'list' }
    ],
    // Header extras: slug as subtitle, isFeatured as a chip next to the title.
    peekSubtitleField: 'slug',
    peekFeaturedField: 'isFeatured'
};

const { component, route } = createEntityListPage(postsConfig);
export { component as PostsPageComponent, route as PostsRoute };
