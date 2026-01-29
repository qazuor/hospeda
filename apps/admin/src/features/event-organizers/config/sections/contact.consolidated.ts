import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Contact section of event organizer
 */
export const createContactConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'contact',
    title: 'Información de Contacto',
    description: 'Datos de contacto del organizador',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
        edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
    },
    fields: [
        {
            id: 'contactInfo.personalEmail',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Email Personal',
            description: 'Email personal del contacto',
            placeholder: 'contacto@ejemplo.com',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'email'
            }
        },
        {
            id: 'contactInfo.workEmail',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Email de Trabajo',
            description: 'Email de trabajo o institucional',
            placeholder: 'info@organizacion.com',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'email'
            }
        },
        {
            id: 'contactInfo.mobilePhone',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Teléfono Móvil',
            description: 'Número de teléfono móvil',
            placeholder: '+54 9 11 1234-5678',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'tel'
            }
        },
        {
            id: 'contactInfo.homePhone',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Teléfono Fijo',
            description: 'Número de teléfono fijo',
            placeholder: '+54 3442 12-3456',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'tel'
            }
        },
        {
            id: 'contactInfo.workPhone',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Teléfono de Trabajo',
            description: 'Número de teléfono de trabajo',
            placeholder: '+54 3442 98-7654',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'tel'
            }
        },
        {
            id: 'contactInfo.website',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Sitio Web',
            description: 'URL del sitio web del organizador',
            placeholder: 'https://www.ejemplo.com',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                autocomplete: 'url'
            }
        }
    ]
});
