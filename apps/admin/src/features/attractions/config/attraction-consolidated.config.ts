import type { ConsolidatedEntityConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    createBasicInfoConsolidatedSection,
    createStatesModerationConsolidatedSection
} from './sections';

/**
 * Creates the complete consolidated configuration for attraction entity
 *
 * @returns Consolidated entity configuration for attraction
 */
export const createAttractionConsolidatedConfig = (): ConsolidatedEntityConfig => {
    return {
        sections: [
            createBasicInfoConsolidatedSection(),
            createStatesModerationConsolidatedSection()
        ],
        metadata: {
            title: 'Atracción',
            description: 'Gestionar detalles de la atracción',
            entityName: 'Atracción',
            entityNamePlural: 'Atracciones'
        }
    };
};
