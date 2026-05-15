import { createSelectUtils } from './create-select-utils';

interface EventOrganizerItem {
    id: string;
    name: string;
    description?: string;
}

const utils = createSelectUtils<EventOrganizerItem>({
    endpoint: '/api/v1/admin/event-organizers',
    buildLabel: (item) => item.name,
    buildDescription: (item) => item.description,
    // No batch endpoint — falls back to parallel GET-by-id.
    entityName: 'event organizers'
});

export const searchEventOrganizers = utils.search;
export const loadEventOrganizersByIds = utils.loadByIds;
export const loadInitialEventOrganizers = utils.loadAll;
