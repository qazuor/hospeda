import type { useTranslations } from '@repo/i18n';
import type { ConsolidatedEntityConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    createBasicInfoConsolidatedSection,
    createCurationConsolidatedSection,
    createLocationConsolidatedSection,
    createStatesModerationConsolidatedSection
} from './sections';

/**
 * Creates the complete consolidated configuration for point-of-interest entity.
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Consolidated entity configuration for point of interest
 */
export const createPointOfInterestConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedEntityConfig => {
    return {
        sections: [
            createBasicInfoConsolidatedSection(),
            createLocationConsolidatedSection(),
            createCurationConsolidatedSection(),
            createStatesModerationConsolidatedSection()
        ],
        metadata: {
            title: t('admin-entities.entities.pointOfInterest.singular'),
            description: t('admin-entities.entities.pointOfInterest.description'),
            entityName: t('admin-entities.entities.pointOfInterest.singular'),
            entityNamePlural: t('admin-entities.entities.pointOfInterest.plural')
        }
    };
};
