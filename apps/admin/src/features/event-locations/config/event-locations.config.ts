import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import {
    type EventLocation,
    EventLocationListItemSchema
} from '../schemas/event-locations.schemas';
import { createEventLocationsColumns } from './event-locations.columns';

export const eventLocationsConfig: EntityConfig<EventLocation> = {
    name: 'eventLocations',
    displayName: 'Event Location',
    pluralDisplayName: 'Event Locations',
    entityType: EntityType.EVENT_LOCATION,

    // API
    apiEndpoint: '/api/v1/public/event-locations',

    // Routes
    basePath: '/event-locations',
    detailPath: '/event-locations/[id]',

    // Schemas
    listItemSchema: EventLocationListItemSchema,

    // Search configuration
    searchConfig: {
        minChars: 2,
        debounceMs: 300,
        placeholder: 'Search event locations...',
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
        title: 'Event Locations - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Event Location',
        createButtonPath: '/event-locations/new'
    },

    // Columns
    createColumns: createEventLocationsColumns
};

const { component, route } = createEntityListPage(eventLocationsConfig);
export { component as EventLocationsPageComponent, route as EventLocationsRoute };
