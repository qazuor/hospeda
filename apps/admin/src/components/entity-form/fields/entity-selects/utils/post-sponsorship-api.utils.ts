import { createSelectUtils } from './create-select-utils';

interface PostSponsorshipItem {
    id: string;
    sponsor?: { name?: string };
    sponsorName?: string;
    message?: string;
    description?: string;
}

const utils = createSelectUtils<PostSponsorshipItem>({
    endpoint: '/api/v1/admin/post-sponsorships',
    buildLabel: (item) =>
        item.sponsorName || item.sponsor?.name || item.message?.slice(0, 60) || item.id,
    buildDescription: (item) => item.description || item.message?.slice(0, 100),
    // No batch endpoint — falls back to parallel GET-by-id.
    entityName: 'post sponsorships'
});

export const searchPostSponsorships = utils.search;
export const loadPostSponsorshipsByIds = utils.loadByIds;
export const loadInitialPostSponsorships = utils.loadAll;
