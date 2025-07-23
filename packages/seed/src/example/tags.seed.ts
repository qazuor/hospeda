import path from 'node:path';
import { TagService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for tag data
 */
const tagNormalizer = (data: Record<string, unknown>) => {
    return {
        name: data.name as string,
        description: data.description as string,
        color: data.color as string,
        icon: data.icon as string,
        isBuiltin: data.isBuiltin as boolean,
        isFeatured: data.isFeatured as boolean,
        visibility: data.visibility,
        lifecycleState: data.lifecycleState
    };
};

/**
 * Get entity info for tag
 */
const getTagInfo = (item: unknown) => {
    const tagData = item as Record<string, unknown>;
    const name = tagData.name as string;
    const color = tagData.color as string;
    return `"${name}" (${color})`;
};

/**
 * Tags seed using Seed Factory
 */
export const seedTags = createSeedFactory({
    entityName: 'Tags',
    serviceClass: TagService,
    folder: path.resolve('src/data/tag'),
    files: exampleManifest.tags,
    normalizer: tagNormalizer,
    getEntityInfo: getTagInfo
});
