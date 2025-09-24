import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Contact Info de accommodation
 *
 * @param t - Función de traducción
 * @returns Configuración consolidada de la sección contact-info
 */
export const createContactInfoConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => ({
    id: 'contact-info',
    title: 'Información de Contacto',
    description: 'Datos de contacto del alojamiento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'], // Visible en todos los modos
    permissions: {
        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
        edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
    },
    fields: [
        {
            id: 'phone',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Teléfono',
            description: 'Número de teléfono principal',
            placeholder: '+54 11 1234-5678',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
            },
            typeConfig: {}
        },
        {
            id: 'email',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Email',
            description: 'Dirección de correo electrónico',
            placeholder: 'contacto@alojamiento.com',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
            },
            typeConfig: {}
        },
        {
            id: 'website',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Sitio Web',
            description: 'URL del sitio web oficial',
            placeholder: 'https://www.alojamiento.com',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
            },
            typeConfig: {}
        },
        {
            id: 'whatsapp',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'WhatsApp',
            description: 'Número de WhatsApp',
            placeholder: '+54 11 1234-5678',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT]
            },
            typeConfig: {}
        }
    ]
});
