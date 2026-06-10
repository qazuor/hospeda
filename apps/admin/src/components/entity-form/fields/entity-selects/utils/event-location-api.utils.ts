/**
 * Event-location entity select utilities.
 *
 * SPEC-169 T-021: Migrated from /api/v1/admin/event-locations (SUPER_ADMIN-only
 * today) to /api/v1/admin/event-locations/options (requires ACCESS_PANEL_ADMIN).
 * Decision D4 / OQ2: event-locations now accessible to editor + admin.
 *
 * /options response shape: { items: [{ id, label, slug }] }
 * label = placeName ?? slug (D4 addendum — owner-approved fallback).
 */

import { createOptionsSelectUtils } from './create-select-utils';

const utils = createOptionsSelectUtils({
    optionsEndpoint: '/api/v1/admin/event-locations/options',
    // No batch endpoint — falls back to parallel GET-by-id.
    baseEndpoint: '/api/v1/admin/event-locations',
    entityName: 'event locations'
});

export const searchEventLocations = utils.search;
export const loadEventLocationsByIds = utils.loadByIds;
export const loadInitialEventLocations = utils.loadAll;
