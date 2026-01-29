import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    createAddressConsolidatedSection,
    createBasicInfoConsolidatedSection,
    createStatesConsolidatedSection
} from './sections';

/**
 * Consolidated configuration for Event Location entity
 * Combines all section configurations into a single object
 */
export interface EventLocationConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Event Location entity
 */
export const createEventLocationConsolidatedConfig = (): EventLocationConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createAddressConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'event-location',
        entityName: 'Ubicación de Evento',
        entityNamePlural: 'Ubicaciones de Eventos',
        baseRoute: '/events/locations'
    }
});
