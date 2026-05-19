import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import {
    createBasicInfoConsolidatedSection,
    createFlagsConsolidatedSection,
    createStatesConsolidatedSection
} from './sections';

/**
 * Consolidated configuration for Feature entity
 * Combines all section configurations into a single object
 */
export interface FeatureConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Feature entity.
 *
 * @param t - Translation function from `useTranslations()`
 */
export const createFeatureConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): FeatureConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createFlagsConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'feature',
        entityName: t('admin-entities.entities.feature.singular'),
        entityNamePlural: t('admin-entities.entities.feature.plural'),
        baseRoute: '/content/accommodation-features'
    }
});
