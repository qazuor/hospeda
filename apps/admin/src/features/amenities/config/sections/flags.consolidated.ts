import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Flags section of amenity
 */
export const createFlagsConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'flags',
    title: 'Configuración',
    description: 'Opciones de configuración de la amenidad',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.AMENITY_CREATE],
        edit: [PermissionEnum.AMENITY_UPDATE]
    },
    fields: [
        {
            id: 'isBuiltin',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Amenidad del Sistema',
            description: 'Indica si es una amenidad predefinida del sistema',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'isFeatured',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Destacada',
            description: 'Marcar como amenidad destacada',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {}
        }
    ]
});
