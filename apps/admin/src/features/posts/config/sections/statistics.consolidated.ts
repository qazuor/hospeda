import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Statistics section of post (read-only)
 */
export const createStatisticsConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'statistics',
    title: 'Estadísticas',
    description: 'Métricas de interacción del artículo',
    layout: LayoutTypeEnum.GRID,
    modes: ['view'],
    permissions: {
        view: [PermissionEnum.POST_VIEW_ALL],
        edit: []
    },
    fields: [
        {
            id: 'likes',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view'],
            label: 'Me Gusta',
            description: 'Cantidad de likes',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: []
            },
            typeConfig: {
                type: 'NUMBER',
                min: 0
            }
        },
        {
            id: 'comments',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view'],
            label: 'Comentarios',
            description: 'Cantidad de comentarios',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: []
            },
            typeConfig: {
                type: 'NUMBER',
                min: 0
            }
        },
        {
            id: 'shares',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view'],
            label: 'Compartidos',
            description: 'Cantidad de veces compartido',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: []
            },
            typeConfig: {
                type: 'NUMBER',
                min: 0
            }
        }
    ]
});
