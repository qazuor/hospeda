import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the States section of user
 */
export const createStatesConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states',
    title: 'Estados',
    description: 'Configuración de visibilidad y ciclo de vida',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.USER_READ_ALL],
        edit: [PermissionEnum.MANAGE_USERS]
    },
    fields: [
        {
            id: 'visibility',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Visibilidad',
            description: 'Nivel de visibilidad del perfil',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_PROFILE]
            },
            typeConfig: {
                options: Object.values(VisibilityEnum).map((value) => ({
                    value,
                    label: value.charAt(0) + value.slice(1).toLowerCase()
                }))
            }
        },
        {
            id: 'lifecycleState',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Estado de Cuenta',
            description: 'Estado actual de la cuenta',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.MANAGE_USERS]
            },
            typeConfig: {
                options: Object.values(LifecycleStatusEnum).map((value) => ({
                    value,
                    label: value.charAt(0) + value.slice(1).toLowerCase()
                }))
            }
        }
    ]
});
