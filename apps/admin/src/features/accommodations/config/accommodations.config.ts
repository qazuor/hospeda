import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Accommodation, AccommodationListItemSchema } from '../schemas/accommodations.schemas';
import { createAccommodationsColumns } from './accommodations.columns';

/**
 * Configuration for accommodations entity list
 */
export const accommodationsConfig: EntityConfig<Accommodation> = {
    // Metadata
    name: 'accommodations',
    entityKey: 'accommodation',
    entityType: EntityType.ACCOMMODATION,

    // API
    apiEndpoint: '/api/v1/admin/accommodations',

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
                paramKey: 'type',
                labelKey: 'admin-filters.accommodationType.label',
                type: 'select',
                order: 2,
                options: [
                    { value: 'APARTMENT', labelKey: 'admin-filters.accommodationType.apartment' },
                    { value: 'HOUSE', labelKey: 'admin-filters.accommodationType.house' },
                    {
                        value: 'COUNTRY_HOUSE',
                        labelKey: 'admin-filters.accommodationType.countryHouse'
                    },
                    { value: 'CABIN', labelKey: 'admin-filters.accommodationType.cabin' },
                    { value: 'HOTEL', labelKey: 'admin-filters.accommodationType.hotel' },
                    { value: 'HOSTEL', labelKey: 'admin-filters.accommodationType.hostel' },
                    { value: 'CAMPING', labelKey: 'admin-filters.accommodationType.camping' },
                    { value: 'ROOM', labelKey: 'admin-filters.accommodationType.room' },
                    { value: 'MOTEL', labelKey: 'admin-filters.accommodationType.motel' },
                    { value: 'RESORT', labelKey: 'admin-filters.accommodationType.resort' }
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
    basePath: '/accommodations',
    detailPath: '/accommodations/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Accommodation>, but AccommodationListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: AccommodationListItemSchema as unknown as z.ZodSchema<Accommodation>,

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
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 30, 50]
    },

    // Default sort: alphabetical by name (overrides the global newest-first default).
    defaultSort: { id: 'name', desc: false },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/accommodations/new'
    },

    // Columns
    createColumns: createAccommodationsColumns,

    /**
     * Curated peek drawer fields for accommodations.
     *
     * Only the most relevant fields are shown (not all columns) so the drawer
     * stays scannable. accessorKeys match the column definitions; labelKeys
     * reuse the i18n keys used in the column headers.
     *
     * Badge fields do NOT declare `badgeOptions` here — `EntityListPage` looks up
     * the matching column definition and attaches its `badgeOptions` automatically,
     * avoiding duplication between the column config and the peek config.
     */
    peekFields: [
        { accessorKey: 'id', labelKey: 'admin-entities.columns.id', format: 'text' },
        { accessorKey: 'type', labelKey: 'admin-entities.columns.type', format: 'badge' },
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
        { accessorKey: 'summary', labelKey: 'admin-entities.columns.summary', format: 'text' },
        {
            accessorKey: 'description',
            labelKey: 'admin-entities.columns.description',
            format: 'text',
            maxLength: 500
        },
        { accessorKey: 'createdAt', labelKey: 'admin-entities.columns.createdAt', format: 'date' },
        { accessorKey: 'updatedAt', labelKey: 'admin-entities.columns.updatedAt', format: 'date' },
        { accessorKey: 'location', labelKey: 'admin-entities.columns.address', format: 'address' },
        {
            accessorKey: 'media.featuredImage.url',
            labelKey: 'admin-entities.columns.photo',
            format: 'image'
        }
    ],
    // Header extras: slug as subtitle, isFeatured as a chip next to the title.
    peekSubtitleField: 'slug',
    peekFeaturedField: 'isFeatured'
};

// Generate the component and route
const { component, route } = createEntityListPage(accommodationsConfig);

export { component as AccommodationsPageComponent, route as AccommodationsRoute };
