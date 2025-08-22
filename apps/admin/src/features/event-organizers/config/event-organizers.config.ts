import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import {
    type EventOrganizer,
    EventOrganizerListItemSchema
} from '../schemas/event-organizers.schemas';
import { createEventOrganizersColumns } from './event-organizers.columns';

export const eventOrganizersConfig: EntityConfig<EventOrganizer> = {
    name: 'eventOrganizers',
    displayName: 'Event Organizer',
    pluralDisplayName: 'Event Organizers',
    entityType: EntityType.EVENT_ORGANIZER,

    // API
    apiEndpoint: '/api/v1/public/event-organizers',

    // Routes
    basePath: '/event-organizers',
    detailPath: '/event-organizers/[id]',

    // Schemas
    listItemSchema: EventOrganizerListItemSchema,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        placeholder: 'Search event organizers...',
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
        title: 'Event Organizers - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Event Organizer',
        createButtonPath: '/event-organizers/new'
    },

    // Columns
    createColumns: createEventOrganizersColumns
};

const { component, route } = createEntityListPage(eventOrganizersConfig);
export { component as EventOrganizersPageComponent, route as EventOrganizersRoute };
