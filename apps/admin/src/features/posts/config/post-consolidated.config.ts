import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';
import { createContentConsolidatedSection } from './sections/content.consolidated';
import { createMediaConsolidatedSection } from './sections/media.consolidated';
import { createRelationsConsolidatedSection } from './sections/relations.consolidated';
import { createStatesModerationConsolidatedSection } from './sections/states-moderation.consolidated';
import { createStatisticsConsolidatedSection } from './sections/statistics.consolidated';

/**
 * Consolidated configuration for Posts entity
 * Combines all section configurations into a single object
 */
export interface PostConsolidatedConfig {
    sections: ConsolidatedSectionConfig[];
    metadata: {
        entityType: string;
        entityName: string;
        entityNamePlural: string;
        baseRoute: string;
    };
}

/**
 * Creates the complete consolidated configuration for the Post entity.
 *
 * @param t - Translation function from `useTranslations()`
 */
export const createPostConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): PostConsolidatedConfig => ({
    sections: [
        createBasicInfoConsolidatedSection(),
        createContentConsolidatedSection(),
        createMediaConsolidatedSection(),
        createRelationsConsolidatedSection(),
        createStatesModerationConsolidatedSection(),
        createStatisticsConsolidatedSection()
    ],
    metadata: {
        entityType: 'post',
        entityName: t('admin-entities.entities.post.singular'),
        entityNamePlural: t('admin-entities.entities.post.plural'),
        baseRoute: '/posts'
    }
});
