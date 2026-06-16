import type { ConsolidatedEntityConfig } from '@/features/accommodations/types/consolidated-config.types';
import type { useTranslations } from '@repo/i18n';
import { createBasicInfoConsolidatedSection } from './sections';

/**
 * Creates the complete consolidated configuration for the host-trade entity.
 *
 * Used by `EntityCreatePageBase` (create flow) and `EntityPageBase` (view/edit flow).
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Consolidated entity configuration
 */
export const createHostTradeConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedEntityConfig => ({
    sections: [createBasicInfoConsolidatedSection()],
    metadata: {
        title: t('admin-entities.entities.hostTrade.singular'),
        description: t('admin-entities.entities.hostTrade.description'),
        entityName: t('admin-entities.entities.hostTrade.singular'),
        entityNamePlural: t('admin-entities.entities.hostTrade.plural')
    }
});
