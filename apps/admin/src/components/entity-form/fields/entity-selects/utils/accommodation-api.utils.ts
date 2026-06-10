/**
 * Accommodation entity select utilities.
 *
 * SPEC-169 T-021: Migrated from /api/v1/admin/accommodations (requires
 * ACCOMMODATION_VIEW_ALL) to /api/v1/admin/accommodations/options (requires
 * ACCESS_PANEL_ADMIN only).
 *
 * /options response shape for accommodation:
 *   { items: [{ id, label, slug, type, destination }] }
 * type and destination are included per D4/OQ3.
 *
 * NOTE (FLAG SPEC-169/UX-ACCOM-TYPE): The `type` and `destination` fields are
 * present in the /options payload for accommodation (D4). They are not yet
 * surfaced in the selector label — the label shows only the accommodation name.
 * If type/destination context is needed in the dropdown, consume item.type and
 * item.destination from the option's extra fields (accessible via the metadata
 * object if the component supports it).
 */

import { createOptionsSelectUtils } from './create-select-utils';

const utils = createOptionsSelectUtils({
    optionsEndpoint: '/api/v1/admin/accommodations/options',
    batchEndpoint: '/api/v1/admin/accommodations/batch',
    batchFields: ['id', 'name', 'summary'],
    baseEndpoint: '/api/v1/admin/accommodations',
    entityName: 'accommodations'
});

export const searchAccommodations = utils.search;
export const loadAccommodationsByIds = utils.loadByIds;
export const loadInitialAccommodations = utils.loadAll;
