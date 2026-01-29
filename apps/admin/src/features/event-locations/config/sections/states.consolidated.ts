import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the States section of event location
 */
export const createStatesConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states',
    title: 'Estados',
    description: 'Estado y visibilidad de la ubicación',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.EVENT_LOCATION_VIEW],
        edit: [PermissionEnum.EVENT_LOCATION_MANAGE]
    },
    fields: [
        {
            id: 'lifecycleState',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Estado de Ciclo de Vida',
            description: 'Estado actual del registro',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_MANAGE]
            },
            typeConfig: {
                options: [
                    { value: LifecycleStatusEnum.DRAFT, label: 'Borrador' },
                    { value: LifecycleStatusEnum.ACTIVE, label: 'Activo' },
                    { value: LifecycleStatusEnum.ARCHIVED, label: 'Archivado' }
                ]
            }
        },
        {
            id: 'visibility',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Visibilidad',
            description: 'Quién puede ver esta ubicación',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_MANAGE]
            },
            typeConfig: {
                options: [
                    { value: VisibilityEnum.PUBLIC, label: 'Público' },
                    { value: VisibilityEnum.PRIVATE, label: 'Privado' },
                    { value: VisibilityEnum.RESTRICTED, label: 'Restringido' }
                ]
            }
        }
    ]
});
