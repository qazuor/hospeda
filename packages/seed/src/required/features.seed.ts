import { FeatureService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';

/**
 * Seed factory for features
 *
 * Creates feature records from JSON files. Keeps the slug: the service
 * requires it explicitly since SPEC-266 dropped name-based auto-generation.
 */
export const seedFeatures = createSeedFactory({
    entityName: 'Features',
    serviceClass: FeatureService,
    folder: 'src/data/feature',
    files: requiredManifest.features,

    // Exclude metadata fields, lifecycleState (auto-generated), and name (dropped in
    // SPEC-266 T-001). Keep slug — the service now requires it explicitly.
    normalizer: (data) => {
        const { $schema, id, lifecycleState, name, ...cleanData } = data as {
            $schema?: string;
            id?: string;
            lifecycleState?: string;
            name?: unknown;
            [key: string]: unknown;
        };

        return cleanData;
    },

    // Custom entity info for better logging
    // name was dropped in SPEC-266 T-001; use slug for display.
    getEntityInfo: (item, _context) => {
        const feature = item as { slug?: string; type?: string };
        const typeInfo = feature.type ? ` (${feature.type})` : '';
        return `"${feature.slug ?? 'unknown'}"${typeInfo}`;
    }
});
