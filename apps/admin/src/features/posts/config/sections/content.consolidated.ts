import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Content section of post
 */
export const createContentConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'content',
    title: 'Contenido',
    description: 'Contenido principal del artículo',
    layout: LayoutTypeEnum.LIST,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POST_VIEW_ALL],
        edit: [PermissionEnum.POST_UPDATE]
    },
    fields: [
        {
            id: 'content',
            type: FieldTypeEnum.RICH_TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Contenido',
            description: 'Contenido completo del artículo',
            placeholder: 'Escribe el contenido del artículo...',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                type: 'RICH_TEXT',
                maxLength: 50000,
                minLength: 100
            }
        },
        {
            id: 'readingTimeMinutes',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Tiempo de Lectura',
            description: 'Tiempo estimado de lectura en minutos',
            placeholder: '5',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                type: 'NUMBER',
                min: 1,
                max: 120,
                step: 1
            }
        }
    ]
});
