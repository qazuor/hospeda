import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Address section of event location
 */
export const createAddressConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'address',
    title: 'Dirección',
    description: 'Información de ubicación física',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_LOCATION_VIEW],
        edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
    },
    fields: [
        {
            id: 'street',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Calle',
            description: 'Nombre de la calle',
            placeholder: 'Av. Principal',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'number',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Número',
            description: 'Número de calle',
            placeholder: '123',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 10,
                minLength: 1
            }
        },
        {
            id: 'floor',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Piso',
            description: 'Piso del edificio',
            placeholder: '1',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 10,
                minLength: 1
            }
        },
        {
            id: 'apartment',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Departamento',
            description: 'Número o letra del departamento',
            placeholder: 'A',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 10,
                minLength: 1
            }
        },
        {
            id: 'neighborhood',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Barrio',
            description: 'Barrio o zona',
            placeholder: 'Centro',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'city',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Ciudad',
            description: 'Ciudad de la ubicación',
            placeholder: 'Concepción del Uruguay',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'department',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Departamento/Provincia',
            description: 'Departamento o provincia',
            placeholder: 'Entre Ríos',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'country',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'País',
            description: 'País de la ubicación',
            placeholder: 'Argentina',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'coordinates.lat',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Latitud',
            description: 'Coordenada de latitud',
            placeholder: '-32.4833',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                type: 'NUMBER',
                min: -90,
                max: 90,
                step: 0.0001
            }
        },
        {
            id: 'coordinates.long',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Longitud',
            description: 'Coordenada de longitud',
            placeholder: '-58.2333',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                type: 'NUMBER',
                min: -180,
                max: 180,
                step: 0.0001
            }
        }
    ]
});
