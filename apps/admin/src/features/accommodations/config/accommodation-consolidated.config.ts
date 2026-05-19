import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import type { useTranslations } from '@repo/i18n';
import type { ConsolidatedEntityConfig } from '../types/consolidated-config.types';
import { createAmenitiesConsolidatedSection } from './sections/amenities.consolidated';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';
import { createContactInfoConsolidatedSection } from './sections/contact-info.consolidated';
import { createGalleryConsolidatedSection } from './sections/gallery.consolidated';
import { createLocationInfoConsolidatedSection } from './sections/location-info.consolidated';
import { createStatesModerationConsolidatedSection } from './sections/states-moderation.consolidated';
import { createStatisticsConsolidatedSection } from './sections/statistics.consolidated';

/**
 * Crea la configuración consolidada completa para accommodation
 *
 * @param t - Función de traducción
 * @param accommodationTypeOptions - Opciones para el select de tipo
 * @returns Configuración consolidada de la entidad accommodation
 */
export const createAccommodationConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t'],
    accommodationTypeOptions: SelectOption[]
): ConsolidatedEntityConfig => {
    return {
        sections: [
            createBasicInfoConsolidatedSection(t, accommodationTypeOptions),
            createContactInfoConsolidatedSection(t),
            createLocationInfoConsolidatedSection(t),
            createStatesModerationConsolidatedSection(t),
            createAmenitiesConsolidatedSection(t),
            createGalleryConsolidatedSection(t),
            createStatisticsConsolidatedSection(t)
        ],
        metadata: {
            title: t('admin-entities.entities.accommodation.singular'),
            description: t('admin-entities.entities.accommodation.description'),
            entityName: t('admin-entities.entities.accommodation.singular'),
            entityNamePlural: t('admin-entities.entities.accommodation.plural')
        }
    };
};
