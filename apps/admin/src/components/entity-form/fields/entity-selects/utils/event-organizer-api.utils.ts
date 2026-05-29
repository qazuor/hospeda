/**
 * Event-organizer entity select utilities.
 *
 * SPEC-169 T-021: Migrated from /api/v1/admin/event-organizers (SUPER_ADMIN-only
 * today) to /api/v1/admin/event-organizers/options (requires ACCESS_PANEL_ADMIN).
 * Decision D4 / OQ2: event-organizers/locations now accessible to editor + admin.
 *
 * /options response shape: { items: [{ id, label, slug }] }
 */

import { createOptionsSelectUtils } from './create-select-utils';

const utils = createOptionsSelectUtils({
    optionsEndpoint: '/api/v1/admin/event-organizers/options',
    // No batch endpoint — falls back to parallel GET-by-id.
    baseEndpoint: '/api/v1/admin/event-organizers',
    entityName: 'event organizers'
});

export const searchEventOrganizers = utils.search;
export const loadEventOrganizersByIds = utils.loadByIds;
export const loadInitialEventOrganizers = utils.loadAll;
