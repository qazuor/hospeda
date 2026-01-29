import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    createBasicInfoConsolidatedSection,
    createFlagsConsolidatedSection,
    createStatesConsolidatedSection
} from './sections';

/**
 * Consolidated configuration for Feature entity
 * Combines all section configurations into a single object
 */
export interface FeatureConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Feature entity
 */
export const createFeatureConsolidatedConfig = (): FeatureConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createFlagsConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'feature',
        entityName: 'Característica',
        entityNamePlural: 'Características',
        baseRoute: '/content/accommodation-features'
    }
});
