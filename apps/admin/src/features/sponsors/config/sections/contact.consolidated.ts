import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Contact section configuration for Sponsor entity
 * Contains: personalEmail, workEmail, mobilePhone, homePhone, workPhone, website
 */
export const createContactConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'contact',
    title: 'Información de Contacto',
    description: 'Datos de contacto del patrocinador',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POST_SPONSOR_VIEW],
        edit: [PermissionEnum.POST_SPONSOR_UPDATE]
    },
    fields: [
        {
            id: 'contactInfo.personalEmail',
            type: FieldTypeEnum.EMAIL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Email Personal',
            description: 'Correo electrónico personal',
            placeholder: 'contacto@ejemplo.com',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'contactInfo.workEmail',
            type: FieldTypeEnum.EMAIL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Email de Trabajo',
            description: 'Correo electrónico comercial',
            placeholder: 'empresa@ejemplo.com',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'contactInfo.mobilePhone',
            type: FieldTypeEnum.PHONE,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Teléfono Móvil',
            description: 'Número de teléfono móvil',
            placeholder: '+54 9 11 1234-5678',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'contactInfo.workPhone',
            type: FieldTypeEnum.PHONE,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Teléfono de Trabajo',
            description: 'Número de teléfono de oficina',
            placeholder: '+54 343 123-4567',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'contactInfo.website',
            type: FieldTypeEnum.URL,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Sitio Web',
            description: 'URL del sitio web',
            placeholder: 'https://www.ejemplo.com',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        }
    ]
});
