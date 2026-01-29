import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum, PostCategoryEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Basic Info section of post
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Detalles principales del artículo',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POST_VIEW_ALL],
        edit: [PermissionEnum.POST_UPDATE]
    },
    fields: [
        {
            id: 'title',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Título',
            description: 'Título del artículo',
            placeholder: 'Ingresa el título del artículo',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                maxLength: 150,
                minLength: 3
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description: 'URL amigable para el artículo',
            placeholder: 'titulo-del-articulo',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_SLUG_MANAGE]
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
            description: 'Resumen breve del artículo',
            placeholder: 'Escribe un resumen del artículo',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 300,
                minLength: 10
            }
        },
        {
            id: 'category',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Categoría',
            description: 'Categoría del artículo',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                options: Object.values(PostCategoryEnum).map((value) => ({
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
            description: 'Marcar como artículo destacado',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_FEATURED_TOGGLE]
            },
            typeConfig: {}
        },
        {
            id: 'isFeaturedInWebsite',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Destacado en Web',
            description: 'Mostrar en sección destacada del sitio web',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_FEATURED_TOGGLE]
            },
            typeConfig: {}
        },
        {
            id: 'isNews',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Es Noticia',
            description: 'Marcar como noticia',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {}
        }
    ]
});
