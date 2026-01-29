import type { ConsolidatedEntityConfig } from '../types/consolidated-config.types';
import {
    createBasicInfoConsolidatedSection,
    createLocationConsolidatedSection,
    createMediaConsolidatedSection,
    createStatesModerationConsolidatedSection,
    createStatisticsConsolidatedSection
} from './sections';

/**
 * Creates the complete consolidated configuration for destination entity
 *
 * @returns Consolidated entity configuration for destination
 */
export const createDestinationConsolidatedConfig = (): ConsolidatedEntityConfig => {
    return {
        sections: [
            createBasicInfoConsolidatedSection(),
            createLocationConsolidatedSection(),
            createMediaConsolidatedSection(),
            createStatesModerationConsolidatedSection(),
            createStatisticsConsolidatedSection()
        ],
        metadata: {
            title: 'Destino',
            description: 'Gestionar detalles del destino',
            entityName: 'Destino',
            entityNamePlural: 'Destinos'
        }
    };
};
