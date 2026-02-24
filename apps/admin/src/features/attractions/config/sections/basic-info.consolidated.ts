import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Basic Info section of attraction
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Detalles principales de la atracción',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.ATTRACTION_VIEW],
        edit: [PermissionEnum.ATTRACTION_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre de la atracción',
            placeholder: 'Ingresa el nombre de la atracción',
            permissions: {
                view: [PermissionEnum.ATTRACTION_VIEW],
                edit: [PermissionEnum.ATTRACTION_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 3
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description: 'URL amigable para la atracción',
            placeholder: 'nombre-de-la-atraccion',
            permissions: {
                view: [PermissionEnum.ATTRACTION_VIEW],
                edit: [PermissionEnum.ATTRACTION_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 3,
                pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            }
        },
        {
            id: 'description',
            type: FieldTypeEnum.TEXTAREA,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción de la atracción',
            placeholder: 'Describe la atracción',
            permissions: {
                view: [PermissionEnum.ATTRACTION_VIEW],
                edit: [PermissionEnum.ATTRACTION_UPDATE]
            },
            typeConfig: {
                minRows: 3,
                maxLength: 500,
                minLength: 10
            }
        },
        {
            id: 'icon',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Icono',
            description: 'Nombre del icono para la atracción',
            placeholder: 'mountain',
            permissions: {
                view: [PermissionEnum.ATTRACTION_VIEW],
                edit: [PermissionEnum.ATTRACTION_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 1
            }
        },
        {
            id: 'displayWeight',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Peso de Visualización',
            description:
                'Prioridad de visualización (1-100). Mayor valor = aparece primero en tarjetas',
            placeholder: '50',
            permissions: {
                view: [PermissionEnum.ATTRACTION_VIEW],
                edit: [PermissionEnum.ATTRACTION_UPDATE]
            },
            typeConfig: {
                min: 1,
                max: 100,
                step: 1
            }
        },
        {
            id: 'isFeatured',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Destacado',
            description: 'Marcar como atracción destacada',
            permissions: {
                view: [PermissionEnum.ATTRACTION_VIEW],
                edit: [PermissionEnum.ATTRACTION_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'isBuiltin',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view'],
            label: 'Integrado',
            description: 'Indica si es una atracción del sistema',
            permissions: {
                view: [PermissionEnum.ATTRACTION_VIEW],
                edit: []
            },
            typeConfig: {}
        }
    ]
});
