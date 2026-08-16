/**
 * @file owner-faq.ts
 * @description The owner-facing FAQ shown on BOTH `/publicar` and
 * `/suscriptores/propietarios`, plus the params every answer is rendered with.
 *
 * The two pages used to declare this array separately against the same
 * `owners.faq.*` keys. That is the failure mode HOS-329 fixed in the comparison
 * table and HOS-331 found again here: the copies drifted, so correcting the
 * "publishing is free" claim on one page left the other still saying
 * "el plan básico te permite publicar sin costo", and interpolating the trial
 * length on one page left the other rendering a literal `{{trialDays}}` into
 * its visible copy and its `FAQPage` JSON-LD.
 *
 * Answers are keyed into i18n; the `*Fb` strings are the fallback rendered when
 * a key is missing. Both must stay true — `resolve()` interpolates params into
 * the fallback as well, so a fallback carrying `{{trialDays}}` is correct, but
 * only when the render site passes {@link buildOwnerFaqParams}.
 */

import { resolveGenericOwnerTrialDays } from '@/lib/billing/generic-trial-days';

/** One question/answer pair, with its i18n keys and fallbacks. */
export interface OwnerFaqItem {
    readonly qKey: string;
    readonly qFb: string;
    readonly aKey: string;
    readonly aFb: string;
}

/**
 * The four owner FAQ entries.
 *
 * Answer 1 states the trial as first-subscription-only because
 * `resolveCheckoutFreeTrialDays` zeroes it once the customer has ANY prior
 * subscription ("one trial per customer, for life"), and it no longer claims a
 * free publishing tier — every owner plan is paid. Answer 3 no longer promises
 * unlimited properties: `MAX_ACCOMMODATIONS` is capped per tier (1/3/10).
 */
export const OWNER_FAQ_ITEMS: readonly OwnerFaqItem[] = [
    {
        qKey: 'owners.faq.1.q',
        qFb: '¿Cuánto cuesta publicar mi alojamiento?',
        aKey: 'owners.faq.1.a',
        aFb: 'Publicar requiere un plan de anfitrión. Si es tu primera suscripción, todos incluyen {{trialDays}} días de prueba gratis. No cobramos comisión por reserva: la suscripción es el único costo.'
    },
    {
        qKey: 'owners.faq.2.q',
        qFb: '¿Cómo recibo las reservas?',
        aKey: 'owners.faq.2.a',
        aFb: 'Los viajeros te contactan directamente por WhatsApp, email o teléfono. Vos manejás todo.'
    },
    {
        qKey: 'owners.faq.3.q',
        qFb: '¿Puedo publicar más de una propiedad?',
        aKey: 'owners.faq.3.a',
        aFb: 'Sí. Cada plan define cuántas propiedades podés tener publicadas a la vez, así que elegí el que mejor se ajuste a tu caso.'
    },
    {
        qKey: 'owners.faq.4.q',
        qFb: '¿Qué tipo de alojamientos puedo publicar?',
        aKey: 'owners.faq.4.a',
        aFb: 'Casas quintas, cabañas, departamentos, hoteles, apart hotels, campings y más.'
    }
];

/** Input for {@link buildOwnerFaqParams}. */
export interface BuildOwnerFaqParamsOptions {
    /**
     * Pre-resolved generic trial length (H-98), e.g. already fetched by the
     * caller for another purpose on the same page (the `/publicar` hero
     * callout resolves it once and forwards it here so the page does not
     * fetch the plan catalog twice). When omitted, this function resolves it
     * itself via {@link resolveGenericOwnerTrialDays}.
     */
    readonly trialDays?: number;
}

/**
 * Interpolation params for the answers above. Only the keys an answer actually
 * references are substituted, so passing this to every answer is inert for the
 * rest — and passing it is mandatory: an answer containing `{{trialDays}}`
 * renders that placeholder verbatim to the user when params are omitted.
 *
 * `trialDays` is sourced from the live billing plans (minimum `trialDays`
 * among active owner plans with `hasTrial`, falling back to the
 * `OWNER_TRIAL_DAYS` constant on fetch failure — see
 * `resolveGenericOwnerTrialDays`), not hardcoded, so this answer can never
 * drift from what checkout actually grants (H-98).
 *
 * @param options - RO-RO input, see {@link BuildOwnerFaqParamsOptions}.
 */
export async function buildOwnerFaqParams(
    options: BuildOwnerFaqParamsOptions = {}
): Promise<{ readonly trialDays: number }> {
    const trialDays = options.trialDays ?? (await resolveGenericOwnerTrialDays());
    return { trialDays };
}
