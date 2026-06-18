/**
 * @file experience-consolidated.config.ts
 * Consolidated section configuration for the experience entity (SPEC-240 T-028).
 *
 * Assembles the shared commerce sections (identity + operational) and injects
 * an experience-specific section in between that covers:
 *   - type (ExperienceTypeEnum SELECT)
 *   - priceFrom (NUMBER, optional — base price in centavos)
 *   - priceUnit (SELECT, optional — per_day | per_hour | per_person | per_group)
 *   - isPriceOnRequest (BOOLEAN, optional)
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
import { ExperienceTypeEnum, PermissionEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Experience-specific field options
// ---------------------------------------------------------------------------

/** SELECT options for the experience type field. */
const EXPERIENCE_TYPE_OPTIONS = [
    { value: ExperienceTypeEnum.CAR_RENTAL, label: 'Alquiler de autos' },
    { value: ExperienceTypeEnum.BIKE_RENTAL, label: 'Alquiler de bicicletas' },
    { value: ExperienceTypeEnum.KAYAK_RENTAL, label: 'Alquiler de kayak' },
    { value: ExperienceTypeEnum.QUAD_RENTAL, label: 'Alquiler de cuadriciclos' },
    { value: ExperienceTypeEnum.TOUR_GUIDE, label: 'Guía turístico' },
    { value: ExperienceTypeEnum.GUIDED_VISIT, label: 'Visita guiada' },
    { value: ExperienceTypeEnum.EXCURSION, label: 'Excursión' },
    { value: ExperienceTypeEnum.BOAT_TRIP, label: 'Paseo en lancha' },
    { value: ExperienceTypeEnum.FISHING_CHARTER, label: 'Pesca deportiva' },
    { value: ExperienceTypeEnum.BIRD_WATCHING, label: 'Avistamiento de aves' },
    { value: ExperienceTypeEnum.CULTURAL_TOUR, label: 'Tour cultural' },
    { value: ExperienceTypeEnum.WINE_TASTING, label: 'Degustación de vinos' },
    { value: ExperienceTypeEnum.OUTDOOR_ADVENTURE, label: 'Aventura al aire libre' },
    { value: ExperienceTypeEnum.OTHER, label: 'Otro' }
] as const;

/** SELECT options for the price unit field. */
const PRICE_UNIT_OPTIONS = [
    { value: 'per_day', label: 'Por día' },
    { value: 'per_hour', label: 'Por hora' },
    { value: 'per_person', label: 'Por persona' },
    { value: 'per_group', label: 'Por grupo' }
] as const;

// ---------------------------------------------------------------------------
// Experience-specific section
// ---------------------------------------------------------------------------

/**
 * Builds the experience-specific section that sits between the shared
 * identity and operational sections.
 *
 * Fields:
 *  - `type`             — Experience sub-category (SELECT, required).
 *  - `priceFrom`        — Base price in centavos (NUMBER, optional).
 *  - `priceUnit`        — Billing unit (SELECT, optional).
 *  - `isPriceOnRequest` — Shows "Consultar precio" instead of amount (BOOLEAN, optional).
 *
 * @returns A `ConsolidatedSectionConfig` for experience-specific fields.
 */
function createExperienceSpecificSection(): ConsolidatedSectionConfig {
    return {
        id: 'experience-specific',
        title: 'Detalles de Experiencia',
        description: 'Tipo de actividad y precios',
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
                label: 'Tipo de Experiencia',
                description: 'Categoría de la actividad turística',
                placeholder: 'Seleccioná el tipo…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    // TYPE-WORKAROUND: option constant is a readonly tuple; SelectFieldConfig expects a mutable array.
                    options: EXPERIENCE_TYPE_OPTIONS as unknown as {
                        value: string;
                        label: string;
                    }[]
                }
            },
            {
                id: 'priceUnit',
                type: FieldTypeEnum.SELECT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Unidad de Precio',
                description: 'Cómo se cobra la experiencia',
                placeholder: 'Seleccioná la unidad…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    // TYPE-WORKAROUND: option constant is a readonly tuple; SelectFieldConfig expects a mutable array.
                    options: PRICE_UNIT_OPTIONS as unknown as {
                        value: string;
                        label: string;
                    }[]
                }
            },
            {
                id: 'priceFrom',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Precio Base (centavos)',
                description:
                    'Precio en centavos (ej: 150000 = $1500,00). Ignorado si "Consultar precio" está activo.',
                placeholder: '0',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    min: 0,
                    step: 100
                }
            },
            {
                id: 'isPriceOnRequest',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Consultar precio',
                description: 'Cuando está activo muestra "Consultar precio" en lugar del monto.',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {}
            }
        ]
    };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Creates the complete consolidated configuration for the experience entity.
 *
 * Section order:
 *  1. Commerce identity section (shared — name, slug, summary, description, …)
 *  2. Experience-specific section (type, priceUnit, priceFrom, isPriceOnRequest)
 *  3. Commerce operational section (shared — contact, social, media, hours, …)
 *
 * Used by `EntityCreatePageBase` (create flow) and `EntityPageBase`
 * (view/edit flow).
 *
 * @param t - Translation function from `useTranslations()`
 * @returns Consolidated entity configuration for the experience entity.
 */
export const createExperienceConsolidatedConfig = (
    t: ReturnType<typeof useTranslations>['t']
): ConsolidatedEntityConfig => ({
    sections: [
        createCommerceIdentitySection(),
        createExperienceSpecificSection(),
        createCommerceOperationalSection()
    ],
    metadata: {
        title: t('admin-entities.entities.experience.singular'),
        description: t('admin-entities.entities.experience.description'),
        entityName: t('admin-entities.entities.experience.singular'),
        entityNamePlural: t('admin-entities.entities.experience.plural')
    }
});
