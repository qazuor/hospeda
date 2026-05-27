import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import { type Event, EventListItemSchema } from '../schemas/events.schemas';
import { createEventsColumns } from './events.columns';

/**
 * Configuration for events entity list
 */
export const eventsConfig: EntityConfig<Event> = {
    name: 'events',
    entityKey: 'event',
    entityType: EntityType.EVENT,
    apiEndpoint: '/api/v1/admin/events',
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
                labelKey: 'admin-filters.eventCategory.label',
                type: 'select',
                order: 2,
                options: [
                    { value: 'MUSIC', labelKey: 'admin-filters.eventCategory.music' },
                    { value: 'CULTURE', labelKey: 'admin-filters.eventCategory.culture' },
                    { value: 'SPORTS', labelKey: 'admin-filters.eventCategory.sports' },
                    { value: 'GASTRONOMY', labelKey: 'admin-filters.eventCategory.gastronomy' },
                    { value: 'FESTIVAL', labelKey: 'admin-filters.eventCategory.festival' },
                    { value: 'NATURE', labelKey: 'admin-filters.eventCategory.nature' },
                    { value: 'THEATER', labelKey: 'admin-filters.eventCategory.theater' },
                    { value: 'WORKSHOP', labelKey: 'admin-filters.eventCategory.workshop' },
                    { value: 'OTHER', labelKey: 'admin-filters.eventCategory.other' }
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
    basePath: '/events',
    detailPath: '/events/[id]',
    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<Event>, but EventListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: EventListItemSchema as unknown as z.ZodSchema<Event>,
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
        enabled: true
    },
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
    paginationConfig: {
        defaultPageSize: 15,
        allowedPageSizes: [10, 15, 30, 50]
    },
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/events/new'
    },
    createColumns: createEventsColumns,

    /**
     * Curated peek drawer fields for events.
     *
     * Badge fields (category, visibility, lifecycleState) resolve their badgeOptions
     * automatically from the matching column definitions — no duplication needed.
     * Only fields present on the EventListItemSchema (admin-extended) are included.
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
            format: 'badge'
        },
        {
            accessorKey: 'lifecycleState',
            labelKey: 'admin-entities.columns.status',
            format: 'badge'
        },
        {
            accessorKey: 'summary',
            labelKey: 'admin-entities.columns.summary',
            format: 'text',
            maxLength: 300
        },
        {
            accessorKey: 'organizerName',
            labelKey: 'admin-entities.columns.organizer',
            format: 'text'
        },
        {
            accessorKey: 'locationName',
            labelKey: 'admin-entities.columns.location',
            format: 'text'
        },
        {
            accessorKey: 'date.start',
            labelKey: 'admin-entities.columns.startDate',
            format: 'date'
        },
        {
            accessorKey: 'date.end',
            labelKey: 'admin-entities.columns.endDate',
            format: 'date'
        },
        {
            accessorKey: 'pricing.price',
            labelKey: 'admin-entities.columns.price',
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

const { component, route } = createEntityListPage(eventsConfig);
export { component as EventsPageComponent, route as EventsRoute };
