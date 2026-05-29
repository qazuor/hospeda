/**
 * Event entity select utilities.
 *
 * SPEC-169 T-021: Migrated from /api/v1/admin/events (requires EVENT_VIEW_ALL
 * or similar staff permission) to /api/v1/admin/events/options (requires
 * ACCESS_PANEL_ADMIN only).
 *
 * /options response shape: { items: [{ id, label, slug }] }
 */

import { createOptionsSelectUtils } from './create-select-utils';

const utils = createOptionsSelectUtils({
    optionsEndpoint: '/api/v1/admin/events/options',
    batchEndpoint: '/api/v1/admin/events/batch',
    batchFields: ['id', 'name', 'title', 'summary'],
    baseEndpoint: '/api/v1/admin/events',
    entityName: 'events'
});

export const searchEvents = utils.search;
export const loadEventsByIds = utils.loadByIds;
export const loadInitialEvents = utils.loadAll;
