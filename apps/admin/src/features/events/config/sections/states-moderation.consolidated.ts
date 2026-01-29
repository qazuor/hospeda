import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';

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
                    label: value.charAt(0) + value.slice(1).toLowerCase()
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
                    label: value.charAt(0) + value.slice(1).toLowerCase()
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
                    label: value.charAt(0) + value.slice(1).toLowerCase()
                }))
            }
        }
    ]
});
