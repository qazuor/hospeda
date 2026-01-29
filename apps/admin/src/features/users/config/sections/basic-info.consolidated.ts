import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Basic Info section of user
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Datos personales del usuario',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.USER_READ_ALL],
        edit: [PermissionEnum.USER_UPDATE_ROLES]
    },
    fields: [
        {
            id: 'displayName',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre de Usuario',
            description: 'Nombre público del usuario',
            placeholder: 'Ingresa el nombre de usuario',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_PROFILE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description: 'Identificador único del usuario',
            placeholder: 'nombre-usuario',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.MANAGE_USERS]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 1,
                pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            }
        },
        {
            id: 'firstName',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre del usuario',
            placeholder: 'Juan',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_PROFILE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'lastName',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Apellido',
            description: 'Apellido del usuario',
            placeholder: 'Pérez',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_PROFILE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'birthDate',
            type: FieldTypeEnum.DATE,
            required: false,
            modes: ['view', 'edit'],
            label: 'Fecha de Nacimiento',
            description: 'Fecha de nacimiento del usuario',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_PROFILE]
            },
            typeConfig: {
                type: 'DATE',
                showTime: false
            }
        }
    ]
});
