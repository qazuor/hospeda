import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Basic Info section of event organizer
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Detalles principales del organizador',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
        edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre del organizador de eventos',
            placeholder: 'Ej: Municipalidad de Concepción del Uruguay',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
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
            description: 'URL amigable para el organizador',
            placeholder: 'municipalidad-cdu',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 3,
                pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            }
        },
        {
            id: 'description',
            type: FieldTypeEnum.TEXTAREA,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción del organizador',
            placeholder: 'Breve descripción del organizador de eventos',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                minRows: 3,
                maxLength: 500,
                minLength: 10
            }
        },
        {
            id: 'logo',
            type: FieldTypeEnum.IMAGE,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Logo',
            description: 'Logo del organizador',
            permissions: {
                view: [PermissionEnum.EVENT_ORGANIZER_VIEW],
                edit: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
            },
            typeConfig: {
                type: 'IMAGE',
                allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
                maxSize: 2 * 1024 * 1024 // 2MB
            }
        }
    ]
});
