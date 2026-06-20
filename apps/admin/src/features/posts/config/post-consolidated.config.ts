import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntityViewStatChips } from '@/components/views/EntityViewStatChips';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { AiPostGeneratePanel } from '@/features/posts/components/AiPostGeneratePanel';
import type { useTranslations } from '@repo/i18n';
import { createElement } from 'react';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';
import { createContentConsolidatedSection } from './sections/content.consolidated';
import { createMediaConsolidatedSection } from './sections/media.consolidated';
import { createRelationsConsolidatedSection } from './sections/relations.consolidated';
import { createStatesModerationConsolidatedSection } from './sections/states-moderation.consolidated';
import { createStatisticsConsolidatedSection } from './sections/statistics.consolidated';

/**
 * Creates the AI post-generation panel section (SPEC-223 T-010).
 *
 * Rendered as a `customRender` section so the panel component can access
 * `useEntityFormContext().setFieldValue` to populate title/summary/content
 * directly — no callback threading through route files needed.
 *
 * `defaultCollapsed: true` keeps the accordion closed by default so editors
 * who do not want AI assistance are not distracted.
 *
 * @param t - Translation function from `useTranslations()`.
 */
const createAiGenerateSection = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => ({
    id: 'ai-generate',
    title: t('posts.aiGenerate.panelTitle' as Parameters<typeof t>[0]),
    layout: LayoutTypeEnum.GRID,
    modes: ['create', 'edit'],
    fields: [],
    defaultCollapsed: true,
    customRender: () => createElement(AiPostGeneratePanel)
});

/**
 * Creates the view-stat chips section for posts (SPEC-197 T-016).
 *
 * `defaultCollapsed: false` ensures the accordion opens this section by default
 * regardless of its position after permission-based anchor reordering (AC-17).
 *
 * @param t - Translation function from `useTranslations()`.
 * @param entityId - UUID of the post being viewed.
 */
const createViewStatChipsSection = (
    t: ReturnType<typeof useTranslations>['t'],
    entityId: string
): ConsolidatedSectionConfig => ({
    id: 'view-stat-chips',
    title: t('admin-entities.detail.viewStats.sectionTitle' as Parameters<typeof t>[0]),
    layout: LayoutTypeEnum.GRID,
    modes: ['view'],
    fields: [],
    defaultCollapsed: false,
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
        ...(entityId ? [createViewStatChipsSection(t, entityId)] : []),
        createAiGenerateSection(t),
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
