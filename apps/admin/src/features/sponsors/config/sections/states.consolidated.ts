import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';

/**
 * States section configuration for Sponsor entity
 * Contains: lifecycleState, visibility
 */
export const createStatesConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states',
    title: 'Estado y Visibilidad',
    description: 'Control del estado y visibilidad',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.POST_SPONSOR_VIEW],
        edit: [PermissionEnum.POST_SPONSOR_UPDATE]
    },
    fields: [
        {
            id: 'lifecycleState',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Estado',
            description: 'Estado del ciclo de vida',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
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
            description: 'Quién puede ver este patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
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
