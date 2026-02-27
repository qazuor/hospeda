import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the States section of attraction
 * NOTE: AttractionSchema does NOT have visibility or moderationState fields
 */
export const createStatesModerationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states-moderation',
    title: 'Estado',
    description: 'Estado de la atracción',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.ATTRACTION_VIEW],
        edit: [PermissionEnum.ATTRACTION_UPDATE]
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
                view: [PermissionEnum.ATTRACTION_VIEW],
                edit: [PermissionEnum.ATTRACTION_UPDATE]
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
