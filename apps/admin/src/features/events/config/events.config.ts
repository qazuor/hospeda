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
    createColumns: createEventsColumns
};

const { component, route } = createEntityListPage(eventsConfig);
export { component as EventsPageComponent, route as EventsRoute };
