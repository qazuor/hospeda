/**
 * Renders a listing's house rules (`policies`, HOS-2060) as Markdown lines for
 * the AI chat context of the three verticals.
 *
 * Only the CLOSED values are rendered (enums, booleans, numbers, `HH:mm`
 * times), so nothing here is owner free text and nothing needs fencing. The
 * free-text pieces stay with the builder that already fences them: the venue
 * dress-code note (gated with `nightInfo`) and the experience cancellation
 * paragraph. The pets note is left out on purpose for the same reason.
 *
 * The venue night keys (`minAge`, `dressCode`, `dressCodeNote`) are NOT read
 * here: they belong to `nightInfo` and render only when that section is
 * available (see `venue-night-context.ts`).
 *
 * @module apps/api/services/ai-context/listing-policies-context
 */

import type { ListingPaymentMethod } from '@repo/schemas';

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
 * @returns `{ lines }`, empty when no rule is declared.
 */
export function buildListingPoliciesLines({
    policies
}: {
    readonly policies: ListingPoliciesContextInput | null | undefined;
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
    const reservations = policies.reservations
        ? RESERVATION_LABELS[policies.reservations]
        : undefined;
    if (reservations) body.push(`**Reservas**: ${reservations}`);
    return { lines: body.length > 0 ? ['', '### Normas de la casa', ...body] : [] };
}
