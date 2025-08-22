import { createEntityListPage } from '@/components/entity-list';
import type { EntityConfig } from '@/components/entity-list/types';
import { EntityType } from '@/components/table/DataTable';
import { type Event, EventListItemSchema } from '../schemas/events.schemas';
import { createEventsColumns } from './events.columns';

export const eventsConfig: EntityConfig<Event> = {
    name: 'events',
    displayName: 'Event',
    pluralDisplayName: 'Events',
    entityType: EntityType.EVENT,
    apiEndpoint: '/api/v1/public/events',
    basePath: '/events',
    detailPath: '/events/[slug]',
    listItemSchema: EventListItemSchema,
    searchConfig: {
        minChars: 3,
        debounceMs: 400,
        placeholder: 'Search events...',
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
        title: 'Events - List',
        showBreadcrumbs: true,
        showCreateButton: true,
        createButtonText: 'New Event',
        createButtonPath: '/events/new'
    },
    createColumns: createEventsColumns
};

const { component, route } = createEntityListPage(eventsConfig);
export { component as EventsPageComponent, route as EventsRoute };
