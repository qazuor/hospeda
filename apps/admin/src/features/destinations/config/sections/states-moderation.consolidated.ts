import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Consolidated configuration for the States & Moderation section of destination
 */
export const createStatesModerationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states-moderation',
    title: 'Estados y Moderación',
    description: 'Configuración de visibilidad, ciclo de vida y moderación',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.DESTINATION_VIEW_ALL],
        edit: [PermissionEnum.DESTINATION_VISIBILITY_TOGGLE]
    },
    fields: [
        {
            id: 'visibility',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Visibilidad',
            description: 'Nivel de visibilidad del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_VISIBILITY_TOGGLE]
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
            description: 'Estado actual del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
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
            description: 'Estado de moderación del destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_REVIEW_MODERATE]
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
