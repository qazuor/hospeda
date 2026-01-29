import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the States section of amenity
 */
export const createStatesConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states',
    title: 'Estados',
    description: 'Estado y visibilidad de la amenidad',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.AMENITY_CREATE],
        edit: [PermissionEnum.AMENITY_UPDATE]
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
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
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
            description: 'Quién puede ver esta amenidad',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
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
