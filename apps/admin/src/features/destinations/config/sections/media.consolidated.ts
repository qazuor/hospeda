import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Consolidated configuration for the Media section of destination
 */
export const createMediaConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'media',
    title: 'Medios',
    description: 'Imágenes y galería del destino',
    layout: LayoutTypeEnum.LIST,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.DESTINATION_VIEW_ALL],
        edit: [PermissionEnum.DESTINATION_GALLERY_MANAGE]
    },
    fields: [
        {
            id: 'media.featuredImage',
            type: FieldTypeEnum.IMAGE,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Imagen Destacada',
            description: 'Imagen principal del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_GALLERY_MANAGE]
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
            description: 'Imágenes adicionales del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_GALLERY_MANAGE]
            },
            typeConfig: {
                type: 'GALLERY',
                allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
                maxSize: 5 * 1024 * 1024, // 5MB per image
                maxImages: 20
            }
        }
    ]
});
