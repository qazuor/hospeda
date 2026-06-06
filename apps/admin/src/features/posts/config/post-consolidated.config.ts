import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntityViewStatChips } from '@/components/views/EntityViewStatChips';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import { createElement } from 'react';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';
import { createContentConsolidatedSection } from './sections/content.consolidated';
import { createMediaConsolidatedSection } from './sections/media.consolidated';
import { createRelationsConsolidatedSection } from './sections/relations.consolidated';
import { createStatesModerationConsolidatedSection } from './sections/states-moderation.consolidated';
import { createStatisticsConsolidatedSection } from './sections/statistics.consolidated';

/**
 * Creates the view-stat chips section for posts (SPEC-197 T-016).
 *
 * @param entityId - UUID of the post being viewed.
 */
const createViewStatChipsSection = (entityId: string): ConsolidatedSectionConfig => ({
    id: 'view-stat-chips',
    layout: LayoutTypeEnum.GRID,
    modes: ['view'],
    fields: [],
    customRender: () =>
        createElement(EntityViewStatChips, {
            entityId,
            entityType: 'POST'
        })
});

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
 * @param entityId - UUID of the post (for the view-stat chips section).
 */
export const createPostConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t'],
    entityId?: string
): PostConsolidatedConfig => ({
    sections: [
        ...(entityId ? [createViewStatChipsSection(entityId)] : []),
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
