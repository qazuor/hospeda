/**
 * @file listingPoliciesSection.ts
 * Admin section for a listing's house rules (`policies`, HOS-2060), shared by
 * the three verticals.
 *
 * Every field is a dotted path under `policies`; the form sends the whole
 * `policies` root when one of them changes, and the service shallow-merges it
 * over the stored object, so keys this section does not show (the venue night
 * keys, the accommodation check-in window) are never erased by a save here.
 *
 * Deliberately left out:
 * - The venue `minAge` / `dressCode` / `dressCodeNote`: they belong to the
 *   `nightInfo` section, which the admin venue form does not edit.
 * - The accommodation `checkIn` / `checkOut` windows: the admin `TIME` field is
 *   a plain text input, and a cleared one would send `''`, which the `HH:mm`
 *   schema rejects. The owner editor edits them.
 *
 * Labels are hardcoded Spanish, matching the sibling admin section configs.
 */

import {
    LISTING_PAYMENT_METHODS,
    LISTING_PET_ADMISSION_VALUES,
    LISTING_SMOKING_VALUES,
    type ListingPaymentMethod,
    PermissionEnum
} from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    ConsolidatedFieldConfig,
    ConsolidatedSectionConfig
} from '@/features/accommodations/types/consolidated-config.types';

/** The verticals that carry `policies`. */
export type PoliciesVertical = 'accommodation' | 'venue' | 'experience';

/** View and edit permissions of the section, per vertical. */
const PERMISSIONS: Readonly<
    Record<PoliciesVertical, { readonly view: PermissionEnum[]; readonly edit: PermissionEnum[] }>
> = {
    accommodation: {
        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
        edit: [PermissionEnum.ACCOMMODATION_AMENITIES_EDIT]
    },
    venue: {
        view: [PermissionEnum.VENUE_VIEW_ALL],
        edit: [PermissionEnum.VENUE_EDIT_OWN, PermissionEnum.VENUE_EDIT_ALL]
    },
    experience: {
        view: [PermissionEnum.EXPERIENCE_VIEW_ALL],
        edit: [PermissionEnum.EXPERIENCE_EDIT_OWN, PermissionEnum.EXPERIENCE_EDIT_ALL]
    }
};

const PAYMENT_LABELS: Readonly<Record<ListingPaymentMethod, string>> = {
    cash: 'Efectivo',
    debit: 'Tarjeta de débito',
    credit: 'Tarjeta de crédito',
    transfer: 'Transferencia',
    mercadopago: 'Mercado Pago'
};
const PETS_LABELS: Readonly<Record<(typeof LISTING_PET_ADMISSION_VALUES)[number], string>> = {
    no: 'No se admiten',
    yes: 'Se admiten',
    on_request: 'A consultar'
};
const SMOKING_LABELS: Readonly<Record<(typeof LISTING_SMOKING_VALUES)[number], string>> = {
    no: 'No se permite fumar',
    yes: 'Se permite fumar',
    outdoor_only: 'Solo al aire libre'
};

/**
 * Builds the house-rules section of a listing's admin form.
 *
 * @param input.vertical - The listing vertical.
 * @returns `{ section }`, the consolidated section config.
 */
export function createListingPoliciesSection({
    vertical
}: {
    readonly vertical: PoliciesVertical;
}): { readonly section: ConsolidatedSectionConfig } {
    const permissions = PERMISSIONS[vertical];
    const field = (
        config: Omit<ConsolidatedFieldConfig, 'modes' | 'permissions' | 'required'>
    ): ConsolidatedFieldConfig =>
        ({
            required: false,
            modes: ['view', 'edit', 'create'],
            permissions,
            ...config
        }) as ConsolidatedFieldConfig;

    const base: ConsolidatedFieldConfig[] = [
        field({
            id: 'policies.paymentMethods',
            type: FieldTypeEnum.SELECT_MULTIPLE,
            label: 'Medios de pago',
            description: 'Cómo se puede pagar. Un listado nuevo arranca con efectivo.',
            typeConfig: {
                options: LISTING_PAYMENT_METHODS.map((value) => ({
                    value,
                    label: PAYMENT_LABELS[value]
                }))
            }
        }),
        field({
            id: 'policies.pets.admission',
            type: FieldTypeEnum.SELECT,
            label: 'Mascotas',
            description: 'Si se admiten mascotas. Es lo que lee el filtro "acepta mascotas".',
            typeConfig: {
                options: LISTING_PET_ADMISSION_VALUES.map((value) => ({
                    value,
                    label: PETS_LABELS[value]
                }))
            }
        }),
        field({
            id: 'policies.pets.extraCost',
            type: FieldTypeEnum.SWITCH,
            label: 'Mascotas con costo adicional',
            description: 'Activo cuando admitir una mascota se cobra aparte.',
            typeConfig: {}
        }),
        field({
            id: 'policies.smokingAllowed',
            type: FieldTypeEnum.SELECT,
            label: 'Fumar',
            description: 'Dónde se puede fumar.',
            typeConfig: {
                options: LISTING_SMOKING_VALUES.map((value) => ({
                    value,
                    label: SMOKING_LABELS[value]
                }))
            }
        }),
        field({
            id: 'policies.eventsAllowed',
            type: FieldTypeEnum.SWITCH,
            label: 'Se permiten eventos',
            description: 'Fiestas, cumpleaños o eventos privados.',
            typeConfig: {}
        })
    ];

    const byVertical: Readonly<Record<PoliciesVertical, ConsolidatedFieldConfig[]>> = {
        accommodation: [
            field({
                id: 'policies.minNights',
                type: FieldTypeEnum.NUMBER,
                label: 'Mínimo de noches',
                description: 'Estadía mínima. Es requisito para publicar.',
                placeholder: '1',
                typeConfig: { min: 1, max: 365, step: 1 }
            }),
            field({
                id: 'policies.maxNights',
                type: FieldTypeEnum.NUMBER,
                label: 'Máximo de noches',
                description: 'Estadía máxima. No puede ser menor que el mínimo.',
                placeholder: '30',
                typeConfig: { min: 1, max: 365, step: 1 }
            })
        ],
        venue: [],
        experience: [
            field({
                id: 'policies.cancellation',
                type: FieldTypeEnum.TEXTAREA,
                label: 'Política de Cancelación',
                description:
                    'Qué pasa si la salida no sale: lluvia, viento, bajante del río, o si no se junta el mínimo de gente.',
                placeholder:
                    'Si hay alerta meteorológica o baja el río, avisamos con 12 horas de anticipación y reprogramamos sin cargo.',
                typeConfig: { maxLength: 1500 }
            }),
            field({
                id: 'policies.privateGroups',
                type: FieldTypeEnum.SWITCH,
                label: 'Acepta Grupos Privados',
                description:
                    'Cuando está activo, la ficha pública muestra una invitación a consultar por grupos. No publica tarifario.',
                typeConfig: {}
            })
        ]
    };

    return {
        section: {
            id: 'listing-policies',
            title: 'Normas de la casa',
            description: 'Medios de pago, mascotas, fumar, eventos y reglas propias del rubro',
            layout: LayoutTypeEnum.GRID,
            modes: ['view', 'edit', 'create'],
            permissions,
            fields: [...base, ...byVertical[vertical]]
        }
    };
}
