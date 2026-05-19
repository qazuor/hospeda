import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';
import { createContactMediaConsolidatedSection } from './sections/contact-media.consolidated';
import { createDatePricingConsolidatedSection } from './sections/date-pricing.consolidated';
import { createRelationsConsolidatedSection } from './sections/relations.consolidated';
import { createStatesModerationConsolidatedSection } from './sections/states-moderation.consolidated';

/**
 * Consolidated configuration for Events entity
 * Combines all section configurations into a single object
 */
export interface EventConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Event entity.
 *
 * @param t - Translation function from `useTranslations()`
 */
export const createEventConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): EventConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createDatePricingConsolidatedSection(),
        createContactMediaConsolidatedSection(),
        createRelationsConsolidatedSection(),
        createStatesModerationConsolidatedSection()
    ],
    metadata: {
        entityType: 'event',
        entityName: t('admin-entities.entities.event.singular'),
        entityNamePlural: t('admin-entities.entities.event.plural'),
        baseRoute: '/events'
    }
});
