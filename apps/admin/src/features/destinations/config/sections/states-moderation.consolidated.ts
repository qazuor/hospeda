import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

// Spanish enum labels (SPEC-117 D-DROPDOWN.1). Hardcoded ES until the
// configs migrate to a `t` parameter signature; mirrors the rest of this
// file which also hardcodes ES strings.
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
 * Consolidated configuration for the States section of destination
 * NOTE: DestinationSchema has visibility (via BaseVisibilityFields) and lifecycleState,
 * but does NOT have moderationState
 */
export const createStatesModerationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states-moderation',
    title: 'Estado y Visibilidad',
    description: 'Configuración de visibilidad y ciclo de vida',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.DESTINATION_VIEW_ALL],
        edit: [PermissionEnum.DESTINATION_VISIBILITY_TOGGLE]
    },
    fields: [
        {
            id: 'visibility',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Visibilidad',
            description: 'Nivel de visibilidad del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_VISIBILITY_TOGGLE]
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
            modes: ['view', 'edit', 'create'],
            label: 'Estado del Ciclo de Vida',
            description: 'Estado actual del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
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
