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
 * HOS-2120/HOS-2122 add the accommodation's deposit, spoken languages and the
 * private-events details. Each detail renders only when informed, and event
 * details only when events are allowed.
 *
 * @module lib/listing/listing-house-rules
 */

import { resolveI18nText } from '../resolve-i18n-text';
import type {
    ListingPolicyNote,
    ListingPolicyTimeWindow,
    ListingPolicyValues
} from './listing-policies';
import { paymentMethodLabel, spokenLanguageLabel } from './listing-policies';

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
    | 'reservations'
    | 'deposit'
    | 'spokenLanguages';

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

/** Resolves an optional owner note to the page locale; `''` when absent. */
function noteText({
    notes,
    locale
}: {
    readonly notes: ListingPolicyNote | undefined;
    readonly locale: string;
}): string {
    return notes ? resolveI18nText(notes, locale).trim() : '';
}

/** The events row: the yes/no, plus the informed details when allowed (HOS-2122). */
function eventsRow({
    policies,
    t,
    locale
}: {
    readonly policies: ListingPolicyValues;
    readonly t: Translate;
    readonly locale: string;
}): HouseRuleRow {
    const label = t('listing.policies.eventsAllowed.label', 'Eventos');
    if (policies.eventsAllowed !== true) {
        return {
            id: 'eventsAllowed',
            label,
            value: t('listing.policies.eventsAllowed.no', 'No se permiten eventos')
        };
    }
    const details = policies.eventsDetails ?? {};
    const parts = [t('listing.policies.eventsAllowed.yes', 'Se permiten eventos privados')];
    if (details.maxGuests !== undefined) {
        parts.push(
            t('listing.policies.eventsDetails.maxGuests', 'hasta {{count}} invitados', {
                count: details.maxGuests
            })
        );
    }
    if (details.endTime) {
        parts.push(
            t('listing.policies.eventsDetails.endTime', 'hasta las {{time}}', {
                time: details.endTime
            })
        );
    }
    if (details.amplifiedSound !== undefined) {
        parts.push(
            details.amplifiedSound
                ? t('listing.policies.eventsDetails.amplifiedSound.yes', 'con música amplificada')
                : t('listing.policies.eventsDetails.amplifiedSound.no', 'sin música amplificada')
        );
    }
    if (details.extraCost === true) {
        parts.push(t('listing.policies.eventsDetails.extraCost', 'con cargo extra'));
    }
    const note = noteText({ notes: details.notes, locale });
    return { id: 'eventsAllowed', label, value: parts.join(' · '), ...(note ? { note } : {}) };
}

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
        const note = noteText({ notes, locale });
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
        rows.push(eventsRow({ policies, t, locale }));
    }

    if (policies.deposit) {
        const { required, percentage, notes } = policies.deposit;
        const value = required
            ? percentage === undefined
                ? t('listing.policies.deposit.yes', 'Se pide seña')
                : t(
                      'listing.policies.deposit.yesWithPercentage',
                      'Se pide seña del {{percentage}}%',
                      {
                          percentage
                      }
                  )
            : t('listing.policies.deposit.no', 'No se pide seña');
        const note = required ? noteText({ notes, locale }) : '';
        rows.push({
            id: 'deposit',
            label: t('listing.policies.deposit.label', 'Seña para reservar'),
            value,
            ...(note ? { note } : {})
        });
    }

    if (policies.spokenLanguages && policies.spokenLanguages.length > 0) {
        rows.push({
            id: 'spokenLanguages',
            label: t('listing.policies.spokenLanguages.label', 'Idiomas en que te atendemos'),
            value: policies.spokenLanguages
                .map((language) => spokenLanguageLabel({ t, language }))
                .join(', ')
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
