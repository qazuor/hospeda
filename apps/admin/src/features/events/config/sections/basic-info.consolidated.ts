import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { EventCategoryEnum, PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Basic Info section of event
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Detalles principales del evento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_VIEW_ALL],
        edit: [PermissionEnum.EVENT_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre del evento',
            placeholder: 'Ingresa el nombre del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                maxLength: 200,
                minLength: 3
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description: 'URL amigable para el evento',
            placeholder: 'nombre-del-evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_SLUG_MANAGE]
            },
            typeConfig: {
                maxLength: 200,
                minLength: 3,
                pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            }
        },
        {
            id: 'summary',
            type: FieldTypeEnum.TEXTAREA,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Resumen',
            description: 'Resumen breve del evento',
            placeholder: 'Escribe un resumen del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
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
            description: 'Descripción completa del evento',
            placeholder: 'Describe el evento en detalle',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                minRows: 4,
                maxLength: 5000,
                minLength: 50
            }
        },
        {
            id: 'category',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Categoría',
            description: 'Categoría del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                options: Object.values(EventCategoryEnum).map((value) => ({
                    value,
                    label: value.charAt(0) + value.slice(1).toLowerCase()
                }))
            }
        },
        {
            id: 'isFeatured',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Destacado',
            description: 'Marcar como evento destacado',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_FEATURED_TOGGLE]
            },
            typeConfig: {}
        }
    ]
});
