import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Flags section configuration for Feature entity
 * Contains: isBuiltin, isFeatured
 */
export const createFlagsConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'flags',
    title: 'Configuración',
    description: 'Opciones de comportamiento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.FEATURE_CREATE],
        edit: [PermissionEnum.FEATURE_UPDATE]
    },
    fields: [
        {
            id: 'isBuiltin',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Es Predefinida',
            description: 'Si la característica es parte del sistema base',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'isFeatured',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Es Destacada',
            description: 'Si la característica debe mostrarse de forma destacada',
            permissions: {
                view: [PermissionEnum.FEATURE_CREATE],
                edit: [PermissionEnum.FEATURE_UPDATE]
            },
            typeConfig: {}
        }
    ]
});
