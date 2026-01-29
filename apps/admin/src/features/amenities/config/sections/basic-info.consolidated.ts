import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { AmenitiesTypeEnum, PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Basic Info section of amenity
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Detalles principales de la amenidad',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.AMENITY_CREATE],
        edit: [PermissionEnum.AMENITY_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre de la amenidad',
            placeholder: 'Ej: Wi-Fi, Piscina, Aire Acondicionado',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 2
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description: 'URL amigable para la amenidad',
            placeholder: 'wifi-gratis',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 3,
                pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            }
        },
        {
            id: 'description',
            type: FieldTypeEnum.TEXTAREA,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción detallada de la amenidad',
            placeholder: 'Descripción de lo que incluye esta amenidad',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 500,
                minLength: 10
            }
        },
        {
            id: 'icon',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Icono',
            description: 'Nombre del icono (ej: wifi, pool, ac)',
            placeholder: 'wifi',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 2
            }
        },
        {
            id: 'type',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Tipo',
            description: 'Categoría de la amenidad',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {
                options: [
                    { value: AmenitiesTypeEnum.CLIMATE_CONTROL, label: 'Control de Clima' },
                    { value: AmenitiesTypeEnum.CONNECTIVITY, label: 'Conectividad' },
                    { value: AmenitiesTypeEnum.ENTERTAINMENT, label: 'Entretenimiento' },
                    { value: AmenitiesTypeEnum.KITCHEN, label: 'Cocina' },
                    { value: AmenitiesTypeEnum.BED_AND_BATH, label: 'Dormitorio y Baño' },
                    { value: AmenitiesTypeEnum.OUTDOORS, label: 'Exterior' },
                    { value: AmenitiesTypeEnum.ACCESSIBILITY, label: 'Accesibilidad' },
                    { value: AmenitiesTypeEnum.SERVICES, label: 'Servicios' },
                    { value: AmenitiesTypeEnum.SAFETY, label: 'Seguridad' },
                    { value: AmenitiesTypeEnum.FAMILY_FRIENDLY, label: 'Familiar' },
                    { value: AmenitiesTypeEnum.WORK_FRIENDLY, label: 'Trabajo' },
                    { value: AmenitiesTypeEnum.GENERAL_APPLIANCES, label: 'Electrodomésticos' }
                ]
            }
        }
    ]
});
