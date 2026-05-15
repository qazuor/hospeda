import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';

// Spanish enum labels (SPEC-117 D-USERS.3 / D-DROPDOWN.1).
const VISIBILITY_LABELS: Record<string, string> = {
    PUBLIC: 'Público',
    PRIVATE: 'Privado',
    RESTRICTED: 'Restringido',
    HIDDEN: 'Oculto'
};
const LIFECYCLE_LABELS: Record<string, string> = {
    DRAFT: 'Borrador',
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    ARCHIVED: 'Archivado',
    DELETED: 'Eliminado'
};

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
                    label: VISIBILITY_LABELS[value] ?? value
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
                    label: LIFECYCLE_LABELS[value] ?? value
                }))
            }
        }
    ]
});
