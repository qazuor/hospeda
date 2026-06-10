import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Accommodation, AccommodationListItemSchema } from '../schemas/accommodations.schemas';
import { createAccommodationsColumns } from './accommodations.columns';

/**
 * Grid-only configuration for the HOST's personal accommodation portfolio.
 *
 * This config is intentionally separate from `accommodations.config.ts` (the admin
 * staff list) so that per-host customizations never bleed into the admin table and
 * vice-versa.
 *
 * Owner-scoping guarantee (SPEC-169 §5.2): the API endpoint
 * `/api/v1/admin/accommodations` applies server-side forced owner-scoping inside
 * `AccommodationService._executeAdminSearch`. An actor holding only
 * `ACCOMMODATION_VIEW_OWN` (every HOST) has its ownerId silently overwritten with
 * `actor.id`, so a HOST physically cannot widen the query to see another host's
 * accommodations regardless of what the client sends. No client-side ownerId filter
 * is required — the server enforces it unconditionally.
 *
 * View mode: grid-only (defaultView 'grid', allowViewToggle false). The toggle
 * control is not rendered and table mode is never reachable from the UI.
 */
export const meAccommodationsConfig: EntityConfig<Accommodation> = {
    // Metadata
    name: 'me-accommodations',
    entityKey: 'accommodation',
    entityType: EntityType.ACCOMMODATION,

    // API — same endpoint as the admin list; owner-scoping is enforced server-side
    apiEndpoint: '/api/v1/admin/accommodations',

    // Filter bar: subset relevant to host portfolio (no admin-only filters)
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
            }
        ]
    },

    // Routes
    basePath: '/me/accommodations',
    detailPath: '/accommodations/[id]',

    // Schemas
    // TYPE-WORKAROUND: brand-only mismatch between local AccommodationListItemSchema and
    // the EntityConfig generic; structurally compatible.
    listItemSchema: AccommodationListItemSchema as unknown as z.ZodSchema<Accommodation>,

    // Search
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
        enabled: true
    },

    // Grid-only: toggle never shown, table mode never reachable
    viewConfig: {
        defaultView: 'grid',
        allowViewToggle: false,
        gridConfig: {
            maxFields: 12,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination
    paginationConfig: {
        defaultPageSize: 20,
        allowedPageSizes: [10, 20, 30, 50]
    },

    // Default sort: alphabetical by name
    defaultSort: { id: 'name', desc: false },

    // Layout: create button points to the shared create route
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/accommodations/new'
    },

    // Reuse the shared column factory — columns are the same data, different context
    createColumns: createAccommodationsColumns,

    // Peek drawer fields: same curated set as the admin list
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
    peekSubtitleField: 'slug',
    peekFeaturedField: 'isFeatured'
};

// Generate the component and route (grid-only, no toggle)
const { component, route } = createEntityListPage(meAccommodationsConfig);

export { component as MeAccommodationsPageComponent, route as MeAccommodationsRoute };
