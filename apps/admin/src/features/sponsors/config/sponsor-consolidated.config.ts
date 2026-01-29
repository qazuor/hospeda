import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    createBasicInfoConsolidatedSection,
    createContactConsolidatedSection,
    createSocialConsolidatedSection,
    createStatesConsolidatedSection
} from './sections';

/**
 * Consolidated configuration for Sponsor entity
 * Combines all section configurations into a single object
 */
export interface SponsorConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Sponsor entity
 */
export const createSponsorConsolidatedConfig = (): SponsorConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createContactConsolidatedSection(),
        createSocialConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'sponsor',
        entityName: 'Patrocinador',
        entityNamePlural: 'Patrocinadores',
        baseRoute: '/sponsors'
    }
});
