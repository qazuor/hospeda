import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';

// Spanish enum labels (SPEC-117 D-DROPDOWN.1).
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
const MODERATION_LABELS: Record<string, string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobado',
    REJECTED: 'Rechazado',
    UNDER_REVIEW: 'En revisión'
};

/**
 * Consolidated configuration for the States & Moderation section of event
 */
export const createStatesModerationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states-moderation',
    title: 'Estados y Moderación',
    description: 'Configuración de visibilidad, ciclo de vida y moderación',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.EVENT_VIEW_ALL],
        edit: [PermissionEnum.EVENT_UPDATE]
    },
    fields: [
        {
            id: 'visibility',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Visibilidad',
            description: 'Nivel de visibilidad del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_PUBLISH_TOGGLE]
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
            label: 'Estado del Ciclo de Vida',
            description: 'Estado actual del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                options: Object.values(LifecycleStatusEnum).map((value) => ({
                    value,
                    label: LIFECYCLE_LABELS[value] ?? value
                }))
            }
        },
        {
            id: 'moderationState',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Estado de Moderación',
            description: 'Estado de moderación del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                options: Object.values(ModerationStatusEnum).map((value) => ({
                    value,
                    label: MODERATION_LABELS[value] ?? value
                }))
            }
        }
    ]
});
