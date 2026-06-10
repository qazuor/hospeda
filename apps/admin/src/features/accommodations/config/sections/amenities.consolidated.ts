import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Amenities de accommodation.
 *
 * SPEC-172 PR3:
 * - Removed vestigial boolean SWITCH fields (hasWifi, hasAirConditioning, etc.)
 *   These fields have NO corresponding columns in the accommodation DB table;
 *   they are virtual search-filter shortcuts computed from the amenity
 *   junction table. They never persisted. Verified: no match in
 *   packages/schemas/src/entities/accommodation/accommodation.schema.ts.
 * - Added amenityIds (AMENITY_SELECT, multiple) — syncs r_accommodation_amenity.
 * - Added featureIds (FEATURE_SELECT, multiple) — syncs r_accommodation_feature.
 * - Kept additionalAmenities and amenityRestrictions text fields.
 *
 * Pre-population note: the read API returns `amenities[].id` / `features[].id`
 * objects but the form fields are keyed `amenityIds` / `featureIds`. The
 * accommodation edit page performs the mapping in its initialValues transform
 * before EntityPageBase receives the entity data.
 *
 * @param _t - Translation function (labels are hardcoded Spanish for now,
 *             matching the sibling convention in this file).
 */
export const createAmenitiesConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => {
    return {
        id: 'amenities',
        title: 'Servicios y Comodidades',
        description: 'Amenities y características disponibles en el alojamiento',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
        },
        fields: [
            // ----------------------------------------------------------------
            // Amenities multi-select chips (full width, client-side search)
            // ----------------------------------------------------------------
            {
                id: 'amenityIds',
                type: FieldTypeEnum.AMENITY_SELECT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Amenities',
                description:
                    'Servicios y comodidades disponibles. Buscá y seleccioná del catálogo.',
                placeholder: 'Buscar amenities...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {
                    multiple: true,
                    searchMode: 'client',
                    clearable: true
                }
            },
            // ----------------------------------------------------------------
            // Features multi-select chips (full width, client-side search)
            // ----------------------------------------------------------------
            {
                id: 'featureIds',
                type: FieldTypeEnum.FEATURE_SELECT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Características',
                description:
                    'Características especiales del alojamiento. Buscá y seleccioná del catálogo.',
                placeholder: 'Buscar características...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
                },
                typeConfig: {
                    multiple: true,
                    searchMode: 'client',
                    clearable: true
                }
            },
            // ----------------------------------------------------------------
            // Free-text description of additional amenities not in catalog
            // ----------------------------------------------------------------
            {
                id: 'additionalAmenities',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Amenities Adicionales',
                description: 'Otros servicios y comodidades no listados en el catálogo',
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
            // ----------------------------------------------------------------
            // Restrictions / special conditions
            // ----------------------------------------------------------------
            {
                id: 'amenityRestrictions',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Restricciones',
                description: 'Restricciones o condiciones especiales sobre los servicios',
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
