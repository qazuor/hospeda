import type { ConsolidatedEntityConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import {
    createBasicInfoConsolidatedSection,
    createStatesModerationConsolidatedSection
} from './sections';

/**
 * Creates the complete consolidated configuration for attraction entity.
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Consolidated entity configuration for attraction
 */
export const createAttractionConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedEntityConfig => {
    return {
        sections: [
            createBasicInfoConsolidatedSection(),
            createStatesModerationConsolidatedSection()
        ],
        metadata: {
            title: t('admin-entities.entities.attraction.singular'),
            description: t('admin-entities.entities.attraction.description'),
            entityName: t('admin-entities.entities.attraction.singular'),
            entityNamePlural: t('admin-entities.entities.attraction.plural')
        }
    };
};
