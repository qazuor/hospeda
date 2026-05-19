import { createSelectUtils } from './create-select-utils';

interface AccommodationItem {
    id: string;
    name: string;
    summary?: string;
}

const utils = createSelectUtils<AccommodationItem>({
    endpoint: '/api/v1/admin/accommodations',
    buildLabel: (item) => item.name,
    buildDescription: (item) => item.summary,
    batchEndpoint: '/api/v1/admin/accommodations/batch',
    batchFields: ['id', 'name', 'summary'],
    entityName: 'accommodations'
});

export const searchAccommodations = utils.search;
export const loadAccommodationsByIds = utils.loadByIds;
export const loadInitialAccommodations = utils.loadAll;
