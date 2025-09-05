import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/types';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Location Info de accommodation
 *
 * @param _t - Función de traducción (no usada por ahora)
 * @returns Configuración consolidada de la sección location-info
 */
export const createLocationInfoConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => ({
    id: 'location-info',
    title: 'Información de Ubicación',
    description: 'Datos de ubicación y dirección del alojamiento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'], // Visible en todos los modos
    permissions: {
        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
        edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
    },
    fields: [
        {
            id: 'address',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Dirección',
            description: 'Dirección completa del alojamiento',
            placeholder: 'Av. Corrientes 1234, CABA, Argentina',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {}
        },
        {
            id: 'city',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Ciudad',
            description: 'Ciudad donde se encuentra el alojamiento',
            placeholder: 'Buenos Aires',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {}
        },
        {
            id: 'state',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Provincia/Estado',
            description: 'Provincia o estado del alojamiento',
            placeholder: 'Buenos Aires',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {}
        },
        {
            id: 'country',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'País',
            description: 'País donde se encuentra el alojamiento',
            placeholder: 'Argentina',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {}
        },
        {
            id: 'postalCode',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Código Postal',
            description: 'Código postal del alojamiento',
            placeholder: '1043',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {}
        },
        {
            id: 'latitude',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Latitud',
            description: 'Coordenada de latitud (decimal)',
            placeholder: '-34.6037',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {
                step: 0.000001,
                min: -90,
                max: 90
            }
        },
        {
            id: 'longitude',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Longitud',
            description: 'Coordenada de longitud (decimal)',
            placeholder: '-58.3816',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_LOCATION_EDIT]
            },
            typeConfig: {
                step: 0.000001,
                min: -180,
                max: 180
            }
        }
    ]
});
