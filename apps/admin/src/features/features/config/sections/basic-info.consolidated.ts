import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Basic Info section configuration for Feature entity
 * Contains: name, slug, description, icon
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Datos principales de la característica',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.FEATURE_CREATE],
        edit: [PermissionEnum.FEATURE_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre de la característica',
            placeholder: 'Ej: Vista al Mar, Jacuzzi Privado',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 2
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Slug',
            description: 'Identificador único para URLs',
            placeholder: 'vista-al-mar',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
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
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción detallada de la característica',
            placeholder: 'Describe qué incluye esta característica',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 500,
                minLength: 10
            }
        },
        {
            id: 'icon',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Icono',
            description: 'Nombre del icono a mostrar',
            placeholder: 'beach-umbrella',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                maxLength: 100
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
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {
                min: 1,
                max: 100,
                step: 1
            }
        }
    ]
});
