/**
 * Renders a listing's house rules (`policies`, HOS-2060) as Markdown lines for
 * the AI chat context of the three verticals.
 *
 * The CLOSED values (enums, booleans, numbers, `HH:mm` times) render as-is.
 * The free-text pieces stay with the builder that already fences them: the venue
 * dress-code note (gated with `nightInfo`) and the experience cancellation
 * paragraph. The pets note is left out on purpose for the same reason.
 *
 * The one exception is the accommodation `deposit.notes` and
 * `eventsDetails.notes` (HOS-2131): owner-authored i18n text, resolved to the
 * visitor locale (falling back to `es`) and wrapped in the owner-data fence.
 *
 * The venue night keys (`minAge`, `dressCode`, `dressCodeNote`) are NOT read
 * here: they belong to `nightInfo` and render only when that section is
 * available (see `venue-night-context.ts`).
 *
 * @module apps/api/services/ai-context/listing-policies-context
 */

import type { Locale } from '@repo/i18n';
import type { ListingPaymentMethod } from '@repo/schemas';
import { fenceOwnerValue } from './owner-data-fence.js';

/** A localized owner note (`I18nText`-shaped; every locale optional here). */
type LocalizedNote = Readonly<Partial<Record<string, string | null | undefined>>>;

/** The policy keys this renderer reads; every one is optional. */
export interface ListingPoliciesContextInput {
    readonly paymentMethods?: readonly string[] | null;
    readonly pets?: { readonly admission?: string | null; readonly extraCost?: boolean } | null;
    readonly smokingAllowed?: string | null;
    readonly eventsAllowed?: boolean | null;
    readonly checkIn?: { readonly from?: string; readonly to?: string } | null;
    readonly checkOut?: { readonly from?: string; readonly to?: string } | null;
    readonly minNights?: number | null;
    readonly maxNights?: number | null;
    /** Venue reservation policy (HOS-2095: was stored but never rendered). */
    readonly reservations?: string | null;
    /** Accommodation booking deposit (HOS-2120). */
    readonly deposit?: {
        readonly required?: boolean;
        readonly percentage?: number | null;
        readonly notes?: LocalizedNote | null;
    } | null;
    /** Accommodation spoken languages (HOS-2120), closed list. */
    readonly spokenLanguages?: readonly string[] | null;
    /** Accommodation private-events details (HOS-2122); read only when `eventsAllowed === true`. */
    readonly eventsDetails?: {
        readonly maxGuests?: number | null;
        readonly amplifiedSound?: boolean | null;
        readonly endTime?: string | null;
        readonly extraCost?: boolean | null;
        readonly notes?: LocalizedNote | null;
    } | null;
}

/** Spanish labels, matching the rest of the context block. */
const PAYMENT_LABELS: Readonly<Record<ListingPaymentMethod, string>> = {
    cash: 'efectivo',
    debit: 'tarjeta de débito',
    credit: 'tarjeta de crédito',
    transfer: 'transferencia',
    mercadopago: 'Mercado Pago'
};
const PETS_LABELS: Readonly<Record<string, string>> = {
    yes: 'sí, se admiten',
    on_request: 'a consultar',
    no: 'no se admiten'
};
const RESERVATION_LABELS: Readonly<Record<string, string>> = {
    required: 'se requiere reserva',
    recommended: 'se recomienda reservar',
    not_accepted: 'no toma reservas'
};
const SMOKING_LABELS: Readonly<Record<string, string>> = {
    yes: 'se permite fumar',
    outdoor_only: 'solo en espacios al aire libre',
    no: 'no se permite fumar'
};

const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
    es: 'español',
    en: 'inglés',
    pt: 'portugués',
    it: 'italiano',
    fr: 'francés',
    de: 'alemán',
    other: 'otros idiomas'
};

/**
 * Resolves a localized owner note to the visitor locale, falling back to `es`.
 * An empty value collapses to `null` so no label renders over nothing.
 */
function resolveNote({
    note,
    locale
}: {
    readonly note: LocalizedNote | null | undefined;
    readonly locale: Locale;
}): string | null {
    if (!note) return null;
    for (const candidate of [note[locale], note.es]) {
        const resolved = (candidate ?? '').trim();
        if (resolved.length > 0) return resolved;
    }
    return null;
}

