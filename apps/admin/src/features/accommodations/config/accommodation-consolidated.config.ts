import { LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { EntityViewStatChips } from '@/components/views/EntityViewStatChips';
import type { useTranslations } from '@repo/i18n';
import { createElement } from 'react';
import type {
    ConsolidatedEntityConfig,
    ConsolidatedSectionConfig
} from '../types/consolidated-config.types';
import { createAmenitiesConsolidatedSection } from './sections/amenities.consolidated';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';
import { createContactInfoConsolidatedSection } from './sections/contact-info.consolidated';
import { createGalleryConsolidatedSection } from './sections/gallery.consolidated';
import { createLocationInfoConsolidatedSection } from './sections/location-info.consolidated';
import { createStatesModerationConsolidatedSection } from './sections/states-moderation.consolidated';
import { createStatisticsConsolidatedSection } from './sections/statistics.consolidated';

/**
 * Creates the view-stat chips section for accommodations (SPEC-197 T-016).
 *
 * This section renders `EntityViewStatChips` via `customRender` — it has no
 * fields. It is view-mode only and positioned before the main content sections.
 * The component itself guards the fetch on `ANALYTICS_VIEW` permission.
 *
 * @param entityId - UUID of the accommodation being viewed.
 */
const createViewStatChipsSection = (entityId: string): ConsolidatedSectionConfig => ({
    id: 'view-stat-chips',
    layout: LayoutTypeEnum.GRID,
    modes: ['view'],
    fields: [],
    customRender: () =>
        createElement(EntityViewStatChips, {
            entityId,
            entityType: 'ACCOMMODATION'
        })
});

/**
 * Crea la configuración consolidada completa para accommodation
 *
 * @param t - Función de traducción
 * @param accommodationTypeOptions - Opciones para el select de tipo
 * @param entityId - UUID del accommodation (para la sección de chips de vistas)
 * @returns Configuración consolidada de la entidad accommodation
 */
export const createAccommodationConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t'],
    accommodationTypeOptions: SelectOption[],
    entityId?: string
): ConsolidatedEntityConfig => {
    const sections = [
        ...(entityId ? [createViewStatChipsSection(entityId)] : []),
        createBasicInfoConsolidatedSection(t, accommodationTypeOptions),
        createContactInfoConsolidatedSection(t),
        createLocationInfoConsolidatedSection(t),
        createStatesModerationConsolidatedSection(t),
        createAmenitiesConsolidatedSection(t),
        createGalleryConsolidatedSection(t),
        createStatisticsConsolidatedSection(t)
    ];

    return {
        sections,
        metadata: {
            title: t('admin-entities.entities.accommodation.singular'),
            description: t('admin-entities.entities.accommodation.description'),
            entityName: t('admin-entities.entities.accommodation.singular'),
            entityNamePlural: t('admin-entities.entities.accommodation.plural')
        }
    };
};
