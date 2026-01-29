import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Consolidated configuration for the Basic Info section of destination
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Detalles principales del destino',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.DESTINATION_VIEW_ALL],
        edit: [PermissionEnum.DESTINATION_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre del destino turístico',
            placeholder: 'Ingresa el nombre del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 3
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description: 'URL amigable para el destino',
            placeholder: 'nombre-del-destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_SLUG_MANAGE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 3,
                pattern: '^[a-z0-9-]+$'
            }
        },
        {
            id: 'summary',
            type: FieldTypeEnum.TEXTAREA,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Resumen',
            description: 'Descripción breve del destino',
            placeholder: 'Breve resumen del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 300,
                minLength: 10
            }
        },
        {
            id: 'description',
            type: FieldTypeEnum.TEXTAREA,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción detallada del destino',
            placeholder: 'Descripción completa del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                minRows: 4,
                maxLength: 2000,
                minLength: 30
            }
        },
        {
            id: 'isFeatured',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Destacado',
            description: 'Marcar como destino destacado',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_FEATURED_TOGGLE]
            },
            typeConfig: {}
        }
    ]
});
