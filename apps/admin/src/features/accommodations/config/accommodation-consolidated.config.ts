import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import type { useTranslations } from '@repo/i18n';
import type { ConsolidatedEntityConfig } from '../types/consolidated-config.types';
import { createBasicInfoConsolidatedSection } from './sections/basic-info.consolidated';

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
            // Por ahora solo basic-info, iremos agregando más secciones paso a paso
            createBasicInfoConsolidatedSection(t, accommodationTypeOptions)
        ],
        metadata: {
            title: 'Accommodation',
            description: 'Manage accommodation details',
            entityName: 'Accommodation',
            entityNamePlural: 'Accommodations'
        }
    };
};
