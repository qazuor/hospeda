import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Consolidated configuration for the Statistics section of destination
 * This section is view-only - statistics are calculated automatically
 */
export const createStatisticsConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'statistics',
    title: 'Estadísticas',
    description: 'Métricas y estadísticas del destino',
    layout: LayoutTypeEnum.GRID,
    modes: ['view'], // Statistics are read-only
    permissions: {
        view: [PermissionEnum.DESTINATION_VIEW_ALL]
    },
    fields: [
        {
            id: 'accommodationsCount',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view'],
            label: 'Total de Alojamientos',
            description: 'Cantidad de alojamientos en este destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL]
            },
            typeConfig: {}
        },
        {
            id: 'reviewsCount',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view'],
            label: 'Total de Reseñas',
            description: 'Cantidad de reseñas del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL]
            },
            typeConfig: {}
        },
        {
            id: 'averageRating',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view'],
            label: 'Calificación Promedio',
            description: 'Calificación promedio del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL]
            },
            typeConfig: {
                min: 0,
                max: 5,
                step: 0.1
            }
        }
    ]
});
