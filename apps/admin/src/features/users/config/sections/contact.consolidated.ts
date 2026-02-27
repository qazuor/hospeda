import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Contact section of user
 */
export const createContactConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'contact',
    title: 'Contacto',
    description: 'Información de contacto del usuario',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.USER_READ_ALL],
        edit: [PermissionEnum.USER_UPDATE_PROFILE]
    },
    fields: [
        {
            id: 'email',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Email',
            description: 'Correo electrónico del usuario',
            placeholder: 'usuario@ejemplo.com',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_PROFILE]
            },
            typeConfig: {
                autocomplete: 'email',
                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            }
        },
        {
            id: 'phone',
            type: FieldTypeEnum.TEXT,
            required: false,
            // NOTE: phone is stored inside contactInfo JSONB, not as a direct field.
            // Excluded from create/edit until proper contactInfo mapping is implemented.
            modes: ['view'],
            label: 'Teléfono',
            description: 'Número de teléfono',
            placeholder: '+54 9 11 1234-5678',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_PROFILE]
            },
            typeConfig: {
                autocomplete: 'tel'
            }
        },
        {
            id: 'website',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit'],
            label: 'Sitio Web',
            description: 'Sitio web personal',
            placeholder: 'https://www.ejemplo.com',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_PROFILE]
            },
            typeConfig: {
                autocomplete: 'url',
                pattern: '^https?:\\/\\/.*'
            }
        }
    ]
});
