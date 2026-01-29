import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    createBasicInfoConsolidatedSection,
    createContactConsolidatedSection,
    createSocialConsolidatedSection,
    createStatesConsolidatedSection
} from './sections';

/**
 * Consolidated configuration for Event Organizer entity
 * Combines all section configurations into a single object
 */
export interface EventOrganizerConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Event Organizer entity
 */
export const createEventOrganizerConsolidatedConfig = (): EventOrganizerConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createContactConsolidatedSection(),
        createSocialConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'event-organizer',
        entityName: 'Organizador de Eventos',
        entityNamePlural: 'Organizadores de Eventos',
        baseRoute: '/events/organizers'
    }
});
