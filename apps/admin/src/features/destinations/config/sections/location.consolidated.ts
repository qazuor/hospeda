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
            required: false,
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
        // SPEC-154 Phase 6 PR4: replaced two separate lat/long NUMBER fields
        // with a single COORDINATES field (Leaflet map + Nominatim
        // geocoding). Paridad with accommodation location-info — the
        // user can drop the pin on the map or paste the country / state /
        // city fields above for reverse geocoding.
        {
            id: 'location.coordinates',
            type: FieldTypeEnum.COORDINATES,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Coordenadas',
            description:
                'Punto en el mapa. Arrastrá el marcador o hacé click para ubicarlo. También podés ingresar latitud y longitud manualmente.',
            placeholder: '-32.4833, -58.2333',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                type: 'COORDINATES',
                addressFields: {
                    cityContext: 'location.city'
                },
                geocodingCountryCodes: ['ar']
            }
        }
    ]
});
