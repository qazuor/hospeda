/**
 * @file gastronomy-consolidated.config.ts
 * Consolidated section configuration for the gastronomy entity.
 *
 * Assembles the shared commerce sections (identity + operational) and injects
 * a gastronomy-specific section in between that covers:
 *   - type (GastronomyTypeEnum SELECT)
 *   - priceRange (PriceRangeEnum SELECT, optional)
 *   - menuUrl (TEXT, optional — URL field)
 *
 * Used by both the view/edit flow (`EntityPageBase`) and the create flow
 * (`EntityCreatePageBase`).
 */

import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedEntityConfig } from '@/features/accommodations/types/consolidated-config.types';
import type { ConsolidatedSectionConfig } from '@/features/accommodations/types/consolidated-config.types';
import {
    createCommerceIdentitySection,
    createCommerceOperationalSection
} from '@/features/commerce';
import type { useTranslations } from '@repo/i18n';
import { GastronomyTypeEnum, PermissionEnum, PriceRangeEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Gastronomy-specific field options
// ---------------------------------------------------------------------------

/** SELECT options for the gastronomy type field. */
const GASTRONOMY_TYPE_OPTIONS = [
    { value: GastronomyTypeEnum.RESTAURANT, label: 'Restaurante' },
    { value: GastronomyTypeEnum.BAR, label: 'Bar' },
    { value: GastronomyTypeEnum.CAFE, label: 'Café' },
    { value: GastronomyTypeEnum.PARRILLA, label: 'Parrilla' },
    { value: GastronomyTypeEnum.CERVECERIA, label: 'Cervecería' },
    { value: GastronomyTypeEnum.HELADERIA, label: 'Heladería' },
    { value: GastronomyTypeEnum.PANADERIA, label: 'Panadería' },
    { value: GastronomyTypeEnum.ROTISERIA, label: 'Rotisería' },
    { value: GastronomyTypeEnum.FOOD_TRUCK, label: 'Food Truck' }
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
function createGastronomySpecificSection(): ConsolidatedSectionConfig {
    return {
        id: 'gastronomy-specific',
        title: 'Detalles de Gastronomía',
        description: 'Tipo de establecimiento, rango de precios y menú online',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.COMMERCE_VIEW_ALL],
            edit: [PermissionEnum.COMMERCE_EDIT_ALL]
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
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    options: GASTRONOMY_TYPE_OPTIONS as unknown as {
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
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
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
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
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
 *  1. Commerce identity section (shared — name, slug, summary, description, …)
 *  2. Gastronomy-specific section (type, priceRange, menuUrl)
 *  3. Commerce operational section (shared — contact, social, media, hours, …)
 *
 * Used by `EntityCreatePageBase` (create flow) and `EntityPageBase`
 * (view/edit flow).
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Consolidated entity configuration for the gastronomy entity.
 */
export const createGastronomyConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedEntityConfig => ({
    sections: [
        createCommerceIdentitySection(),
        createGastronomySpecificSection(),
        createCommerceOperationalSection()
    ],
    metadata: {
        title: t('admin-entities.entities.gastronomy.singular'),
        description: t('admin-entities.entities.gastronomy.description'),
        entityName: t('admin-entities.entities.gastronomy.singular'),
        entityNamePlural: t('admin-entities.entities.gastronomy.plural')
    }
});
