import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import type { z } from 'zod';
import {
    type EventOrganizer,
    EventOrganizerListItemSchema
} from '../schemas/event-organizers.schemas';
import { createEventOrganizersColumns } from './event-organizers.columns';

export const eventOrganizersConfig: EntityConfig<EventOrganizer> = {
    name: 'eventOrganizers',
    entityKey: 'eventOrganizer',
    entityType: EntityType.EVENT_ORGANIZER,

    // API
    apiEndpoint: '/api/v1/admin/event-organizers',

    // Filter bar configuration
    filterBarConfig: {
        filters: [
            {
                paramKey: 'includeDeleted',
                labelKey: 'admin-filters.includeDeleted.label',
                type: 'boolean',
                order: 99
            }
        ]
    },

    // Routes
    basePath: '/events/organizers',
    detailPath: '/events/organizers/[id]',

    // Schemas - Use type assertion for Zod version compatibility
    // TYPE-WORKAROUND: EntityConfig generic narrows the schema to z.ZodSchema<EventOrganizer>, but EventOrganizerListItemSchema carries branded effects from @repo/schemas; structurally compatible, brand-only mismatch.
    listItemSchema: EventOrganizerListItemSchema as unknown as z.ZodSchema<EventOrganizer>,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        enabled: true
    },

    // View configuration
    viewConfig: {
        defaultView: 'table',
        allowViewToggle: true,
        gridConfig: {
            maxFields: 8,
            columns: {
                mobile: 1,
                tablet: 2,
                desktop: 3
            }
        }
    },

    // Pagination configuration
    paginationConfig: {
        defaultPageSize: 25,
        allowedPageSizes: [10, 25, 50, 100]
    },

    // Layout configuration
    layoutConfig: {
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonPath: '/events/organizers/new'
    },

    // Columns
    createColumns: createEventOrganizersColumns
};

const { component, route } = createEntityListPage(eventOrganizersConfig);
export { component as EventOrganizersPageComponent, route as EventOrganizersRoute };
