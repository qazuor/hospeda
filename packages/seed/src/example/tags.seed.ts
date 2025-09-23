import path from 'node:path';
import { TagService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import type { SeedContext } from '../utils/seedContext.js';
import { createSeedFactory } from '../utils/seedFactory.js';

/**
 * Normalizer for tag data
 */
const tagNormalizer = (data: Record<string, unknown>) => {
    // First exclude metadata fields and auto-generated fields
    const { $schema, id, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        [key: string]: unknown;
    };
    return cleanData;
};

/**
 * Get entity info for tag
 */
const getTagInfo = (item: unknown, _context: SeedContext) => {
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