/** Formats a time window as "14:00–20:00", "desde 14:00" or "hasta 10:00". */
function formatWindow(window: { readonly from?: string; readonly to?: string }): string | null {
    if (window.from && window.to) return `${window.from}–${window.to}`;
    if (window.from) return `desde ${window.from}`;
    if (window.to) return `hasta ${window.to}`;
    return null;
}

/**
 * Builds the house-rules lines, heading included.
 *
 * @param input.policies - The stored `policies`, or null.
 * @param input.locale - Visitor locale for owner notes (default `es`).
 * @returns `{ lines }`, empty when no rule is declared.
 */
export function buildListingPoliciesLines({
    policies,
    locale = 'es'
}: {
    readonly policies: ListingPoliciesContextInput | null | undefined;
    readonly locale?: Locale;
}): { readonly lines: readonly string[] } {
    if (!policies) return { lines: [] };
    const body: string[] = [];
    const methods = (policies.paymentMethods ?? [])
        .map((method) => PAYMENT_LABELS[method as ListingPaymentMethod])
        .filter((label): label is string => Boolean(label));
    if (methods.length > 0) body.push(`**Medios de pago**: ${methods.join(', ')}`);
    const pets = policies.pets?.admission ? PETS_LABELS[policies.pets.admission] : undefined;
    if (pets) {
        body.push(
            `**Mascotas**: ${pets}${policies.pets?.extraCost ? ' (con costo adicional)' : ''}`
        );
    }
    const smoking = policies.smokingAllowed ? SMOKING_LABELS[policies.smokingAllowed] : undefined;
    if (smoking) body.push(`**Fumar**: ${smoking}`);
    if (policies.eventsAllowed != null) {
        body.push(`**Eventos**: ${policies.eventsAllowed ? 'se permiten' : 'no se permiten'}`);
    }
    const checkIn = policies.checkIn ? formatWindow(policies.checkIn) : null;
    if (checkIn) body.push(`**Check-in**: ${checkIn}`);
    const checkOut = policies.checkOut ? formatWindow(policies.checkOut) : null;
    if (checkOut) body.push(`**Check-out**: ${checkOut}`);
    if (policies.minNights != null) body.push(`**Mínimo de noches**: ${policies.minNights}`);
    if (policies.maxNights != null) body.push(`**Máximo de noches**: ${policies.maxNights}`);
    if (policies.deposit) {
        const { required, percentage, notes } = policies.deposit;
        const note = resolveNote({ note: notes, locale });
        const parts = [
            required
                ? `se requiere seña${percentage == null ? '' : ` (${percentage}% del total de la estadía)`}`
                : 'no se requiere seña'
        ];
        if (note) parts.push(fenceOwnerValue(note));
        if (required != null) body.push(`**Seña**: ${parts.join('. ')}`);
    }
    const languages = (policies.spokenLanguages ?? [])
        .map((language) => LANGUAGE_LABELS[language])
        .filter((label): label is string => Boolean(label));
    if (languages.length > 0) body.push(`**Idiomas de atención**: ${languages.join(', ')}`);
    if (policies.eventsAllowed === true && policies.eventsDetails) {
        const details = policies.eventsDetails;
        const parts: string[] = [];
        if (details.maxGuests != null) parts.push(`hasta ${details.maxGuests} personas`);
        if (details.amplifiedSound != null) {
            parts.push(
                details.amplifiedSound
                    ? 'se permite sonido amplificado'
                    : 'no se permite sonido amplificado'
            );
        }
        if (details.endTime) parts.push(`finalizan a las ${details.endTime}`);
        if (details.extraCost != null) {
            parts.push(details.extraCost ? 'con costo adicional' : 'sin costo adicional');
        }
        const note = resolveNote({ note: details.notes, locale });
        if (note) parts.push(fenceOwnerValue(note));
        if (parts.length > 0) body.push(`**Detalles de eventos**: ${parts.join('; ')}`);
    }
    const reservations = policies.reservations
        ? RESERVATION_LABELS[policies.reservations]
        : undefined;
    if (reservations) body.push(`**Reservas**: ${reservations}`);
    return { lines: body.length > 0 ? ['', '### Normas de la casa', ...body] : [] };
}
