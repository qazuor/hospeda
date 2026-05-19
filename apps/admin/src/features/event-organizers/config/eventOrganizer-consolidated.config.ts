import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
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
 * Creates the complete consolidated configuration for the Event Organizer entity.
 *
 * @param t - Translation function from `useTranslations()`
 */
export const createEventOrganizerConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): EventOrganizerConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createContactConsolidatedSection(),
        createSocialConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'event-organizer',
        entityName: t('admin-entities.entities.eventOrganizer.singular'),
        entityNamePlural: t('admin-entities.entities.eventOrganizer.plural'),
        baseRoute: '/events/organizers'
    }
});
