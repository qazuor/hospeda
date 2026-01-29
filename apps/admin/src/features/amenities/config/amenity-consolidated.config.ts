import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    createBasicInfoConsolidatedSection,
    createFlagsConsolidatedSection,
    createStatesConsolidatedSection
} from './sections';

/**
 * Consolidated configuration for Amenity entity
 * Combines all section configurations into a single object
 */
export interface AmenityConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Amenity entity
 */
export const createAmenityConsolidatedConfig = (): AmenityConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createFlagsConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'amenity',
        entityName: 'Amenidad',
        entityNamePlural: 'Amenidades',
        baseRoute: '/content/accommodation-amenities'
    }
});
