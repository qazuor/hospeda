import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { createBasicInfoConsolidatedSection, createStatesConsolidatedSection } from './sections';

/**
 * Consolidated configuration for Tag entity
 * Combines all section configurations into a single object
 */
export interface TagConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Tag entity
 */
export const createTagConsolidatedConfig = (): TagConsolidatedConfig => ({
    sections: [createBasicInfoConsolidatedSection(), createStatesConsolidatedSection()],
    metadata: {
        entityType: 'tag',
        entityName: 'Etiqueta',
        entityNamePlural: 'Etiquetas',
        baseRoute: '/settings/tags'
    }
});
