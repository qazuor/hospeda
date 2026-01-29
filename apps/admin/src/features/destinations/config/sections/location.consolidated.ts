import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Consolidated configuration for the Location section of destination
 */
export const createLocationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'location',
    title: 'Ubicación',
    description: 'Información geográfica del destino',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.DESTINATION_VIEW_ALL],
        edit: [PermissionEnum.DESTINATION_UPDATE]
    },
    fields: [
        {
            id: 'location.country',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'País',
            description: 'País donde se ubica el destino',
            placeholder: 'AR',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                maxLength: 2,
                minLength: 2
            }
        },
        {
            id: 'location.state',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Provincia/Estado',
            description: 'Provincia o estado del destino',
            placeholder: 'Entre Ríos',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'location.city',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Ciudad',
            description: 'Ciudad del destino',
            placeholder: 'Concepción del Uruguay',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'location.zipCode',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Código Postal',
            description: 'Código postal del destino',
            placeholder: '3260',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'location.coordinates.lat',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Latitud',
            description: 'Coordenada de latitud',
            placeholder: '-32.4833',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -90,
                max: 90,
                step: 0.000001
            }
        },
        {
            id: 'location.coordinates.long',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Longitud',
            description: 'Coordenada de longitud',
            placeholder: '-58.2333',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -180,
                max: 180,
                step: 0.000001
            }
        }
    ]
});
