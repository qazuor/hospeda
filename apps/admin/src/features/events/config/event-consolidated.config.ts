import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntityViewStatChips } from '@/components/views/EntityViewStatChips';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import { createElement } from 'react';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';
import { createContactMediaConsolidatedSection } from './sections/contact-media.consolidated';
import { createDatePricingConsolidatedSection } from './sections/date-pricing.consolidated';
import { createRelationsConsolidatedSection } from './sections/relations.consolidated';
import { createStatesModerationConsolidatedSection } from './sections/states-moderation.consolidated';

/**
 * Creates the view-stat chips section for events (SPEC-197 T-016).
 *
 * `defaultCollapsed: false` ensures the accordion opens this section by default
 * regardless of its position after permission-based anchor reordering (AC-17).
 *
 * @param t - Translation function from `useTranslations()`.
 * @param entityId - UUID of the event being viewed.
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
            entityType: 'EVENT'
        })
});

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
 * @param entityId - UUID of the event (for the view-stat chips section).
 */
export const createEventConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t'],
    entityId?: string
): EventConsolidatedConfig => ({
    sections: [
        ...(entityId ? [createViewStatChipsSection(t, entityId)] : []),
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
