import type { useTranslations } from '@repo/i18n';
import type { ConsolidatedEntityConfig } from '../types/consolidated-config.types';
import {
    createBasicInfoConsolidatedSection,
    createLocationConsolidatedSection,
    createMediaConsolidatedSection,
    createStatesModerationConsolidatedSection,
    createStatisticsConsolidatedSection
} from './sections';

/**
 * Creates the complete consolidated configuration for destination entity.
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Consolidated entity configuration for destination
 */
export const createDestinationConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedEntityConfig => {
    return {
        sections: [
            createBasicInfoConsolidatedSection(),
            createLocationConsolidatedSection(),
            createMediaConsolidatedSection(),
            createStatesModerationConsolidatedSection(),
            createStatisticsConsolidatedSection()
        ],
        metadata: {
            title: t('admin-entities.entities.destination.singular'),
            description: t('admin-entities.entities.destination.description'),
            entityName: t('admin-entities.entities.destination.singular'),
            entityNamePlural: t('admin-entities.entities.destination.plural')
        }
    };
};
