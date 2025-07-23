import path from 'node:path';
import { PostSponsorService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for post sponsor data
 */
const postSponsorNormalizer = (data: Record<string, unknown>) => {
    return {
        name: data.name as string,
        description: data.description as string,
        type: data.type,
        logo: data.logo as string,
        website: data.website as string,
        contactInfo: data.contactInfo,
        visibility: data.visibility,
        lifecycleState: data.lifecycleState
    };
};

/**
 * Get entity info for post sponsor
 */
const getPostSponsorInfo = (item: unknown) => {
    const sponsorData = item as Record<string, unknown>;
    const name = sponsorData.name as string;
    const type = sponsorData.type as string;
    return `"${name}" (${type})`;
};

/**
 * PostSponsors seed using Seed Factory
 */
export const seedPostSponsors = createSeedFactory({
    entityName: 'PostSponsors',
    serviceClass: PostSponsorService,
    folder: path.resolve('src/data/postSponsor'),
    files: exampleManifest.postSponsors,
    normalizer: postSponsorNormalizer,
    getEntityInfo: getPostSponsorInfo
});
