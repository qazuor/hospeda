import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Contact & Media section of event
 */
export const createContactMediaConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'contact-media',
    title: 'Contacto y Multimedia',
    description: 'Información de contacto y archivos multimedia',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_VIEW_ALL],
        edit: [PermissionEnum.EVENT_UPDATE]
    },
    fields: [
        {
            id: 'contact.email',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Email de Contacto',
            description: 'Correo electrónico para consultas',
            placeholder: 'contacto@evento.com',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                autocomplete: 'email',
                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            }
        },
        {
            id: 'contact.phone',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Teléfono de Contacto',
            description: 'Número de teléfono para consultas',
            placeholder: '+54 9 11 1234-5678',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                autocomplete: 'tel'
            }
        },
        {
            id: 'contact.website',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Sitio Web',
            description: 'URL del sitio web del evento',
            placeholder: 'https://www.evento.com',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url',
                pattern: '^https?:\\/\\/.*'
            }
        },
        {
            id: 'media.featuredImage',
            type: FieldTypeEnum.IMAGE,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Imagen Principal',
            description: 'Imagen destacada del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
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
            description: 'Imágenes adicionales del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                type: 'GALLERY',
                maxImages: 10,
                allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
            }
        }
    ]
});
