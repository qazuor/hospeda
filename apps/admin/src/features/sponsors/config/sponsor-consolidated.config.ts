import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import {
    createBasicInfoConsolidatedSection,
    createContactConsolidatedSection,
    createSocialConsolidatedSection,
    createStatesConsolidatedSection
} from './sections';

/**
 * Consolidated configuration for Sponsor entity
 * Combines all section configurations into a single object
 */
export interface SponsorConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Sponsor entity.
 *
 * @param t - Translation function from `useTranslations()`
 */
export const createSponsorConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): SponsorConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createContactConsolidatedSection(),
        createSocialConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'sponsor',
        entityName: t('admin-entities.entities.sponsor.singular'),
        entityNamePlural: t('admin-entities.entities.sponsor.plural'),
        baseRoute: '/sponsors'
    }
});
