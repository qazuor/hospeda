import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Amenities de accommodation
 *
 * @param _t - Función de traducción (no usada por ahora)
 * @returns Configuración consolidada de la sección amenities
 */
export const createAmenitiesConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => {
    // TODO [5d189ca1-cfd8-443b-800f-6a4c55eedf2b]: Opciones para las categorías de amenities (para uso futuro)
    // const amenityCategoryOptions: SelectOption[] = [
    //     { value: AmenitiesTypeEnum.CLIMATE_CONTROL, label: 'Control de Clima' },
    //     { value: AmenitiesTypeEnum.CONNECTIVITY, label: 'Conectividad' },
    //     { value: AmenitiesTypeEnum.ENTERTAINMENT, label: 'Entretenimiento' },
    //     { value: AmenitiesTypeEnum.KITCHEN, label: 'Cocina' },
    //     { value: AmenitiesTypeEnum.BED_AND_BATH, label: 'Cama y Baño' },
    //     { value: AmenitiesTypeEnum.OUTDOORS, label: 'Exteriores' },
    //     { value: AmenitiesTypeEnum.ACCESSIBILITY, label: 'Accesibilidad' },
    //     { value: AmenitiesTypeEnum.SERVICES, label: 'Servicios' },
    //     { value: AmenitiesTypeEnum.SAFETY, label: 'Seguridad' },
    //     { value: AmenitiesTypeEnum.FAMILY_FRIENDLY, label: 'Familiar' },
    //     { value: AmenitiesTypeEnum.WORK_FRIENDLY, label: 'Trabajo' },
    //     { value: AmenitiesTypeEnum.GENERAL_APPLIANCES, label: 'Electrodomésticos' }
    // ];

    return {
        id: 'amenities',
        title: 'Servicios y Comodidades',
        description: 'Amenities y servicios disponibles en el alojamiento',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit', 'create'], // Visible en todos los modos
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
        },
        fields: [
            // Amenities básicos más comunes
            {
                id: 'hasWifi',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'WiFi',
                description: 'Conexión a internet inalámbrica',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {}
            },
            {
                id: 'hasAirConditioning',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Aire Acondicionado',
                description: 'Sistema de climatización',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {}
            },
            {
                id: 'hasParking',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Estacionamiento',
                description: 'Espacio para estacionar vehículos',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {}
            },
            {
                id: 'hasPool',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Piscina',
                description: 'Piscina disponible para huéspedes',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {}
            },
            {
                id: 'hasKitchen',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Cocina',
                description: 'Cocina equipada disponible',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {}
            },
            {
                id: 'hasPetFriendly',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Pet Friendly',
                description: 'Acepta mascotas',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {}
            },
            {
                id: 'hasGym',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Gimnasio',
                description: 'Gimnasio o área de ejercicios',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {}
            },
            {
                id: 'hasBreakfast',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Desayuno Incluido',
                description: 'Desayuno incluido en la estadía',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {}
            },
            // Campo para amenities adicionales
            {
                id: 'additionalAmenities',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Amenities Adicionales',
                description: 'Otros servicios y comodidades disponibles',
                placeholder: 'Describa otros servicios disponibles...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {
                    minRows: 3,
                    maxLength: 1000
                }
            },
            // Campo para restricciones
            {
                id: 'amenityRestrictions',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Restricciones',
                description: 'Restricciones o condiciones especiales',
                placeholder:
                    'Ej: Piscina disponible solo en verano, estacionamiento con costo adicional...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {
                    minRows: 2,
                    maxLength: 500
                }
            }
        ]
    };
};
