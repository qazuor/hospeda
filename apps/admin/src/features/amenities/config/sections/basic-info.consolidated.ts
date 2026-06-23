import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { AmenitiesTypeEnum, PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Basic Info section of amenity.
 *
 * SPEC-266: `name` column dropped from the schema — display label is now
 * resolved at runtime from `@repo/i18n` using `accommodations.amenityNames.<slug>`.
 * `applicableVerticals` replaces it as a required field (min 1 vertical).
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
            type: FieldTypeEnum.I18N_TEXTAREA,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción de la amenidad en cada idioma (ES / EN / PT)',
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
            id: 'displayWeight',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Peso de Visualización',
            description:
                'Prioridad de visualización (1-100). Mayor valor = aparece primero en tarjetas',
            placeholder: '50',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {
                min: 1,
                max: 100,
                step: 1
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
        },
        {
            /**
             * SPEC-266: applicableVerticals — which verticals this amenity applies to.
             * Rendered as a checkbox group via FieldTypeEnum.SELECT_MULTIPLE.
             * Validated by AmenityCreateInputSchema (min 1 vertical required).
             */
            id: 'applicableVerticals',
            type: FieldTypeEnum.SELECT_MULTIPLE,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Verticales aplicables',
            description:
                'Verticales en los que esta amenidad puede usarse (mínimo 1). ' +
                '"Alojamiento" incluye todas las propiedades de hospedaje; ' +
                '"Gastronomía" aplica a restaurantes y bares; "Experiencia" a actividades.',
            permissions: {
                view: [PermissionEnum.AMENITY_CREATE],
                edit: [PermissionEnum.AMENITY_UPDATE]
            },
            typeConfig: {
                options: [
                    { value: 'accommodation', label: 'Alojamiento' },
                    { value: 'gastronomy', label: 'Gastronomía' },
                    { value: 'experience', label: 'Experiencia' }
                ]
            }
        }
    ]
});
