import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import {
    createBasicInfoConsolidatedSection,
    createFlagsConsolidatedSection,
    createStatesConsolidatedSection
} from './sections';

/**
 * Consolidated configuration for Amenity entity
 * Combines all section configurations into a single object
 */
export interface AmenityConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Amenity entity.
 *
 * @param t - Translation function from `useTranslations()`
 */
export const createAmenityConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): AmenityConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createFlagsConsolidatedSection(),
        createStatesConsolidatedSection()
    ],
    metadata: {
        entityType: 'amenity',
        entityName: t('admin-entities.entities.amenity.singular'),
        entityNamePlural: t('admin-entities.entities.amenity.plural'),
        baseRoute: '/content/accommodation-amenities'
    }
});
