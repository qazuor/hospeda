import { createSelectUtils } from './create-select-utils';

interface EventLocationItem {
    id: string;
    placeName?: string;
    slug?: string;
    street?: string;
    number?: string;
}

const utils = createSelectUtils<EventLocationItem>({
    endpoint: '/api/v1/admin/event-locations',
    buildLabel: (item) => item.placeName || item.slug || item.id,
    buildDescription: (item) => [item.street, item.number].filter(Boolean).join(' ') || undefined,
    // No batch endpoint — falls back to parallel GET-by-id.
    entityName: 'event locations'
});

export const searchEventLocations = utils.search;
export const loadEventLocationsByIds = utils.loadByIds;
export const loadInitialEventLocations = utils.loadAll;
