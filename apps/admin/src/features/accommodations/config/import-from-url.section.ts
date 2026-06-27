/**
 * Configuration factory for the "Import from URL" consolidated section.
 *
 * This section uses the `customRender` escape hatch — it has no standard
 * fields. The actual UI is rendered by {@link ImportFromUrlSection}.
 *
 * It is visible in `edit` and `create` modes only (not `view`), positioned
 * near the top of the form so admins can prefill data before filling details.
 * It is collapsible and collapsed by default to avoid visual noise.
 *
 * @module import-from-url.section
 */

import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { ImportFromUrlSection } from '@/features/accommodations/components/ImportFromUrlSection';
import type { useTranslations } from '@repo/i18n';
import { createElement } from 'react';
import type { ConsolidatedSectionConfig } from '../types/consolidated-config.types';

/**
 * Creates the "Import from URL" section config for the consolidated
 * accommodation form.
 *
 * @param t - Translation function from `useTranslations()`.
 * @returns A `ConsolidatedSectionConfig` with `customRender` and no fields.
 */
export const createImportFromUrlSection = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => ({
    id: 'import-from-url',
    title: t('host.importFromUrl.prefill.sectionToggle' as Parameters<typeof t>[0]),
    layout: LayoutTypeEnum.GRID,
    modes: ['edit', 'create'],
    fields: [],
    collapsible: true,
    defaultCollapsed: true,
    customRender: () => createElement(ImportFromUrlSection)
});
