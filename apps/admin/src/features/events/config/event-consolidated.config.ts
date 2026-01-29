import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
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
 * Creates the complete consolidated configuration for the Event entity
 */
export const createEventConsolidatedConfig = (): EventConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createDatePricingConsolidatedSection(),
        createContactMediaConsolidatedSection(),
        createRelationsConsolidatedSection(),
        createStatesModerationConsolidatedSection()
    ],
    metadata: {
        entityType: 'event',
        entityName: 'Evento',
        entityNamePlural: 'Eventos',
        baseRoute: '/events'
    }
});
