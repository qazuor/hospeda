import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
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
 * Creates the complete consolidated configuration for the Event Location entity.
 *
 * @param t - Translation function from `useTranslations()`
 */
export const createEventLocationConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): EventLocationConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createAddressConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'event-location',
        entityName: t('admin-entities.entities.eventLocation.singular'),
        entityNamePlural: t('admin-entities.entities.eventLocation.plural'),
        baseRoute: '/events/locations'
    }
});
