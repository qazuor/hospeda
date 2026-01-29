import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Media section of post
 */
export const createMediaConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'media',
    title: 'Medios',
    description: 'Imágenes del artículo',
    layout: LayoutTypeEnum.LIST,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POST_VIEW_ALL],
        edit: [PermissionEnum.POST_UPDATE]
    },
    fields: [
        {
            id: 'media.featuredImage',
            type: FieldTypeEnum.IMAGE,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Imagen Destacada',
            description: 'Imagen principal del artículo',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                type: 'IMAGE',
                allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
                maxSize: 5 * 1024 * 1024 // 5MB
            }
        },
        {
            id: 'media.gallery',
            type: FieldTypeEnum.GALLERY,
            required: false,
            modes: ['view', 'edit'],
            label: 'Galería de Imágenes',
            description: 'Imágenes adicionales del artículo',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                type: 'GALLERY',
                maxImages: 15,
                allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
            }
        }
    ]
});
