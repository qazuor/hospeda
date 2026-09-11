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
 * plus a meeting-point section (HOS-1048) covering where the experience starts:
 *   - meetingPoint (TEXT, optional — address or landmark)
 *   - meetingPointLat / meetingPointLong (NUMBER, optional — WGS84 degrees)
 *
 * plus a practical-details section (HOS-898 / HOS-1047 / HOS-1056):
 *   - durationMinutes (NUMBER, optional — total minutes)
 *   - cancellationPolicy (TEXTAREA, optional — free text)
 *   - acceptsPrivateGroups (SWITCH, optional)
 *
 * The two HOS-1046 checklists (`whatToBring` / `requirements`) are absent on
 * purpose — see {@link createPracticalDetailsSection} for why a `text[]` has no
 * safe control here.
 *
 * Used by both the view/edit flow (`EntityPageBase`) and the create flow
 * (`EntityCreatePageBase`).
 */

import type { useTranslations } from '@repo/i18n';
import { ExperienceTypeEnum, MAX_EXPERIENCE_DURATION_MINUTES, PermissionEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    ConsolidatedEntityConfig,
    ConsolidatedSectionConfig
} from '@/features/accommodations/types/consolidated-config.types';
import {
    createCommerceIdentitySection,
    createCommerceOperationalSection
} from '@/features/commerce';

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
// Meeting-point section (HOS-1048)
// ---------------------------------------------------------------------------

/**
 * Builds the meeting-point section — where the experience STARTS.
 *
 * Its own section rather than three more fields in "Detalles de Experiencia",
 * because it answers a different question from type and price, and staff
 * correcting an address should not have to read past the pricing to find it.
 *
 * Fields:
 *  - `meetingPoint`     — address or landmark (TEXT, optional).
 *  - `meetingPointLat`  — latitude in decimal degrees (NUMBER, optional).
 *  - `meetingPointLong` — longitude in decimal degrees (NUMBER, optional).
 *
 * All three are optional and independent: an experience may describe its
 * meeting point in words and never pin it. Null is "no coordinate", not an
 * error — the columns are nullable all the way down.
 *
 * The permissions are the ordinary commerce ones. There is NO entitlement gate
 * here and there must not be one: the owner decided (2026-09-01) that the
 * meeting point is ficha data available from the basic tier. Only the map that
 * draws these coordinates is paid (HOS-1049).
 *
 * @returns A `ConsolidatedSectionConfig` for the meeting-point fields.
 */
function createMeetingPointSection(): ConsolidatedSectionConfig {
    return {
        id: 'experience-meeting-point',
        title: 'Punto de Encuentro',
        description: 'Dónde arranca la experiencia',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.COMMERCE_VIEW_ALL],
            edit: [PermissionEnum.COMMERCE_EDIT_ALL]
        },
        fields: [
            {
                id: 'meetingPoint',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Punto de Encuentro',
                description:
                    'Dirección o referencia del lugar donde arranca la experiencia. Puede ser un punto de referencia y no una calle.',
                placeholder: 'Ej: Muelle 3 del puerto, frente a la caseta azul',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {}
            },
            {
                id: 'meetingPointLat',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Latitud',
                description: 'Latitud en grados decimales (WGS84). Opcional.',
                placeholder: '-32.4825',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    min: -90,
                    max: 90,
                    step: 0.000001
                }
            },
            {
                id: 'meetingPointLong',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Longitud',
                description: 'Longitud en grados decimales (WGS84). Opcional.',
                placeholder: '-58.2333',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    min: -180,
                    max: 180,
                    step: 0.000001
                }
            }
        ]
    };
}

// ---------------------------------------------------------------------------
// Practical-details section (HOS-898 / HOS-1047 / HOS-1056)
// ---------------------------------------------------------------------------

/**
 * Builds the practical-details section — how long it lasts, what happens when
 * it does not run, and whether the provider takes private groups.
 *
 * ## What is deliberately NOT here
 *
 * `whatToBring` and `requirements` (HOS-1046) are `text[]` columns, and this
 * form system has no string-list control: its closest field type is `TEXTAREA`,
 * which binds a STRING. Wiring one to a `string[]` would submit a string the
 * owner-update schema rejects, so staff would get a validation error on a field
 * that looks like it should work. Both checklists are therefore edited from the
 * OWNER editor (`PracticalInfoSection.client.tsx`), which converts lines to
 * items on both sides — and the owner is the person who knows what to pack
 * anyway. Adding a `STRING_LIST` field type is the prerequisite for putting
 * them here, not a tweak to this file.
 *
 * ## Duration is stored in MINUTES
 *
 * One integer column, so one NUMBER input — no hours/minutes pair as in the
 * owner editor, because staff correcting a value are reading the stored number
 * and a split control would hide it. The hint says so.
 *
 * The permissions are the ordinary commerce ones. There is NO entitlement gate
 * here and there must not be one: the owner decided (2026-09-01) that all of
 * this is ficha data available from the basic tier.
 *
 * @returns A `ConsolidatedSectionConfig` for the practical-details fields.
 */
function createPracticalDetailsSection(): ConsolidatedSectionConfig {
    return {
        id: 'experience-practical-details',
        title: 'Datos Prácticos',
        description: 'Duración, cancelación y grupos privados',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.COMMERCE_VIEW_ALL],
            edit: [PermissionEnum.COMMERCE_EDIT_ALL]
        },
        fields: [
            {
                id: 'durationMinutes',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Duración (minutos)',
                description:
                    'Cuánto dura la experiencia, en minutos. 150 son dos horas y media. Vacío = sin declarar.',
                placeholder: '150',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    min: 1,
                    max: MAX_EXPERIENCE_DURATION_MINUTES,
                    step: 1
                }
            },
            {
                id: 'cancellationPolicy',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Política de Cancelación',
                description:
                    'Qué pasa si la salida no sale: lluvia, viento, bajante del río, o si no se junta el mínimo de gente.',
                placeholder:
                    'Si hay alerta meteorológica o baja el río, avisamos con 12 horas de anticipación y reprogramamos sin cargo.',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {}
            },
            {
                id: 'acceptsPrivateGroups',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Acepta Grupos Privados',
                description:
                    'Cuando está activo, la ficha pública muestra una invitación a consultar por grupos. No publica tarifario.',
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
 *  3. Meeting-point section (HOS-1048 — meetingPoint + optional lat/long)
 *  4. Practical-details section (HOS-898 / HOS-1047 / HOS-1056)
 *  5. Commerce operational section (shared — contact, social, media, hours, …)
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
        createMeetingPointSection(),
        createPracticalDetailsSection(),
        createCommerceOperationalSection()
    ],
    metadata: {
        title: t('admin-entities.entities.experience.singular'),
        description: t('admin-entities.entities.experience.description'),
        entityName: t('admin-entities.entities.experience.singular'),
        entityNamePlural: t('admin-entities.entities.experience.plural')
    }
});
