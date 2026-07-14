import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';

/**
 * Consolidated configuration for the States & Moderation section of point of
 * interest.
 *
 * NOTE: `PointOfInterestSchema` does NOT have `visibility` or
 * `moderationState` fields, mirroring `attractions`' equivalent section.
 * Unlike attractions, POI's `isFeatured`/`isBuiltin`/`displayWeight` and the
 * new `hasOwnPage` (HOS-138) flag live here rather than in Basic Info.
 */
export const createStatesModerationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states-moderation',
    title: 'Estado',
    description: 'Estado y moderación del punto de interés',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
        edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
    },
    fields: [
        {
            id: 'lifecycleState',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Estado de Ciclo de Vida',
            description: 'Estado actual del registro',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
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
            id: 'isFeatured',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Destacado',
            description: 'Marcar como punto de interés destacado',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'isBuiltin',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view'],
            label: 'Integrado',
            description: 'Indica si es un punto de interés del sistema',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: []
            },
            typeConfig: {}
        },
        {
            id: 'hasOwnPage',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Página Propia',
            description: 'Marca los puntos de interés que tendrán una página de detalle dedicada',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'displayWeight',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Peso de Visualización',
            description:
                'Prioridad de visualización (1-100). Mayor valor = aparece primero en tarjetas',
            placeholder: '50',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                min: 1,
                max: 100,
                step: 1
            }
        }
    ]
});
