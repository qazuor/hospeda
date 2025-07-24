import path from 'node:path';
import { PostSponsorshipService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { STATUS_ICONS } from '../utils/icons.js';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for post sponsorship data
 */
const postSponsorshipNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        [key: string]: unknown;
    };
    if (cleanData.paidAt && typeof cleanData.paidAt === 'string') {
        cleanData.paidAt = new Date(cleanData.paidAt);
    }
    if (cleanData.fromDate && typeof cleanData.fromDate === 'string') {
        cleanData.fromDate = new Date(cleanData.fromDate);
    }
    if (cleanData.toDate && typeof cleanData.toDate === 'string') {
        cleanData.toDate = new Date(cleanData.toDate);
    }
    return cleanData;
};

/**
 * Pre-process callback to map IDs and set correct actor
 */
const preProcessSponsorship = async (item: unknown, context: SeedContext) => {
    const sponsorshipData = item as Record<string, unknown>;

    // Map seed IDs to real database IDs using specific getters
    const seedPostId = sponsorshipData.postId as string;
    const seedSponsorId = sponsorshipData.sponsorId as string;

    if (seedPostId) {
        const realPostId = context.idMapper.getMappedPostId(seedPostId);
        if (!realPostId) {
            throw new Error(`No mapping found for post ID: ${seedPostId}`);
        }
        sponsorshipData.postId = realPostId;
    }

    if (seedSponsorId) {
        const realSponsorId = context.idMapper.getMappedSponsorId(seedSponsorId);
        if (!realSponsorId) {
            throw new Error(`No mapping found for post sponsor ID: ${seedSponsorId}`);
        }
        sponsorshipData.sponsorId = realSponsorId;
    }
};

/**
 * Get entity info for post sponsorship
 */
const getPostSponsorshipInfo = (item: unknown, context: SeedContext) => {
    const sponsorshipData = item as Record<string, unknown>;
    const sponsorId = sponsorshipData.sponsorId as string;
    const postId = sponsorshipData.postId as string;
    const isHighlighted = sponsorshipData.isHighlighted as boolean;
    const highlightIcon = isHighlighted ? ` ${STATUS_ICONS.Highlight}` : '';
    const postName = context.idMapper.getDisplayNameByRealId('posts', postId);
    const sponsorName = context.idMapper.getDisplayNameByRealId('postsponsors', sponsorId);
    return `Sponsor: ${sponsorName} → Post: ${postName}${highlightIcon}`;
};

/**
 * PostSponsorships seed using Seed Factory
 */
export const seedPostSponsorships = createSeedFactory({
    entityName: 'PostSponsorships',
    serviceClass: PostSponsorshipService,
    folder: path.resolve('src/data/postSponsorship'),
    files: exampleManifest.postSponsorships,
    normalizer: postSponsorshipNormalizer,
    getEntityInfo: getPostSponsorshipInfo,
    preProcess: preProcessSponsorship
});
