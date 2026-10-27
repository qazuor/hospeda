/**
 * @file gastronomy-consolidated.config.ts
 * Consolidated section configuration for the gastronomy entity.
 *
 * Assembles the shared listing sections (identity + operational) and injects
 * a gastronomy-specific section in between that covers:
 *   - type (GastronomyTypeEnum SELECT)
 *   - priceRange (PriceRangeEnum SELECT, optional)
 *   - menuUrl (TEXT, optional — URL field)
 *
 * Used by both the view/edit flow (`EntityPageBase`) and the create flow
 * (`EntityCreatePageBase`).
 */

import type { useTranslations } from '@repo/i18n';
import { PermissionEnum, PriceRangeEnum, VenueTypeEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    ConsolidatedEntityConfig,
    ConsolidatedSectionConfig
} from '@/features/accommodations/types/consolidated-config.types';
import { createListingIdentitySection, createListingOperationalSection } from '@/features/listing';

// ---------------------------------------------------------------------------
// Gastronomy-specific field options
// ---------------------------------------------------------------------------

/** SELECT options for the gastronomy type field. */
const VENUE_TYPE_OPTIONS = [
    { value: VenueTypeEnum.RESTAURANT, label: 'Restaurante' },
    { value: VenueTypeEnum.BAR, label: 'Bar' },
    { value: VenueTypeEnum.CAFE, label: 'Café' },
    { value: VenueTypeEnum.PARRILLA, label: 'Parrilla' },
    { value: VenueTypeEnum.CERVECERIA, label: 'Cervecería' },
    { value: VenueTypeEnum.HELADERIA, label: 'Heladería' },
    { value: VenueTypeEnum.PANADERIA, label: 'Panadería' },
    { value: VenueTypeEnum.ROTISERIA, label: 'Rotisería' },
    { value: VenueTypeEnum.FOOD_TRUCK, label: 'Food Truck' }
] as const;

/** SELECT options for the price-range tier field. */
const PRICE_RANGE_OPTIONS = [
    { value: PriceRangeEnum.BUDGET, label: 'Económico ($)' },
    { value: PriceRangeEnum.MID, label: 'Intermedio ($$)' },
    { value: PriceRangeEnum.HIGH, label: 'Elevado ($$$)' },
    { value: PriceRangeEnum.PREMIUM, label: 'Premium ($$$$)' }
] as const;

// ---------------------------------------------------------------------------
// Gastronomy-specific section
// ---------------------------------------------------------------------------

/**
 * Builds the gastronomy-specific section that sits between the shared
 * identity and operational sections.
 *
 * Fields:
 *  - `type`       — Gastronomy sub-category (SELECT, required).
 *  - `priceRange` — Price-range tier (SELECT, optional).
 *  - `menuUrl`    — Online menu URL (TEXT, optional).
 *
 * @returns A `ConsolidatedSectionConfig` for gastronomy-specific fields.
 */
function createVenueSpecificSection(): ConsolidatedSectionConfig {
    return {
        id: 'gastronomy-specific',
        title: 'Detalles de Gastronomía',
        description: 'Tipo de establecimiento, rango de precios y menú online',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.GASTRONOMY_VIEW_ALL],
            edit: [PermissionEnum.GASTRONOMY_EDIT_ALL]
        },
        fields: [
            {
                id: 'type',
                type: FieldTypeEnum.SELECT,
                required: true,
                modes: ['view', 'edit', 'create'],
                label: 'Tipo de Establecimiento',
                description: 'Categoría gastronómica del comercio',
                placeholder: 'Seleccioná el tipo…',
                permissions: {
                    view: [PermissionEnum.GASTRONOMY_VIEW_ALL],
                    edit: [PermissionEnum.GASTRONOMY_EDIT_ALL]
                },
                typeConfig: {
                    // TYPE-WORKAROUND: option constant is a readonly tuple; SelectFieldConfig expects a mutable array.
                    options: VENUE_TYPE_OPTIONS as unknown as {
                        value: string;
                        label: string;
                    }[]
                }
            },
            {
                id: 'priceRange',
                type: FieldTypeEnum.SELECT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Rango de Precios',
                description: 'Nivel de precios del establecimiento',
                placeholder: 'Seleccioná el rango…',
                permissions: {
                    view: [PermissionEnum.GASTRONOMY_VIEW_ALL],
                    edit: [PermissionEnum.GASTRONOMY_EDIT_ALL]
                },
                typeConfig: {
                    // TYPE-WORKAROUND: option constant is a readonly tuple; SelectFieldConfig expects a mutable array.
                    options: PRICE_RANGE_OPTIONS as unknown as {
                        value: string;
                        label: string;
                    }[]
                }
            },
            {
                id: 'menuUrl',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'URL del Menú Online',
                description: 'Enlace al menú digital del establecimiento (https://…)',
                placeholder: 'https://tu-restaurante.com/menu',
                permissions: {
                    view: [PermissionEnum.GASTRONOMY_VIEW_ALL],
                    edit: [PermissionEnum.GASTRONOMY_EDIT_ALL]
                },
                typeConfig: {
                    maxLength: 500
                }
            }
        ]
    };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Creates the complete consolidated configuration for the gastronomy entity.
 *
 * Section order:
 *  1. Listing identity section (shared — name, slug, summary, description, …)
 *  2. Gastronomy-specific section (type, priceRange, menuUrl)
 *  3. Listing operational section (shared — contact, social, media, hours, …)
 *
 * Used by `EntityCreatePageBase` (create flow) and `EntityPageBase`
 * (view/edit flow).
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Consolidated entity configuration for the gastronomy entity.
 */
export const createVenueConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedEntityConfig => ({
    sections: [
        createListingIdentitySection('gastronomy'),
        createVenueSpecificSection(),
        createListingOperationalSection('gastronomy')
    ],
    metadata: {
        title: t('admin-entities.entities.gastronomy.singular'),
        description: t('admin-entities.entities.gastronomy.description'),
        entityName: t('admin-entities.entities.gastronomy.singular'),
        entityNamePlural: t('admin-entities.entities.gastronomy.plural')
    }
});
