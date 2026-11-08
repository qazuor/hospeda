/**
 * @file listing-house-rules.ts
 * @description Turns a listing's `policies` into the rows the public "house
 * rules" block renders (HOS-2060).
 *
 * Pure and RO-RO so the decisions that matter — what an absent key renders
 * (nothing), how a pets surcharge or note is shown, how a half-open check-in
 * window reads — are unit-testable without rendering Astro.
 *
 * The stay length (`minNights`/`maxNights`) is deliberately NOT a row here:
 * the accommodation page already shows it in `QuickFacts` and the pricing
 * sidebar, and a third copy would only add noise. The experience cancellation
 * text and private-groups CTA keep their own components for the same reason.
 *
 * @module lib/listing/listing-house-rules
 */

import { resolveI18nText } from '../resolve-i18n-text';
import type { ListingPolicyTimeWindow, ListingPolicyValues } from './listing-policies';
import { paymentMethodLabel } from './listing-policies';

/** Translator shape compatible with `createTranslations().t`. */
type Translate = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/** Which rule a row describes; the renderer picks the icon from it. */
export type HouseRuleRowId =
    | 'checkIn'
    | 'checkOut'
    | 'paymentMethods'
    | 'pets'
    | 'smokingAllowed'
    | 'eventsAllowed'
    | 'reservations';

/** One rendered house-rule row. */
export interface HouseRuleRow {
    readonly id: HouseRuleRowId;
    /** Short label, e.g. "Mascotas". */
    readonly label: string;
    /** The rule itself, e.g. "Se admiten mascotas · con cargo extra". */
    readonly value: string;
    /** Owner note resolved to the page locale, when present. */
    readonly note?: string;
}

function windowText({
    window,
    t
}: {
    readonly window: ListingPolicyTimeWindow | undefined;
    readonly t: Translate;
}): string | null {
    if (!window) return null;
    if (window.from && window.to) {
        return t('listing.policies.time.range', '{{from}} a {{to}}', {
            from: window.from,
            to: window.to
        });
    }
    if (window.from) {
        return t('listing.policies.time.fromOnly', 'Desde las {{from}}', { from: window.from });
    }
    if (window.to) {
        return t('listing.policies.time.toOnly', 'Hasta las {{to}}', { to: window.to });
    }
    return null;
}

const PETS_FALLBACK = {
    no: 'No se admiten mascotas',
    yes: 'Se admiten mascotas',
    on_request: 'Mascotas a consultar'
} as const;

const SMOKING_FALLBACK = {
    no: 'No se permite fumar',
    yes: 'Se permite fumar',
    outdoor_only: 'Solo en espacios al aire libre'
} as const;

const RESERVATIONS_FALLBACK = {
    required: 'Reserva obligatoria',
    recommended: 'Reserva recomendada',
    not_accepted: 'No toma reservas'
} as const;

/**
 * Builds the house-rule rows for a listing.
 *
 * Every row is driven by a DECLARED key only: an absent key produces no row,
 * never a negative statement ("absent is not false").
 *
 * @param params.policies - The parsed policies.
 * @param params.t - Locale-bound translator.
 * @param params.locale - Page locale, used to resolve owner notes.
 * @returns The rows in display order; `[]` when nothing is declared.
 */
export function buildHouseRuleRows({
    policies,
    t,
    locale
}: {
    readonly policies: ListingPolicyValues;
    readonly t: Translate;
    readonly locale: string;
}): readonly HouseRuleRow[] {
    const rows: HouseRuleRow[] = [];

    const checkIn = windowText({ window: policies.checkIn, t });
    if (checkIn) {
        rows.push({
            id: 'checkIn',
            label: t('listing.policies.checkIn.label', 'Check-in'),
            value: checkIn
        });
    }
    const checkOut = windowText({ window: policies.checkOut, t });
    if (checkOut) {
        rows.push({
            id: 'checkOut',
            label: t('listing.policies.checkOut.label', 'Check-out'),
            value: checkOut
        });
    }

    if (policies.paymentMethods && policies.paymentMethods.length > 0) {
        rows.push({
            id: 'paymentMethods',
            label: t('listing.policies.paymentMethods.label', 'Medios de pago'),
            value: policies.paymentMethods
                .map((method) => paymentMethodLabel({ t, method }))
                .join(', ')
        });
    }

    if (policies.pets) {
        const { admission, extraCost, notes } = policies.pets;
        const admissionText = t(
            `listing.policies.pets.admission.${admission}`,
            PETS_FALLBACK[admission]
        );
        const value =
            admission !== 'no' && extraCost === true
                ? `${admissionText} · ${t('listing.policies.pets.extraCost', 'con cargo extra')}`
                : admissionText;
        const note = notes ? resolveI18nText(notes, locale).trim() : '';
        rows.push({
            id: 'pets',
            label: t('listing.policies.pets.label', 'Mascotas'),
            value,
            ...(note ? { note } : {})
        });
    }

    if (policies.smokingAllowed) {
        rows.push({
            id: 'smokingAllowed',
            label: t('listing.policies.smokingAllowed.label', 'Fumar'),
            value: t(
                `listing.policies.smokingAllowed.${policies.smokingAllowed}`,
                SMOKING_FALLBACK[policies.smokingAllowed]
            )
        });
    }

    if (policies.eventsAllowed !== undefined) {
        rows.push({
            id: 'eventsAllowed',
            label: t('listing.policies.eventsAllowed.label', 'Eventos'),
            value: policies.eventsAllowed
                ? t('listing.policies.eventsAllowed.yes', 'Se permiten eventos privados')
                : t('listing.policies.eventsAllowed.no', 'No se permiten eventos')
        });
    }

    if (policies.reservations) {
        rows.push({
            id: 'reservations',
            label: t('listing.policies.reservations.label', 'Reservas'),
            value: t(
                `listing.policies.reservations.${policies.reservations}`,
                RESERVATIONS_FALLBACK[policies.reservations]
            )
        });
    }

    return rows;
}
