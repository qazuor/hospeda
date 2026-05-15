import { createSelectUtils } from './create-select-utils';

interface EventItem {
    id: string;
    name?: string;
    title?: string;
    summary?: string;
}

const utils = createSelectUtils<EventItem>({
    endpoint: '/api/v1/admin/events',
    buildLabel: (item) => item.name || item.title || item.id,
    buildDescription: (item) => item.summary,
    batchEndpoint: '/api/v1/admin/events/batch',
    batchFields: ['id', 'name', 'title', 'summary'],
    entityName: 'events'
});

export const searchEvents = utils.search;
export const loadEventsByIds = utils.loadByIds;
export const loadInitialEvents = utils.loadAll;
