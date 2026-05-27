import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { BadgeColor, EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Destination, DestinationListItemSchema } from '../schemas/destinations.schemas';
import { createDestinationsColumns } from './destinations.columns';

/**
 * Configuration for destinations entity list
 */
export const destinationsConfig: EntityConfig<Destination> = {
    // Metadata
    name: 'destinations',
    entityKey: 'destination',
    entityType: EntityType.DESTINATION,

    // API
    apiEndpoint: '/api/v1/admin/destinations',

    // Filter bar configuration (defaultValue: 'CITY' on destinationType replaces legacy defaultFilters)
    filterBarConfig: {
        filters: [
            {
                paramKey: 'destinationType',
                labelKey: 'admin-filters.destinationType.label',
                type: 'select',
                defaultValue: 'CITY',
                order: 1,
                options: [
                    { value: 'COUNTRY', labelKey: 'admin-filters.destinationType.country' },
                    { value: 'REGION', labelKey: 'admin-filters.destinationType.region' },
                    { value: 'PROVINCE', labelKey: 'admin-filters.destinationType.province' },
                    { value: 'DEPARTMENT', labelKey: 'admin-filters.destinationType.department' },
                    { value: 'CITY', labelKey: 'admin-filters.destinationType.city' },
                    { value: 'TOWN', labelKey: 'admin-filters.destinationType.town' },
                    {
                        value: 'NEIGHBORHOOD',
                        labelKey: 'admin-filters.destinationType.neighborhood'
                    }
                ]
            },
            {
                paramKey: 'status',
                labelKey: 'admin-filters.status.label',
                type: 'select',
                order: 2,
                options: [
                    { value: 'DRAFT', labelKey: 'admin-filters.status.draft' },
                    { value: 'ACTIVE', labelKey: 'admin-filters.status.active' },
                    { value: 'ARCHIVED', labelKey: 'admin-filters.status.archived' }
                ]
            },
            {
                paramKey: 'isFeatured',
                labelKey: 'admin-filters.isFeatured.label',
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

    // Routes
    basePath: '/destinations',
    detailPath: '/destinations/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Destination>, but DestinationListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: DestinationListItemSchema as unknown as z.ZodSchema<Destination>,

    // Search configuration
    searchConfig: {
        minChars: 5,
        debounceMs: 500,
        enabled: true
    },

    // View configuration
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 10,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination configuration
    paginationConfig: {
        defaultPageSize: 10,
        allowedPageSizes: [10, 20, 30, 50]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/destinations/new'
    },

    // Columns
    createColumns: createDestinationsColumns,

    /**
     * Curated peek drawer fields for destinations.
     *
     * Badge fields that match an existing badge column (visibility, lifecycleState,
     * moderationState) rely on automatic badgeOptions lookup from the column config.
     * `destinationType` has no badge column so its badgeOptions are declared inline.
     *
     * Only fields present on the DestinationListItemSchema (admin-extended) are used.
     * Field order follows the product-owner specification exactly.
     */
    peekFields: [
        { accessorKey: 'id', labelKey: 'admin-entities.columns.id', format: 'text' },
        {
            accessorKey: 'destinationType',
            labelKey: 'admin-entities.columns.type',
            format: 'badge',
            badgeOptions: [
                { value: 'COUNTRY', label: 'País', color: BadgeColor.BLUE },
                { value: 'REGION', label: 'Región', color: BadgeColor.PURPLE },
                { value: 'PROVINCE', label: 'Provincia', color: BadgeColor.INDIGO },
                { value: 'DEPARTMENT', label: 'Departamento', color: BadgeColor.CYAN },
                { value: 'CITY', label: 'Ciudad', color: BadgeColor.GREEN },
                { value: 'TOWN', label: 'Localidad', color: BadgeColor.TEAL },
                { value: 'NEIGHBORHOOD', label: 'Barrio', color: BadgeColor.ORANGE }
            ]
        },
        {
            accessorKey: 'visibility',
            labelKey: 'admin-entities.columns.visibility',
            format: 'badge'
        },
        {
            accessorKey: 'lifecycleState',
            labelKey: 'admin-entities.columns.status',
            format: 'badge'
        },
        {
            accessorKey: 'moderationState',
            labelKey: 'admin-entities.columns.moderation',
            format: 'badge'
        },
        {
            accessorKey: 'summary',
            labelKey: 'admin-entities.columns.summary',
            format: 'text',
            maxLength: 300
        },
        {
            accessorKey: 'description',
            labelKey: 'admin-entities.columns.description',
            format: 'text',
            maxLength: 500
        },
        {
            accessorKey: 'accommodationsCount',
            labelKey: 'admin-entities.columns.accommodationsCount',
            format: 'text'
        },
        {
            accessorKey: 'averageRating',
            labelKey: 'admin-entities.columns.averageRating',
            format: 'text'
        },
        {
            accessorKey: 'reviewsCount',
            labelKey: 'admin-entities.columns.reviewsCount',
            format: 'text'
        },
        {
            accessorKey: 'media.featuredImage.url',
            labelKey: 'admin-entities.columns.featuredImage',
            format: 'image'
        },
        { accessorKey: 'tags', labelKey: 'admin-entities.columns.tags', format: 'list' },
        {
            accessorKey: 'createdAt',
            labelKey: 'admin-entities.columns.createdAt',
            format: 'date'
        },
        {
            accessorKey: 'updatedAt',
            labelKey: 'admin-entities.columns.updatedAt',
            format: 'date'
        }
    ],
    // Header extras: slug as subtitle, isFeatured as a chip next to the title.
    peekSubtitleField: 'slug',
    peekFeaturedField: 'isFeatured'
};

// Generate the component and route
const { component, route } = createEntityListPage(destinationsConfig);

export { component as DestinationsPageComponent, route as DestinationsRoute };
