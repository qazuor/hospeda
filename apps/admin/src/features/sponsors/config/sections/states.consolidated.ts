import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';

/**
 * States section configuration for Sponsor entity
 * Contains: lifecycleState
 * NOTE: PostSponsorSchema does NOT have visibility field
 */
export const createStatesConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states',
    title: 'Estado',
    description: 'Control del estado del patrocinador',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POST_SPONSOR_VIEW],
        edit: [PermissionEnum.POST_SPONSOR_UPDATE]
    },
    fields: [
        {
            id: 'lifecycleState',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
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
        }
    ]
});
